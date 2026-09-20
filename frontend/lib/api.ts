/**
 * The single typed client for the NetSentinel backend.
 *
 * Every backend call in the app goes through this module. Components render
 * state; they do not build URLs or re-map responses, so a contract change has
 * one place to land.
 *
 * The types below mirror what the backend actually serves (snake_case, as sent
 * over the wire). They deliberately do not reuse `lib/types.ts`, which models a
 * richer product domain — sensors, engagements, per-flow capture ids — that the
 * API does not return. Mapping into it would mean inventing those fields.
 */

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')

/** How long any single request may hang before it becomes a retryable error. */
const TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────────────────────────────────────
// Wire types — PRD §6 canonical contract
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type Flow = {
  flow_id: string
  timestamp: string
  source_ip: string
  destination_ip: string
  source_port?: number | null
  destination_port?: number | null
  transport?: string
  application?: string
  packets: number
  bytes: number
  duration_seconds: number
  ndpi_risks: string[]
  metadata: Record<string, unknown>
  ml_detection?: Record<string, unknown>
}

export type GraphNode = {
  id: string
  name: string
  label: string
  type: string
  kind: 'internal' | 'service' | 'external' | 'unknown'
  risk: number
  flow_count: number
  central: boolean
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  application: string
  flow_ids: string[]
  bytes: number
  packets: number
  risk: number
  severity: Severity | null
  suspicious: boolean
}

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

export type Entity = GraphNode & { connections: number }

export type Alert = {
  alert_id: string
  flow_id: string
  title: string
  severity: Severity
  risk_score: number
  confidence: number
  evidence: string[]
  category: string
  rule_ids: string[]
  finding_ids: string[]
  incident_id?: string | null
  created_at: string
  entity: string
  type: string
  time: string
}

export type Incident = {
  incident_id: string
  title: string
  severity: Severity
  risk: number
  confidence: number
  status: string
  primary_host: string | null
  primary_destination: string | null
  finding_ids: string[]
  behavior_families: string[]
  narrative: string[]
  root_hypothesis: string
  recommendations: string[]
  readiness: string
  created_at: string
  [key: string]: unknown
}

export type Finding = {
  finding_id: string
  severity: Severity
  risk: number
  summary: string
  category: string
  related_flows: string[]
  [key: string]: unknown
}

export type DashboardSummary = {
  total_flows: number
  suspicious_flows: number
  high_risk: number
  protocols: number
  incidents: number
  risk_distribution: Record<Severity, number>
  protocol_distribution: Record<string, number>
  recent_alerts: Alert[]
  top_incidents: Incident[]
  capture?: { capture_id: string; dpi_mode: string; [key: string]: unknown }
}

export type Health = {
  status: string
  service: string
  dpi_mode: string
  ml_trained_model: boolean
  ai_provider: string
  ai_key_configured: boolean
  ai_last_error: string | null
  flows_loaded: number
}

export type Job = {
  job_id: string
  filename: string
  status: string
  message: string
  created_at: string
  summary?: DashboardSummary
}

export type AiAnswer = { answer?: string; provider?: string; [key: string]: unknown }

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A failed call, carrying a cause the UI can show verbatim (PRD §7).
 * `status` is 0 when the request never reached the backend at all, which is
 * the "backend is down" state rather than a rejected request.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly path: string
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** True when the backend could not be reached, as opposed to refusing. */
  get offline(): boolean {
    return this.status === 0
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (cause) {
    const reason =
      cause instanceof DOMException && cause.name === 'TimeoutError'
        ? `No response within ${TIMEOUT_MS / 1000}s`
        : `Cannot reach the API at ${BASE}`
    throw new ApiError(0, reason, path)
  }

  if (!response.ok) {
    // FastAPI puts the human-readable cause in `detail`; fall back to the
    // status text so the UI never has to show a bare number.
    let detail = response.statusText
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body — statusText is the best we have */
    }
    throw new ApiError(response.status, detail, path)
  }

  return response.json() as Promise<T>
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoints — the canonical list in PRD §7
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  health: () => request<Health>('/api/health'),
  dashboard: () => request<DashboardSummary>('/api/dashboard'),

  flows: () => request<Flow[]>('/api/flows'),
  flow: (flowId: string) => request<Flow>(`/api/flows/${encodeURIComponent(flowId)}`),

  graph: () => request<Graph>('/api/network/graph'),
  entities: () => request<Entity[]>('/api/entities'),

  alerts: () => request<Alert[]>('/api/alerts'),
  alert: (alertId: string) =>
    request<{ alert: Alert; flow?: Flow; findings: Finding[]; incident?: Incident }>(
      `/api/alerts/${encodeURIComponent(alertId)}`
    ),
  explainAlert: (alertId: string) =>
    post<Record<string, unknown>>(`/api/alerts/${encodeURIComponent(alertId)}/explain`),

  findings: () => request<Finding[]>('/api/findings'),
  incidents: () => request<Incident[]>('/api/incidents'),
  incident: (incidentId: string) =>
    request<{ incident: Incident; findings: Finding[] }>(
      `/api/incidents/${encodeURIComponent(incidentId)}`
    ),

  ask: (question: string) => post<AiAnswer>('/api/ai/ask', { question }),
  report: () => post<Record<string, unknown>>('/api/ai/report'),

  pathfinder: (from: string, to: string) =>
    post<{ path: { name: string; type: string; risk: number }[]; hops: number; suspicious: number }>(
      '/api/pathfinder',
      { from, to }
    ),

  jobs: () => request<Job[]>('/api/jobs'),
  loadJob: (jobId: string) =>
    post<{ job_id: string; loaded: boolean; summary: DashboardSummary }>(
      `/api/jobs/${encodeURIComponent(jobId)}/load`
    ),

  uploadPcap: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // No Content-Type header on purpose: the browser must set the multipart
    // boundary itself.
    return request<Job>('/api/analyze/pcap', { method: 'POST', body: form })
  },
}

export const apiBaseUrl = BASE
