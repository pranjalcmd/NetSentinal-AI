'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Bot,
  ShieldAlert,
  Server,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  User,
  Radio,
  Activity,
  AlertTriangle,
  Send,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { getIncidentDetail, type BackendIncident, type BackendFinding } from '@/lib/api';
import { getHosts } from '@/lib/mock/services';
import type { Host } from '@/lib/types';
import { RiskBadge, ConfidenceBadge, StatusBadge } from '@/components/ui/Badge';

// The real /api/incidents/{id} response is a BackendIncident plus a few
// detail-only fields the list route doesn't send (findings, and the
// detection engine's actual correlation reasoning).
interface IncidentDetail extends BackendIncident {
  findings: BackendFinding[];
  narrative: string[];
  root_hypothesis: string;
  impact_assessment: string;
  recommendations: string[];
  readiness: string;
}

export default function IncidentDetailPage({ params }: { params?: Promise<{ incidentId: string }> | { incidentId: string } }) {
  const [incidentId, setIncidentId] = useState<string>('');
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Local-only UI state — this backend has no PATCH /api/incidents/{id} and
  // no notes storage, so these never leave the browser (same as the report
  // draft page). They're not pretending to be synced anywhere.
  const [currentStatus, setCurrentStatus] = useState<string>('investigating');
  const [analystNotes, setAnalystNotes] = useState<string>('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  useEffect(() => {
    if (params) {
      if (typeof (params as Promise<any>).then === 'function') {
        (params as Promise<{ incidentId: string }>).then(p => setIncidentId(p.incidentId));
      } else {
        setIncidentId((params as { incidentId: string }).incidentId);
      }
    }
  }, [params]);

  useEffect(() => {
    if (!incidentId) return;

    const notesKey = `prism-incident-notes:${incidentId}`;

    const fetchData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const incData = (await getIncidentDetail(incidentId)) as IncidentDetail;
        setIncident(incData);
        setCurrentStatus(incData.status);

        try {
          const savedNotes = localStorage.getItem(notesKey);
          if (savedNotes) setAnalystNotes(savedNotes);
        } catch (_e) {}

        const allHosts = await getHosts();
        setHosts(allHosts.filter(h => incData.source_ips.includes(h.ip) || incData.source_ips.includes(h.id)));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : `Incident ${incidentId} could not be loaded`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [incidentId]);

  const handleStatusChange = (newStatus: string) => {
    setCurrentStatus(newStatus);
    if (incident) setIncident({ ...incident, status: newStatus });
  };

  const handleSaveNotes = () => {
    try {
      localStorage.setItem(`prism-incident-notes:${incidentId}`, analystNotes);
    } catch (_e) {}
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 3000);
  };

  const handleExportReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 min-h-screen">
        <Activity className="w-8 h-8 animate-spin mx-auto text-cyan-500" />
        <p className="text-sm font-mono">Loading Incident Command Workspace...</p>
      </div>
    );
  }

  if (loadError || !incident) {
    return (
      <div className="p-12 text-center space-y-4 min-h-screen">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Incident Not Found</h2>
        <p className="text-sm text-slate-400">{loadError || `Incident ID ${incidentId} could not be loaded.`}</p>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Incidents
        </Link>
      </div>
    );
  }

  const hasSynthesis = incident.root_hypothesis || incident.impact_assessment || incident.recommendations.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {exportMessage && (
        <div className="p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{exportMessage}</span>
          </div>
          <button onClick={() => setExportMessage(null)} className="text-cyan-400">✕</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/incidents" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Incidents Workspace
            </Link>
            <span>/</span>
            <span className="font-mono text-cyan-400">{incident.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Incident Command: {incident.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all"
          >
            <Download className="w-4 h-4" />
            Export to Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Incident Risk</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-red-400">{incident.risk_score}</span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-[11px] text-red-400/80 mt-1 font-mono">Critical Security Priority</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Correlation Confidence</span>
          <div className="text-3xl font-bold font-mono text-teal-300">{incident.confidence}%</div>
          <div className="mt-1">
            <ConfidenceBadge confidence={incident.confidence} size="sm" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Current Lifecycle Status</span>
          <div className="mt-2">
            <StatusBadge status={currentStatus} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Readiness</span>
          <div className="text-sm font-bold text-white mt-1">{incident.readiness}</div>
          <div className="text-[11px] text-slate-400">Evidence sufficiency</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Affected Hosts</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">{incident.source_ips.length} Hosts</div>
          <div className="text-[11px] text-slate-400 font-mono">{incident.source_ips.join(', ') || '—'}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Correlated Findings</span>
          <div className="text-2xl font-bold font-mono text-orange-400 mt-1">{incident.finding_ids.length} Detections</div>
          <div className="text-[11px] text-slate-400">Cross-sensor correlated</div>
        </div>
      </div>

      {hasSynthesis && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Detection Engine Synthesis</h2>
                <p className="text-xs text-slate-400 font-mono">Root cause, impact, and recommended response</p>
              </div>
            </div>
          </div>

          {incident.root_hypothesis && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Root Hypothesis</h4>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
                {incident.root_hypothesis}
              </p>
            </div>
          )}

          {incident.impact_assessment && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Impact Assessment</h4>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
                {incident.impact_assessment}
              </p>
            </div>
          )}

          {incident.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Recommendations</h4>
              <ul className="list-disc list-inside space-y-1 bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
                {incident.recommendations.map((r, idx) => (
                  <li key={idx} className="text-xs text-slate-300">{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {incident.narrative.length > 0 && (
            <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Correlation Narrative
              </h2>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {incident.narrative.map((line, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1 p-1 rounded-full bg-slate-950 border border-slate-700">
                      <Radio className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                      {line}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              Correlated Findings
            </h2>
            <div className="divide-y divide-slate-800/60">
              {incident.findings.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No findings attached to this incident.</p>
              ) : (
                incident.findings.map(f => (
                  <Link
                    key={f.id}
                    href={`/findings/${f.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-800/40 transition-colors -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{f.title}</p>
                      <p className="text-xs text-slate-500 font-mono">{f.id} · {f.category}</p>
                    </div>
                    <RiskBadge score={f.risk_score} size="sm" />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              Correlated Internal Hosts
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[11px] text-slate-400 uppercase font-semibold">
                    <th className="p-3">Host IP & Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Risk Score</th>
                    <th className="p-3">Total Flows</th>
                    <th className="p-3">Traffic Vol (Out/In)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {hosts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500 font-sans">
                        No matching hosts found for {incident.source_ips.join(', ') || 'this incident'}.
                      </td>
                    </tr>
                  ) : (
                    hosts.map(h => (
                      <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <Link href={`/network/hosts/${h.id}`} className="hover:text-cyan-300 hover:underline font-bold text-white">
                            {h.ip}
                          </Link>
                          <span className="block text-[11px] text-slate-400 font-sans">{h.hostname}</span>
                        </td>
                        <td className="p-3 font-sans text-slate-300">{h.role ?? 'Workstation'}</td>
                        <td className="p-3">
                          <RiskBadge score={h.riskScore} size="sm" />
                        </td>
                        <td className="p-3 text-slate-300">{h.flows.toLocaleString()}</td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {(h.bytesOut / 1024 / 1024 / 1024).toFixed(2)} GB / {(h.bytesIn / 1024 / 1024).toFixed(1)} MB
                        </td>
                        <td className="p-3 text-right">
                          <Link href={`/network/hosts/${h.id}`} className="text-xs text-cyan-400 hover:underline font-sans">
                            Forensics →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Incident Lifecycle Triage
            </h2>
            <p className="text-[11px] text-slate-500">
              Local only — this backend has no endpoint to persist status changes yet.
            </p>

            <div className="space-y-2">
              {[
                { id: 'open', label: 'Open', desc: 'Newly correlated incident awaiting triage' },
                { id: 'investigating', label: 'Investigating', desc: 'Active forensic analysis & scope discovery' },
                { id: 'contained', label: 'Contained', desc: 'Affected hosts isolated, firewall rules active' },
                { id: 'resolved', label: 'Resolved', desc: 'Threat remediated, report submitted' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    currentStatus === st.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 ring-1 ring-cyan-500/40 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold capitalize">{st.label}</span>
                    {currentStatus === st.id && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{st.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Analyst Workstation Notes
              </h2>
              {notesSavedToast && <span className="text-xs text-emerald-400 font-mono">Saved!</span>}
            </div>
            <p className="text-[11px] text-slate-500">Saved to this browser only.</p>

            <textarea
              rows={6}
              value={analystNotes}
              onChange={e => setAnalystNotes(e.target.value)}
              placeholder="Enter incident command notes, customer SOC contact log, firewall block confirmations..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />

            <button
              onClick={handleSaveNotes}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Save Analyst Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}