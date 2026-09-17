/**
 * NetSentinal AI — Backend API client
 *
 * The one place that talks to the FastAPI backend and translates its JSON
 * into the frontend's types (`lib/types.ts`). Everything above this layer
 * stays identical whether data is live or from the mock fallback.
 *
 * Shape notes (backend alert/finding/incident fields are snake_case and are
 * renamed here, not in every page):
 *   alert    → Finding-ish: { alert_id, flow_id, title, severity, risk_score,
 *              confidence, evidence[], category, behavior_family, rule_ids }
 *   finding  → { finding_id, category, summary, severity, risk, confidence,
 *              observed_facts[], supporting_features{}, related_flows[] }
 *   incident → { incident_id, title, severity, risk, confidence, status,
 *              primary_host, primary_destination, finding_ids[], entity_ids[],
 *              started_at, last_activity_at }
 *   graph    → { nodes: [{id, name, type, kind, risk, central}], links: [...] }
 */

import type {
  Capture,
  Destination,
  Flow,
  Finding,
  FindingCategory,
  FindingSeverity,
  Host,
  Incident,
  IncidentStatus,
  NetworkService,
  SystemHealth,
  TimelineEvent,
} from './types'

// The FastAPI dev server. Vite/Next dev traffic to /api/* is proxied by
// next.config.ts rewrites; this absolute fallback covers direct calls.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** True once a live call has succeeded this session. Mock fallback before that. */
let backendUp = false
export const isBackendUp = () => backendUp

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api${path}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new ApiError(res.status, `${path}: HTTP ${res.status}`)
    backendUp = true
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    backendUp = false
    return null // backend unreachable — callers fall back to mock
  }
}

async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) throw new ApiError(res.status, `${path}: HTTP ${res.status}`)
    backendUp = true
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    backendUp = false
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers: backend snake_case → frontend camelCase types
// ─────────────────────────────────────────────────────────────────────────────

type Severity = string | undefined

/** Backend emits INFO/LOW/MEDIUM/HIGH/CRITICAL; pages expect lowercase. */
export const sev = (s: Severity): FindingSeverity => {
  switch ((s ?? '').toUpperCase()) {
    case 'CRITICAL': return 'critical'
    case 'HIGH': return 'high'
    case 'MEDIUM': return 'medium'
    case 'LOW': return 'low'
    default: return 'info'
  }
}

const CATEGORY_MAP: Record<string, FindingCategory> = {
  BEACONING: 'beaconing',
  DNS_TUNNELING: 'dns_tunneling',
  DATA_EXFILTRATION: 'data_exfiltration',
  LATERAL_MOVEMENT: 'lateral_movement',
  PORT_SCAN: 'port_scan',
  UNUSUAL_PROTOCOL: 'unusual_protocol',
  NEW_DESTINATION: 'new_destination',
  TRAFFIC_ANOMALY: 'volume_anomaly',
  DENIAL_OF_SERVICE: 'volume_anomaly',
  BRUTE_FORCE: 'other',
  SUSPICIOUS_LEGACY_SERVICE: 'rare_port',
}

export const category = (c: Severity): FindingCategory => CATEGORY_MAP[(c ?? '').toUpperCase()] ?? 'other'

const STATUS_MAP: Record<string, IncidentStatus> = {
  NEW: 'open',
  INVESTIGATING: 'investigating',
  CONTAINED: 'contained',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
}

export interface BackendAlert {
  alert_id: string
  flow_id: string
  title: string
  severity: string
  risk_score: number
  confidence: number
  evidence: string[]
  category: string
  behavior_family?: string
  rule_ids: string[]
  entity?: string
  incident_id?: string
  time?: string
}

export interface BackendFinding {
  finding_id: string
  category: string
  summary: string
  severity: string
  risk: number
  confidence: number
  status: string
  incident_id?: string
  first_seen: string
  last_seen: string
  behavior_family?: string
  rule_ids?: string[]
  observed_facts?: string[]
  supporting_features?: Record<string, unknown>
  related_flows?: string[]
  entity_ids?: string[]
}

export interface BackendIncident {
  incident_id: string
  title: string
  severity: string
  risk: number
  confidence: number
  status: string
  started_at: string
  last_activity_at: string
  primary_host?: string
  primary_destination?: string
  finding_ids: string[]
  entity_ids: string[]
  behavior_families?: string[]
}

export interface BackendFlow {
  flow_id: string
  source_ip: string
  source_port: number
  destination_ip: string
  destination_port: number
  protocol: string
  application?: string
  packets: number
  bytes: number
  duration_seconds?: number
  first_seen?: string
  last_seen?: string
  risk_score?: number
  metadata?: Record<string, unknown>
  ml_detection?: Record<string, unknown>
}

/** alert (backend) → Finding (frontend). Alerts are the working list of findings. */
export function alertToFinding(a: BackendAlert): Finding {
  return {
    id: a.alert_id,
    title: a.title,
    description: (a.evidence ?? []).join(' '),
    severity: sev(a.severity),
    status: 'open',
    category: category(a.category),
    riskScore: a.risk_score ?? 0,
    confidence: (a.confidence ?? 0) / 100,
    hostIds: a.entity ? [a.entity] : [],
    destinationIds: [],
    triggerIds: [],
    flowIds: [a.flow_id],
    evidenceIds: [],
    incidentId: a.incident_id,
    firstSeen: a.time ?? new Date().toISOString(),
    lastSeen: a.time ?? new Date().toISOString(),
  }
}

export function findingFromBackend(f: BackendFinding): Finding {
  const features = f.supporting_features ?? {}
  const host = (f.entity_ids ?? [])[0] ?? ''
  const dest = (f.entity_ids ?? [])[1] ?? ''
  return {
    id: f.finding_id,
    title: f.summary,
    description: (f.observed_facts ?? []).join(' '),
    severity: sev(f.severity),
    status: 'open',
    category: category(f.category),
    riskScore: f.risk ?? 0,
    confidence: f.confidence ?? 0,
    hostIds: host ? [host] : [],
    destinationIds: dest ? [dest] : [],
    triggerIds: f.rule_ids ?? [],
    flowIds: f.related_flows ?? [],
    evidenceIds: [],
    incidentId: f.incident_id,
    firstSeen: f.first_seen,
    lastSeen: f.last_seen,
  }
}

export function incidentFromBackend(i: BackendIncident): Incident {
  return {
    id: i.incident_id,
    title: i.title,
    description: i.title,
    status: STATUS_MAP[(i.status ?? '').toUpperCase()] ?? 'open',
    riskScore: i.risk ?? 0,
    confidence: i.confidence ?? 0,
    hostIds: [i.primary_host, ...(i.entity_ids ?? []).filter(e => e !== i.primary_host)]
      .filter((h): h is string => Boolean(h)),
    findingIds: i.finding_ids ?? [],
    captureIds: [],
    sensorIds: [],
    firstSeen: i.started_at,
    lastSeen: i.last_activity_at,
  }
}

export function flowFromBackend(f: BackendFlow): Flow {
  const risk = f.risk_score ?? 0
  return {
    id: f.flow_id,
    timestamp: f.first_seen ?? new Date().toISOString(),
    srcIp: f.source_ip,
    srcPort: f.source_port,
    dstIp: f.destination_ip,
    dstPort: f.destination_port,
    protocol: (f.protocol ?? 'UNKNOWN').toUpperCase(),
    application: f.application,
    packets: f.packets ?? 0,
    bytes: f.bytes ?? 0,
    duration: f.duration_seconds ?? 0,
    riskScore: risk,
    risk: risk >= 85 ? 'critical' : risk >= 65 ? 'high' : risk >= 35 ? 'medium' : risk > 0 ? 'low' : 'none',
    captureId: '',
    sensorId: '',
    features: f.metadata as Record<string, number | string> | undefined,
    relatedFindings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed endpoints used by lib/mock/services.ts (and nowhere else)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAlerts = () =>
  get<BackendAlert[]>('/alerts')

export const fetchFinding = (id: string) =>
  get<BackendFinding>(`/findings`) // list, filtered by caller

export const fetchFindings = () =>
  get<BackendFinding[]>('/findings')

export const fetchIncidents = () =>
  get<BackendIncident[]>('/incidents')

export const fetchIncident = (id: string) =>
  get<{ incident: BackendIncident; findings: BackendFinding[] }>(`/incidents/${id}`)

export const fetchFlows = () =>
  get<BackendFlow[]>('/flows')

export const fetchFlow = (id: string) =>
  get<BackendFlow>(`/flows/${id}`)

export const fetchDashboard = () =>
  get<Record<string, unknown>>('/dashboard')

export const fetchEntities = () =>
  get<Array<{ id: string; name: string; kind: string; risk: number; central: boolean; connections?: number }>>('/entities')

export interface GraphNode {
  id: string
  name: string
  type: string
  kind: string
  risk: number
  central: boolean
}

export interface GraphLink {
  source: string
  target: string
  suspicious: boolean
  weight?: number
}

export const fetchGraph = () =>
  get<{ nodes: GraphNode[]; links: GraphLink[] }>('/network/graph')

export const fetchHealth = () =>
  get<Record<string, unknown>>('/health')

export const fetchJobs = () =>
  get<Array<{ job_id: string; filename: string; status: string; message: string; created_at: string; summary: Record<string, unknown> }>>('/jobs')

export const loadJob = (id: string) =>
  post<{ job_id: string; summary: Record<string, unknown> }>(`/jobs/${id}/load`)

export const explainAlert = (id: string) =>
  post<Record<string, unknown>>(`/alerts/${id}/explain`)

export const aiAsk = (question: string) =>
  post<{ answer: string; evidence: string[]; provider: string }>('/ai/ask', { question })

export const aiReport = () =>
  post<Record<string, unknown>>('/ai/report')

export const pathfind = (from: string, to: string) =>
  post<{ path: Array<{ name: string; type: string }>; hops: number; suspicious: number }>('/pathfinder', { from, to })

export async function analyzePcap(file: File): Promise<Record<string, unknown> | null> {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`${API_BASE}/api/analyze/pcap`, { method: 'POST', body: form })
    if (!res.ok) throw new ApiError(res.status, await res.text())
    backendUp = true
    return await res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    backendUp = false
    return null
  }
}
