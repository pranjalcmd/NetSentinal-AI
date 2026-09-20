/**
 * NetSentinel AI — Canonical Typed API Client
 * Centralized API module for all FastAPI backend interactions (PRD Section 7).
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, errorData.detail || `API Error ${res.status}`, errorData);
    }

    return res.json() as Promise<T>;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, err.message || 'Network unreachable');
  }
}

// ─── API Response Types ───────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
  dpi_mode: string;
  ndpi_reader?: string;
  ml_trained_model: boolean;
  ai_provider: string;
  ai_model: string;
  ai_key_configured: boolean;
  flows_loaded: number;
  /** Not served by the current backend; present only on deployments that add it. */
  version?: string;
  alerts_loaded?: number;
  jobs_run?: number;
  ai_last_error?: string | null;
}

export interface CanonicalFlow {
  flow_id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  source_port?: number | null;
  destination_port?: number | null;
  transport?: string;
  application?: string;
  packets: number;
  bytes: number;
  duration_seconds: number;
  ndpi_risks: string[];
  metadata: Record<string, any>;
  ml_detection?: Record<string, any>;
}

export type SeverityKey = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CanonicalAlert {
  id: string;
  alert_id: string;
  title: string;
  description?: string;
  /** Always lowercase — normalized at the boundary by `normalizeAlert`. */
  severity: SeverityKey;
  risk_score: number;
  flow_id: string;
  source_ip?: string;
  destination_ip?: string;
  timestamp?: string;
  category?: string;
  evidence?: any[];
  /** Aliases the backend projects onto every alert for table rendering. */
  entity?: string;
  type?: string;
  risk?: number;
  time?: string;
  incident_id?: string | null;
  finding_ids?: string[];
}

/**
 * The backend speaks UPPERCASE severity; every component here compares against
 * lowercase. Normalizing once at the boundary keeps that mismatch from having
 * to be remembered at each of the call sites.
 */
export function normalizeAlert(raw: any): CanonicalAlert {
  return {
    ...raw,
    id: raw.id ?? raw.alert_id,
    alert_id: raw.alert_id ?? raw.id,
    severity: String(raw.severity ?? 'info').toLowerCase() as SeverityKey,
  };
}

export interface RawBackendGraphNode {
  id: string;
  label?: string;
  kind?: 'internal' | 'service' | 'external' | 'unknown';
  risk?: number;
  flow_count?: number;
  ip?: string;
  role?: string;
  type?: string;
}

export interface RawBackendGraphEdge {
  id: string;
  source: string;
  target: string;
  flow_ids: string[];
  application?: string;
  bytes: number;
  packets: number;
  risk: number;
  severity?: string;
}

export interface BackendGraphResponse {
  nodes: RawBackendGraphNode[];
  edges: RawBackendGraphEdge[];
}

export interface AnalysisJob {
  job_id: string;
  filename: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  message: string;
  summary: Record<string, any>;
  created_at: string;
  /** Not served by the current backend. */
  kind?: string;
  stage?: string;
  progress?: number;
  errors?: string[];
}

export interface GraphEntity {
  id: string;
  name: string;
  label: string;
  kind: 'internal' | 'service' | 'external' | 'unknown';
  type: string;
  risk: number;
  flow_count: number;
  connections: number;
  central: boolean;
}

// ─── Canonical Endpoints (PRD Section 7) ──────────────────────────────────

/** GET /api/health */
export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/api/health');
}

/** GET /api/dashboard */
export async function getDashboard(): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/dashboard');
}

/** GET /api/flows */
export async function getFlows(): Promise<CanonicalFlow[]> {
  return fetchApi<CanonicalFlow[]>('/api/flows');
}

/** GET /api/flows/{flow_id} */
export async function getFlowDetail(flowId: string): Promise<CanonicalFlow> {
  return fetchApi<CanonicalFlow>(`/api/flows/${flowId}`);
}

/** GET /api/network/graph */
export async function getNetworkGraph(): Promise<BackendGraphResponse> {
  return fetchApi<BackendGraphResponse>('/api/network/graph');
}

/** GET /api/entities */
export async function getEntities(): Promise<GraphEntity[]> {
  return fetchApi<GraphEntity[]>('/api/entities');
}

/** Same call, split the way the host/destination panels read it. */
export async function getEntitiesSplit(): Promise<{ hosts: GraphEntity[]; destinations: GraphEntity[] }> {
  const all = await getEntities();
  return {
    hosts: all.filter((e) => e.kind === 'internal' || e.kind === 'service'),
    destinations: all.filter((e) => e.kind === 'external'),
  };
}

/** GET /api/alerts */
export async function getAlerts(): Promise<CanonicalAlert[]> {
  return (await fetchApi<any[]>('/api/alerts')).map(normalizeAlert);
}

/** GET /api/alerts/{id} */
export async function getAlertDetail(alertId: string): Promise<{ alert: CanonicalAlert; flow: CanonicalFlow | null; ai?: any }> {
  const res = await fetchApi<any>(`/api/alerts/${alertId}`);
  return { ...res, alert: normalizeAlert(res.alert) };
}

/** POST /api/alerts/{id}/explain */
export async function explainAlert(alertId: string): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>(`/api/alerts/${alertId}/explain`, {
    method: 'POST',
  });
}

/** POST /api/ai/ask */
export async function askAI(question: string): Promise<{ answer: string; evidence_used?: any[] }> {
  return fetchApi<{ answer: string; evidence_used?: any[] }>('/api/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

/** POST /api/ai/report */
export async function generateReport(title = 'NetSentinel Incident Report'): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/ai/report', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

/** POST /api/pathfinder */
export async function findPath(fromIp: string, toIp: string): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/pathfinder', {
    method: 'POST',
    body: JSON.stringify({ from: fromIp, to: toIp }),
  });
}

/** POST /api/analyze/pcap */
export async function uploadPcap(file: File): Promise<AnalysisJob> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/analyze/pcap`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail || 'Upload failed');
  }

  return res.json() as Promise<AnalysisJob>;
}

/** GET /api/jobs */
export async function getJobs(): Promise<AnalysisJob[]> {
  return fetchApi<AnalysisJob[]>('/api/jobs');
}

/** POST /api/jobs/{id}/load */
export async function loadJob(jobId: string): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>(`/api/jobs/${jobId}/load`, {
    method: 'POST',
  });
}

/** POST /api/agent/ingest */
export async function ingestAgentFlows(
  flows: any[],
  clientId = 'dashboard',
  apiKey = process.env.NEXT_PUBLIC_AGENT_KEY ?? ''
): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/agent/ingest', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, api_key: apiKey, flows }),
  });
}
