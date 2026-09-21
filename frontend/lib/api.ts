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
  version: string;
  dpi_mode: string;
  ndpi_reader?: string;
  ml_trained_model: boolean;
  ai_provider: string;
  ai_model: string;
  ai_key_configured: boolean;
  flows_loaded: number;
  alerts_loaded: number;
  jobs_run: number;
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

export interface CanonicalAlert {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  risk_score: number;
  flow_id: string;
  source_ip?: string;
  destination_ip?: string;
  timestamp?: string;
  category?: string;
  evidence?: any[];
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
  kind: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  stage: string;
  progress: number;
  message: string;
  summary: Record<string, any>;
  errors: string[];
  created_at: string;
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
export async function getEntities(): Promise<{ hosts: any[]; destinations: any[] }> {
  return fetchApi<{ hosts: any[]; destinations: any[] }>('/api/entities');
}

/** GET /api/alerts */
export async function getAlerts(): Promise<CanonicalAlert[]> {
  return fetchApi<CanonicalAlert[]>('/api/alerts');
}

/** GET /api/alerts/{id} */
export async function getAlertDetail(alertId: string): Promise<{ alert: CanonicalAlert; flow: CanonicalFlow | null; ai?: any }> {
  return fetchApi<{ alert: CanonicalAlert; flow: CanonicalFlow | null; ai?: any }>(`/api/alerts/${alertId}`);
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
export async function ingestAgentFlows(flows: any[]): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/agent/ingest', {
    method: 'POST',
    body: JSON.stringify({ flows }),
  });
}

/** POST /api/demo/load */
export async function loadDemo(): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/demo/load', { method: 'POST' });
}

/** POST /api/store/clear */
export async function clearStore(): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/store/clear', { method: 'POST' });
}

// ─── Captures ─────────────────────────────────────────────────────────────

export interface BackendCapture {
  id: string;
  type: string;
  status: string;
  sensor_id: string;
  sensor_name: string;
  filename: string;
  start_time: string;
  size_bytes: number;
  sha256: string;
  flows: number;
  alerts: number;
  created_at: string;
  summary: Record<string, any>;
  flow_list?: any[];
  alert_list?: any[];
}

/** GET /api/captures */
export async function getCaptures(): Promise<BackendCapture[]> {
  return fetchApi<BackendCapture[]>('/api/captures');
}

/** GET /api/captures/{id} */
export async function getCaptureDetail(id: string): Promise<BackendCapture> {
  return fetchApi<BackendCapture>(`/api/captures/${id}`);
}

// ─── Findings ─────────────────────────────────────────────────────────────

export interface BackendFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: string;
  category: string;
  risk_score: number;
  confidence: number;
  source_ip?: string;
  destination_ip?: string;
  flow_id?: string;
  flow_ids: string[];
  first_seen: string;
  last_seen: string;
  capture_id: string;
  sensor_id: string;
  flow?: any;
  ai_explanation?: any;
}

/** GET /api/findings */
export async function getFindings(): Promise<BackendFinding[]> {
  return fetchApi<BackendFinding[]>('/api/findings');
}

/** GET /api/findings/{id} */
export async function getFindingDetail(id: string): Promise<BackendFinding> {
  return fetchApi<BackendFinding>(`/api/findings/${id}`);
}

// ─── Incidents ────────────────────────────────────────────────────────────

export interface BackendIncident {
  id: string;
  title: string;
  description: string;
  status: string;
  risk_score: number;
  confidence: number;
  source_ips: string[];
  finding_ids: string[];
  capture_id: string;
  sensor_ids: string[];
  first_seen: string;
  last_seen: string;
  alert_count: number;
  findings?: any[];
}

/** GET /api/incidents */
export async function getIncidents(): Promise<BackendIncident[]> {
  return fetchApi<BackendIncident[]>('/api/incidents');
}

/** GET /api/incidents/{id} */
export async function getIncidentDetail(id: string): Promise<BackendIncident> {
  return fetchApi<BackendIncident>(`/api/incidents/${id}`);
}

// ─── Sensors ──────────────────────────────────────────────────────────────

export interface BackendSensor {
  id: string;
  name: string;
  hostname: string;
  os: string;
  version: string;
  interface: string;
  status: 'online' | 'degraded' | 'offline';
  last_seen: string;
  capture_engine: Record<string, any>;
  metrics: Record<string, any>;
}

/** GET /api/sensors */
export async function getSensors(): Promise<BackendSensor[]> {
  return fetchApi<BackendSensor[]>('/api/sensors');
}

/** GET /api/sensors/{id} */
export async function getSensorDetail(id: string): Promise<BackendSensor> {
  return fetchApi<BackendSensor>(`/api/sensors/${id}`);
}

// ─── Timeline ─────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: 'alert' | 'capture' | 'info';
  timestamp: string;
  title: string;
  description: string;
  severity: string;
  risk_score: number;
  source_ip?: string;
  destination_ip?: string;
  flow_id?: string;
}

/** GET /api/timeline */
export async function getTimeline(): Promise<TimelineEvent[]> {
  return fetchApi<TimelineEvent[]>('/api/timeline');
}

// ─── Notifications ────────────────────────────────────────────────────────

export interface BackendNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

/** GET /api/notifications */
export async function getNotifications(): Promise<BackendNotification[]> {
  return fetchApi<BackendNotification[]>('/api/notifications');
}

// ─── System Health ────────────────────────────────────────────────────────

export interface SystemHealthResponse {
  overall: string;
  timestamp: string;
  components: Array<{
    name: string;
    status: string;
    latency_ms: number;
    details: string;
  }>;
}

/** GET /api/system/health */
export async function getSystemHealthFull(): Promise<SystemHealthResponse> {
  return fetchApi<SystemHealthResponse>('/api/system/health');
}

/** GET /api/ai/providers */
export async function getAIProviders(): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/ai/providers');
}

/** POST /api/ai/providers */
export async function switchAIProvider(provider: string): Promise<Record<string, any>> {
  return fetchApi<Record<string, any>>('/api/ai/providers', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}
