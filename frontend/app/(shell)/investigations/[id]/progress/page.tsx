'use client';

/**
 * Live Investigation Pipeline — /investigations/[id]/progress
 *
 * WHY THIS WAS BROKEN
 * The upload page posts the file to the real backend via `uploadPcap()` in
 * lib/api.ts, which uses API_BASE (NEXT_PUBLIC_API_URL). This page used
 * `getInvestigation()` from lib/mock/services.ts, which hardcodes
 * http://localhost:8000. On the deployed site the browser cannot reach
 * localhost:8000, the request fails silently, the function falls back to
 * mock data, and the real job id is "not found".
 *
 * HOW THIS VERSION WORKS
 * 1. Asks the real backend (API_BASE) for GET /api/jobs and finds the job.
 * 2. Falls back to GET /api/captures/{id} (in-memory job on the backend).
 * 3. Falls back to the job the upload page cached in sessionStorage.
 * 4. Falls back to the mock service only for demo ids (e.g. INV-xxx).
 * The backend analyses a pcap synchronously, so a job is normally already
 * "complete" when we get here; we still poll while it is pending/running.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  API_BASE,
  ApiError,
  getJobs,
  getCaptureDetail,
  loadJob,
  type AnalysisJob,
} from '@/lib/api';
import { getInvestigation } from '@/lib/mock/services';
import { StatusBadge } from '@/components/domain/StatusBadge';
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
  RefreshCw,
  ShieldAlert,
  FileSearch,
  Network,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

interface PipelineStage {
  name: string;
  detail: string;
  status: StageStatus;
}

interface AlertLite {
  alert_id?: string;
  id?: string;
  title?: string;
  type?: string;
  severity?: string;
  risk_score?: number;
  risk?: number;
  entity?: string;
  source_ip?: string;
  flow_id?: string;
}

interface IncidentLite {
  incident_id?: string;
  title?: string;
  risk?: number;
  primary_host?: string;
}

interface JobSummary {
  total_flows?: number;
  suspicious_flows?: number;
  high_risk?: number;
  protocols?: number;
  incidents?: number;
  risk_distribution?: Record<string, number>;
  protocol_distribution?: Record<string, number>;
  recent_alerts?: AlertLite[];
  top_incidents?: IncidentLite[];
  capture?: { capture_id?: string; dpi_mode?: string };
}

type JobLike = Omit<Partial<AnalysisJob>, 'summary'> & { id?: string; summary?: JobSummary };

interface MockInvestigationLike {
  id: string;
  captureId?: string;
  status?: string;
  createdAt?: string;
  incidents?: string[];
  progress?: { flowsProcessed?: number; findingsSoFar?: number; protocolsFound?: number; errors?: string[] };
}

interface ViewModel {
  id: string;
  filename: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
  createdAt?: string;
  captureId?: string;
  dpiMode?: string;
  totalFlows: number;
  suspiciousFlows: number;
  highRisk: number;
  protocols: number;
  incidentsCount: number;
  riskDistribution: Record<string, number>;
  protocolDistribution: Record<string, number>;
  recentAlerts: AlertLite[];
  topIncidents: IncidentLite[];
  errors: string[];
  source: 'backend' | 'session-cache' | 'demo';
}

const POLL_MS = 2000;
const MAX_POLLS = 90; // ~3 minutes, then stop and let the user retry
const SESSION_KEY = (id: string) => `prism:job:${id}`;

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const SEVERITY_BAR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-sky-500',
  INFO: 'bg-slate-500',
};
const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-sky-400',
  INFO: 'text-slate-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function normaliseStatus(raw: string | undefined): ViewModel['status'] {
  const s = String(raw || '').toLowerCase();
  if (s === 'complete' || s === 'completed' || s === 'analyzed') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'pending' || s === 'queued') return 'queued';
  return 'running';
}

function fromJob(job: JobLike, source: ViewModel['source']): ViewModel {
  const s: JobSummary = job.summary || {};
  return {
    id: String(job.job_id || job.id),
    filename: job.filename || 'capture',
    status: normaliseStatus(job.status),
    message: job.message || '',
    createdAt: job.created_at,
    captureId: s.capture?.capture_id,
    dpiMode: s.capture?.dpi_mode,
    totalFlows: Number(s.total_flows || 0),
    suspiciousFlows: Number(s.suspicious_flows || 0),
    highRisk: Number(s.high_risk || 0),
    protocols: Number(s.protocols || 0),
    incidentsCount: Number(s.incidents || 0),
    riskDistribution: s.risk_distribution || {},
    protocolDistribution: s.protocol_distribution || {},
    recentAlerts: Array.isArray(s.recent_alerts) ? s.recent_alerts : [],
    topIncidents: Array.isArray(s.top_incidents) ? s.top_incidents : [],
    errors: Array.isArray(job.errors) ? job.errors : [],
    source,
  };
}

function fromMockInvestigation(inv: MockInvestigationLike): ViewModel {
  return {
    id: inv.id,
    filename: inv.captureId || 'demo capture',
    status: normaliseStatus(inv.status),
    message: 'Demo investigation (mock data)',
    createdAt: inv.createdAt,
    captureId: inv.captureId,
    totalFlows: inv.progress?.flowsProcessed || 0,
    suspiciousFlows: inv.progress?.findingsSoFar || 0,
    highRisk: 0,
    protocols: inv.progress?.protocolsFound || 0,
    incidentsCount: Array.isArray(inv.incidents) ? inv.incidents.length : 0,
    riskDistribution: {},
    protocolDistribution: {},
    recentAlerts: [],
    topIncidents: [],
    errors: inv.progress?.errors || [],
    source: 'demo',
  };
}

function readSessionCache(id: string): ViewModel | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(id));
    if (!raw) return null;
    return fromJob(JSON.parse(raw) as JobLike, 'session-cache');
  } catch {
    return null;
  }
}

/** Build the pipeline view from what the backend actually did. */
function buildStages(vm: ViewModel): PipelineStage[] {
  const flows = vm.totalFlows.toLocaleString();
  const stages: Array<Omit<PipelineStage, 'status'>> = [
    { name: 'Capture received', detail: vm.filename },
    { name: 'Packet parsing & flow reassembly', detail: `${flows} flows` },
    { name: 'Deep packet inspection (L7)', detail: `${vm.protocols} protocols${vm.dpiMode ? ` · ${vm.dpiMode}` : ''}` },
    { name: 'ML anomaly scoring', detail: `${flows} flows scored` },
    { name: 'Rule-based detection', detail: `${vm.suspiciousFlows} suspicious flows` },
    { name: 'Incident correlation', detail: `${vm.incidentsCount} incidents` },
    { name: 'Results stored', detail: vm.captureId || vm.id.slice(0, 8) },
  ];

  if (vm.status === 'completed') return stages.map((s) => ({ ...s, status: 'completed' as const }));
  if (vm.status === 'failed') {
    return stages.map((s, i) => ({
      ...s,
      status: (i === 0 ? 'completed' : i === 1 ? 'failed' : 'pending') as StageStatus,
    }));
  }
  // The backend gives no per-stage progress while running — show the first stage active.
  return stages.map((s, i) => ({ ...s, status: (i === 0 ? 'running' : 'pending') as StageStatus }));
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />;
  return <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />;
}

function Metric({ label, value, tone = 'text-slate-100' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${tone}`}>{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function InvestigationProgressPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? decodeURIComponent(String(params.id)) : '';

  const [vm, setVm] = useState<ViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceMsg, setWorkspaceMsg] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelled = useRef(false);
  const pollRef = useRef<() => void>(() => {});

  const fetchOnce = useCallback(async (): Promise<ViewModel> => {
    let lastErr: unknown = null;

    // 1) Durable job history on the real backend.
    try {
      const jobs = await getJobs();
      const job = Array.isArray(jobs) ? jobs.find((j) => j.job_id === id) : undefined;
      if (job) return fromJob(job as JobLike, 'backend');
    } catch (e) {
      lastErr = e;
    }

    // 2) In-memory job on the backend (works even if the DB is unavailable).
    try {
      const cap = await getCaptureDetail(id);
      if (cap) return fromJob({ ...cap, job_id: cap.id } as unknown as JobLike, 'backend');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) lastErr = e;
    }

    // 3) Whatever the upload page cached for this browser tab.
    const cached = readSessionCache(id);
    if (cached) return cached;

    // 4) Demo/mock investigations (ids that never came from the backend).
    try {
      const inv = await getInvestigation(id);
      return fromMockInvestigation(inv as unknown as MockInvestigationLike);
    } catch {
      /* fall through */
    }

    if (lastErr instanceof ApiError && lastErr.status === 0) {
      throw new Error(
        `Could not reach the analysis backend at ${API_BASE}. Check that it is running and that NEXT_PUBLIC_API_URL is set on the deployment.`,
      );
    }
    throw new Error(
      `Investigation not found: ${id}. The backend may have restarted and lost its job history — try uploading the capture again.`,
    );
  }, [id]);

  const poll = useCallback(async () => {
    try {
      const next = await fetchOnce();
      if (cancelled.current) return;
      setVm(next);
      setError(null);
      setLoading(false);

      const stillWorking = next.status === 'queued' || next.status === 'running';
      if (stillWorking && pollCount.current < MAX_POLLS) {
        pollCount.current += 1;
        timer.current = setTimeout(() => pollRef.current(), POLL_MS);
      }
    } catch (err) {
      if (cancelled.current) return;
      setError(err instanceof Error ? err.message : 'Could not load this investigation');
      setLoading(false);
    }
  }, [fetchOnce]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    if (!id) return;
    cancelled.current = false;
    pollCount.current = 0;
    // Kick off on the next tick so no state is set synchronously in the effect.
    timer.current = setTimeout(() => pollRef.current(), 0);

    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);

  const retry = () => {
    if (timer.current) clearTimeout(timer.current);
    pollCount.current = 0;
    setError(null);
    if (!vm) setLoading(true);
    poll();
  };

  const openInWorkspace = async (target: string) => {
    if (!vm || vm.source === 'demo') {
      router.push(target);
      return;
    }
    setLoadingWorkspace(true);
    setWorkspaceMsg(null);
    try {
      // Makes this capture the active one so Findings / Incidents / Mesh show it.
      await loadJob(vm.id);
      router.push(target);
    } catch (err) {
      setWorkspaceMsg(err instanceof Error ? err.message : 'Could not open this capture');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const stages = useMemo(() => (vm ? buildStages(vm) : []), [vm]);
  const riskTotal = useMemo(
    () => (vm ? SEVERITY_ORDER.reduce((n, k) => n + (vm.riskDistribution[k] || 0), 0) : 0),
    [vm],
  );
  const topProtocols = useMemo(
    () => (vm ? Object.entries(vm.protocolDistribution).sort((a, b) => b[1] - a[1]).slice(0, 8) : []),
    [vm],
  );

  // ─── Render: error ──────────────────────────────────────────────────────
  if (error && !vm) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <Link
            href="/investigations/new/upload"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Upload a capture
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render: loading ────────────────────────────────────────────────────
  if (loading || !vm) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400 pt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading investigation…
        </div>
      </div>
    );
  }

  const isDone = vm.status === 'completed';
  const isClean = isDone && vm.suspiciousFlows === 0;

  // ─── Render: result ─────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
          <p className="text-xs text-slate-400">Capture analysis · DPI, ML scoring, detection rules and correlation</p>
        </div>
        <button
          onClick={retry}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {vm.source === 'session-cache' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          Showing the result returned at upload time — the backend no longer lists this job (it may have restarted).
        </div>
      )}
      {vm.source === 'demo' && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2 text-xs text-slate-400">
          Demo investigation — mock data, not from the analysis backend.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</div>
      )}

      {/* Header card */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-slate-100 break-all">{vm.id}</span>
          <StatusBadge status={vm.status} />
        </div>
        <p className="text-xs text-slate-400">
          File: <span className="text-slate-300">{vm.filename}</span>
          {vm.captureId && (
            <>
              {' '}· Capture: <span className="font-mono text-slate-300">{vm.captureId}</span>
            </>
          )}
          {vm.createdAt && <> · {new Date(vm.createdAt).toLocaleString()}</>}
        </p>
        {vm.message && <p className="text-xs text-slate-300">{vm.message}</p>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Metric label="Flows Processed" value={vm.totalFlows.toLocaleString()} />
        <Metric label="Protocols Discovered" value={vm.protocols} tone="text-emerald-400" />
        <Metric label="Suspicious Flows" value={vm.suspiciousFlows} tone="text-amber-400" />
        <Metric label="High / Critical" value={vm.highRisk} tone={vm.highRisk ? 'text-red-400' : 'text-slate-100'} />
        <Metric label="Incidents" value={vm.incidentsCount} tone="text-sky-400" />
      </div>

      {/* Pipeline stages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {stages.map((stage) => (
          <div key={stage.name} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <StageIcon status={stage.status} />
              <span className="text-sm text-slate-200">{stage.name}</span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {stage.status === 'completed' ? stage.detail : stage.status}
            </span>
          </div>
        ))}
      </div>

      {vm.errors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 space-y-1">
          {vm.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {isClean && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Analysis finished — no suspicious behaviour was flagged in this capture.
        </div>
      )}

      {isDone && vm.source !== 'demo' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Severity distribution */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Severity distribution</h2>
            {riskTotal === 0 ? (
              <p className="text-xs text-slate-500">No alerts raised.</p>
            ) : (
              SEVERITY_ORDER.map((sev) => {
                const n = vm.riskDistribution[sev] || 0;
                return (
                  <div key={sev} className="flex items-center gap-3 text-xs">
                    <span className={`w-16 ${SEVERITY_TEXT[sev]}`}>{sev}</span>
                    <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                      <div className={`h-full ${SEVERITY_BAR[sev]}`} style={{ width: `${(n / riskTotal) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-slate-400">{n}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Protocols */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Top protocols</h2>
            {topProtocols.length === 0 ? (
              <p className="text-xs text-slate-500">No protocol data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topProtocols.map(([proto, count]) => (
                  <span
                    key={proto}
                    className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300"
                  >
                    {proto} <span className="text-slate-500">· {count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Top alerts */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Top alerts
            </h2>
            {vm.recentAlerts.length === 0 ? (
              <p className="text-xs text-slate-500">No alerts.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {vm.recentAlerts.slice(0, 10).map((a, i) => {
                  const sev = String(a.severity || 'INFO').toUpperCase();
                  return (
                    <div key={a.alert_id || a.id || i} className="py-2 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">{a.title || a.type || 'Alert'}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {a.entity || a.source_ip || '—'} {a.flow_id ? `· ${a.flow_id}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-semibold ${SEVERITY_TEXT[sev] || 'text-slate-400'}`}>{sev}</span>
                        <span className="text-xs font-mono text-slate-400">{a.risk_score ?? a.risk ?? '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incidents */}
          {vm.topIncidents.length > 0 && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Correlated incidents
              </h2>
              <div className="divide-y divide-slate-800">
                {vm.topIncidents.map((inc, i) => (
                  <div key={inc.incident_id || i} className="py-2 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{inc.title || inc.incident_id}</p>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        {inc.incident_id} {inc.primary_host ? `· ${inc.primary_host}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 flex-shrink-0">risk {inc.risk ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isDone && (
        <div className="flex flex-wrap justify-end gap-3">
          {workspaceMsg && <p className="text-xs text-red-400 self-center mr-auto">{workspaceMsg}</p>}
          <button
            disabled={loadingWorkspace}
            onClick={() => openInWorkspace('/network/mesh')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors disabled:opacity-50"
          >
            <Network className="w-4 h-4" /> Network mesh
          </button>
          <button
            disabled={loadingWorkspace}
            onClick={() => openInWorkspace('/findings')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            View findings
          </button>
        </div>
      )}
    </div>
  );
}
