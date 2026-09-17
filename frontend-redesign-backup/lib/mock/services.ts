/**
 * NetSentinal AI — Mock Service Layer
 *
 * Async service functions that simulate API calls with realistic latency.
 * Each function returns a Promise that resolves after a configurable delay.
 *
 * Usage:
 *   const sensor = await getSensor('SNS-042')
 *   const findings = await getFindings({ severity: 'high' })
 *
 * In production, swap these for real fetch() calls against the backend API.
 */

import type {
  Customer,
  Engagement,
  Sensor,
  SensorMetrics,
  Capture,
  CaptureSegment,
  Trigger,
  Host,
  Destination,
  NetworkService,
  Flow,
  Finding,
  Incident,
  TimelineEvent,
  Evidence,
  Investigation,
  Report,
  SystemHealth,
  AppNotification,
  SearchResult,
  ListFilters,
} from '../types'

import {
  fetchAlerts,
  fetchFindings,
  fetchIncidents,
  fetchIncident,
  fetchFlows,
  fetchFlow,
  fetchEntities,
  fetchGraph,
  fetchHealth,
  alertToFinding,
  findingFromBackend,
  incidentFromBackend,
  flowFromBackend,
} from '../api'


import {
  MOCK_CUSTOMER,
  MOCK_ENGAGEMENT,
  MOCK_SENSORS,
  MOCK_SENSOR_MAP,
  MOCK_CAPTURES,
  MOCK_CAPTURE_MAP,
  MOCK_CAPTURE_SEGMENTS,
  MOCK_TRIGGERS,
  MOCK_TRIGGER_MAP,
  MOCK_HOSTS,
  MOCK_HOST_MAP,
  MOCK_DESTINATIONS,
  MOCK_DESTINATION_MAP,
  MOCK_NETWORK_SERVICES,
  MOCK_FLOWS,
  MOCK_FLOW_MAP,
  MOCK_FINDINGS,
  MOCK_FINDING_MAP,
  MOCK_INCIDENTS,
  MOCK_INCIDENT_MAP,
  MOCK_TIMELINE_EVENTS,
  MOCK_EVIDENCE,
  MOCK_EVIDENCE_MAP,
  MOCK_INVESTIGATIONS,
  MOCK_INVESTIGATION_MAP,
  MOCK_REPORTS,
  MOCK_REPORT_MAP,
  MOCK_SYSTEM_HEALTH,
  MOCK_NOTIFICATIONS,
} from './data'

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates a network request delay.
 * @param min - Minimum delay in ms (default 50)
 * @param max - Maximum delay in ms (default 150)
 */
function delay(min = 50, max = 150): Promise<void> {
  // Use deterministic mid-point for SSR compatibility
  const ms = Math.floor((min + max) / 2)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Simulates a "not found" API error.
 */
class NotFoundError extends Error {
  readonly status = 404
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

/**
 * Applies common list filters to an array of items.
 */
function applyFilters<T extends Record<string, unknown>>(
  items: T[],
  filters?: Partial<ListFilters>
): T[] {
  if (!filters) return items

  let result = [...items]

  if (filters.customerId) {
    result = result.filter(item => item['customerId'] === filters.customerId)
  }
  if (filters.engagementId) {
    result = result.filter(item => item['engagementId'] === filters.engagementId)
  }
  if (filters.sensorId) {
    result = result.filter(item => item['sensorId'] === filters.sensorId)
  }
  if (filters.captureId) {
    result = result.filter(item => item['captureId'] === filters.captureId)
  }
  if (filters.incidentId) {
    result = result.filter(item => {
      const incidentId = item['incidentId']
      const incidentIds = item['incidentIds']
      if (Array.isArray(incidentIds)) return incidentIds.includes(filters.incidentId)
      return incidentId === filters.incidentId
    })
  }
  if (filters.findingId) {
    result = result.filter(item => {
      const findingIds = item['findingIds']
      const findingId = item['findingId']
      if (Array.isArray(findingIds)) return findingIds.includes(filters.findingId)
      return findingId === filters.findingId
    })
  }
  if (filters.severity) {
    result = result.filter(item => item['severity'] === filters.severity)
  }
  if (filters.status) {
    result = result.filter(item => item['status'] === filters.status)
  }
  if (filters.from) {
    const fromTs = new Date(filters.from).getTime()
    result = result.filter(item => {
      const ts = item['timestamp'] ?? item['firstSeen'] ?? item['startTime'] ?? item['createdAt']
      return ts ? new Date(ts as string).getTime() >= fromTs : true
    })
  }
  if (filters.to) {
    const toTs = new Date(filters.to).getTime()
    result = result.filter(item => {
      const ts = item['timestamp'] ?? item['firstSeen'] ?? item['startTime'] ?? item['createdAt']
      return ts ? new Date(ts as string).getTime() <= toTs : true
    })
  }
  if (filters.limit !== undefined) {
    const offset = filters.offset ?? 0
    result = result.slice(offset, offset + filters.limit)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer & Engagement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a customer by ID.
 * @throws NotFoundError if the customer does not exist.
 */
export async function getCustomer(id: string): Promise<Customer> {
  await delay(50, 100)
  if (id !== MOCK_CUSTOMER.id) throw new NotFoundError('Customer', id)
  return { ...MOCK_CUSTOMER }
}

/**
 * Fetches an engagement by ID.
 * @throws NotFoundError if the engagement does not exist.
 */
export async function getEngagement(id: string): Promise<Engagement> {
  await delay(50, 100)
  if (id !== MOCK_ENGAGEMENT.id) throw new NotFoundError('Engagement', id)
  return { ...MOCK_ENGAGEMENT }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all sensors, optionally filtered by customer ID.
 */
export async function getSensors(customerId?: string): Promise<Sensor[]> {
  await delay(50, 120)
  const sensors = customerId
    ? MOCK_SENSORS.filter(s => s.customerId === customerId)
    : MOCK_SENSORS
  return sensors.map(s => ({ ...s }))
}

/**
 * Fetches a single sensor by ID.
 * @throws NotFoundError if the sensor does not exist.
 */
export async function getSensor(id: string): Promise<Sensor> {
  await delay(50, 100)
  const sensor = MOCK_SENSOR_MAP[id]
  if (!sensor) throw new NotFoundError('Sensor', id)
  return { ...sensor }
}

/**
 * Fetches live metrics for a sensor.
 * In production, this would be a real-time websocket subscription or SSE endpoint.
 * @throws NotFoundError if the sensor does not exist.
 */
export async function getSensorMetrics(id: string): Promise<SensorMetrics> {
  await delay(30, 80)
  const sensor = MOCK_SENSOR_MAP[id]
  if (!sensor) throw new NotFoundError('Sensor', id)
  return { ...sensor.metrics }
}

// ─────────────────────────────────────────────────────────────────────────────
// Captures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists captures with optional filtering.
 */
export async function getCaptures(filters?: Partial<ListFilters>): Promise<Capture[]> {
  await delay(80, 160)
  return applyFilters(MOCK_CAPTURES as unknown as Record<string, unknown>[], filters) as unknown as Capture[]
}

/**
 * Fetches a single capture by ID.
 * @throws NotFoundError if the capture does not exist.
 */
export async function getCapture(id: string): Promise<Capture> {
  await delay(50, 100)
  const capture = MOCK_CAPTURE_MAP[id]
  if (!capture) throw new NotFoundError('Capture', id)
  return { ...capture }
}

/**
 * Lists segments for a given capture (for streaming / chunked download UI).
 */
export async function getCaptureSegments(captureId: string): Promise<CaptureSegment[]> {
  await delay(60, 120)
  return MOCK_CAPTURE_SEGMENTS.filter(s => s.captureId === captureId).map(s => ({ ...s }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists triggers with optional filtering.
 */
export async function getTriggers(filters?: Partial<ListFilters>): Promise<Trigger[]> {
  await delay(60, 130)
  let results = [...MOCK_TRIGGERS]
  if (filters?.captureId) {
    results = results.filter(t => t.captureId === filters.captureId)
  }
  if (filters?.severity) {
    results = results.filter(t => t.severity === filters.severity)
  }
  if (filters?.status) {
    results = results.filter(t => t.status === filters.status)
  }
  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }
  return results.map(t => ({ ...t }))
}

/**
 * Fetches a single trigger by ID.
 * @throws NotFoundError if the trigger does not exist.
 */
export async function getTrigger(id: string): Promise<Trigger> {
  await delay(50, 100)
  const trigger = MOCK_TRIGGER_MAP[id]
  if (!trigger) throw new NotFoundError('Trigger', id)
  return { ...trigger }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hosts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all hosts observed in a customer's captures.
 */
export async function getHosts(_customerId?: string): Promise<Host[]> {
  // The backend exposes hosts as graph nodes, so derive them from there.
  const graph = await fetchGraph()
  if (graph && graph.nodes.length) {
    return graph.nodes
      .filter(n => n.kind === 'internal')
      .map(n => ({
        id: n.id,
        ip: n.id,
        internal: true,
        customerId: '',
        riskScore: n.risk ?? 0,
        findings: [],
        flows: 0,
        bytesIn: 0,
        bytesOut: 0,
        firstSeen: '',
        lastSeen: '',
      }))
  }
  await delay(70, 140)
  return MOCK_HOSTS.map(h => ({ ...h }))
}

/**
 * Fetches a single host by ID.
 * @throws NotFoundError if the host does not exist.
 */
export async function getHost(id: string): Promise<Host> {
  await delay(50, 100)
  const host = MOCK_HOST_MAP[id]
  if (!host) throw new NotFoundError('Host', id)
  return { ...host }
}

// ─────────────────────────────────────────────────────────────────────────────
// Destinations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all external destinations observed.
 */
export async function getDestinations(_customerId?: string): Promise<Destination[]> {
  const graph = await fetchGraph()
  if (graph && graph.nodes.length) {
    return graph.nodes
      .filter(n => n.kind === 'external')
      .map(n => ({
        id: n.id,
        ip: n.id,
        rarity: 'observed' as const,
        riskScore: n.risk ?? 0,
        labels: [],
        hosts: [],
        firstSeen: '',
        lastSeen: '',
        protocols: [],
        findings: [],
      }))
  }
  await delay(70, 140)
  return MOCK_DESTINATIONS.map(d => ({ ...d }))
}

/**
 * Fetches a single destination by ID.
 * @throws NotFoundError if the destination does not exist.
 */
export async function getDestination(id: string): Promise<Destination> {
  await delay(50, 100)
  const dest = MOCK_DESTINATION_MAP[id]
  if (!dest) throw new NotFoundError('Destination', id)
  return { ...dest }
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Services
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all observed network services (open ports) for a customer.
 */
export async function getServices(customerId?: string): Promise<NetworkService[]> {
  await delay(70, 130)
  void customerId
  return MOCK_NETWORK_SERVICES.map(s => ({ ...s }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Flows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists flow records with optional filtering.
 * Returns flows sorted by timestamp ascending.
 */
export async function getFlows(filters?: Partial<ListFilters & {
  srcIp?: string
  dstIp?: string
  minRiskScore?: number
  protocol?: string
}>): Promise<Flow[]> {
  const live = await fetchFlows()
  if (live && live.length) {
    let results = live.map(flowFromBackend)
    const fl = filters as { srcIp?: string; dstIp?: string; minRiskScore?: number; protocol?: string }
    if (fl?.srcIp) results = results.filter(f => f.srcIp === fl.srcIp)
    if (fl?.dstIp) results = results.filter(f => f.dstIp === fl.dstIp)
    if (fl?.minRiskScore !== undefined) results = results.filter(f => f.riskScore >= (fl.minRiskScore as number))
    if (fl?.protocol) {
      const proto = (fl.protocol as string).toUpperCase()
      results = results.filter(f => f.protocol.toUpperCase() === proto || f.application?.toUpperCase().includes(proto))
    }
    results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    if (filters?.limit !== undefined) {
      const offset = filters.offset ?? 0
      results = results.slice(offset, offset + filters.limit)
    }
    return results
  }
  await delay(100, 200)
  let results = [...MOCK_FLOWS]

  if (filters?.captureId) {
    results = results.filter(f => f.captureId === filters.captureId)
  }
  if (filters?.sensorId) {
    results = results.filter(f => f.sensorId === filters.sensorId)
  }
  if (filters?.incidentId) {
    // Resolve via findings
    const incFindingIds = MOCK_INCIDENTS
      .filter(i => i.id === filters.incidentId)
      .flatMap(i => i.findingIds)
    const flowIds = new Set(
      MOCK_FINDINGS.filter(f => incFindingIds.includes(f.id)).flatMap(f => f.flowIds)
    )
    results = results.filter(f => flowIds.has(f.id))
  }
  if (filters?.findingId) {
    const finding = MOCK_FINDING_MAP[filters.findingId]
    if (finding) {
      const ids = new Set(finding.flowIds)
      results = results.filter(f => ids.has(f.id))
    } else {
      results = []
    }
  }
  if ((filters as { srcIp?: string })?.srcIp) {
    results = results.filter(f => f.srcIp === (filters as { srcIp: string }).srcIp)
  }
  if ((filters as { dstIp?: string })?.dstIp) {
    results = results.filter(f => f.dstIp === (filters as { dstIp: string }).dstIp)
  }
  if ((filters as { minRiskScore?: number })?.minRiskScore !== undefined) {
    const minScore = (filters as { minRiskScore: number }).minRiskScore
    results = results.filter(f => f.riskScore >= minScore)
  }
  if ((filters as { protocol?: string })?.protocol) {
    const proto = ((filters as { protocol: string }).protocol).toUpperCase()
    results = results.filter(f => f.protocol.toUpperCase() === proto || f.application?.toUpperCase().includes(proto))
  }
  if (filters?.from) {
    const fromTs = new Date(filters.from).getTime()
    results = results.filter(f => new Date(f.timestamp).getTime() >= fromTs)
  }
  if (filters?.to) {
    const toTs = new Date(filters.to).getTime()
    results = results.filter(f => new Date(f.timestamp).getTime() <= toTs)
  }

  // Sort by timestamp
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }

  return results.map(f => ({ ...f }))
}

/**
 * Fetches a single flow by ID.
 * @throws NotFoundError if the flow does not exist.
 */
export async function getFlow(id: string): Promise<Flow> {
  const live = await fetchFlow(id)
  if (live) return flowFromBackend(live)
  await delay(50, 100)
  const flow = MOCK_FLOW_MAP[id]
  if (!flow) throw new NotFoundError('Flow', id)
  return { ...flow }
}

// ─────────────────────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists findings with optional filtering.
 * Returns findings sorted by risk score descending.
 */
export async function getFindings(filters?: Partial<ListFilters>): Promise<Finding[]> {
  // Live backend first: alerts are the working list of findings (already
  // risk-sorted server-side). Mock data only when the backend is unreachable.
  const live = await fetchAlerts()
  if (live && live.length) {
    let results = live.map(alertToFinding)
    if (filters?.severity) results = results.filter(f => f.severity === filters.severity)
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      results = results.filter(f => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
    }
    if (filters?.limit !== undefined) {
      const offset = filters.offset ?? 0
      results = results.slice(offset, offset + filters.limit)
    }
    return results
  }
  await delay(80, 160)
  let results = [...MOCK_FINDINGS]

  if (filters?.captureId) {
    results = results.filter(f => f.captureId === filters.captureId)
  }
  if (filters?.sensorId) {
    results = results.filter(f => f.sensorId === filters.sensorId)
  }
  if (filters?.incidentId) {
    results = results.filter(f => f.incidentId === filters.incidentId)
  }
  if (filters?.severity) {
    results = results.filter(f => f.severity === filters.severity)
  }
  if (filters?.status) {
    results = results.filter(f => f.status === filters.status)
  }
  if (filters?.from) {
    const fromTs = new Date(filters.from).getTime()
    results = results.filter(f => new Date(f.firstSeen).getTime() >= fromTs)
  }
  if (filters?.to) {
    const toTs = new Date(filters.to).getTime()
    results = results.filter(f => new Date(f.lastSeen).getTime() <= toTs)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(f =>
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    )
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore)

  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }

  return results.map(f => ({ ...f }))
}

/**
 * Fetches a single finding by ID.
 * @throws NotFoundError if the finding does not exist.
 */
export async function getFinding(id: string): Promise<Finding> {
  // Findings live on the backend; alerts carry the same evidence under a
  // different id, so try both live sources before falling back to mock.
  const liveList = await fetchFindings()
  if (liveList) {
    const hit = liveList.find(f => f.finding_id === id)
    if (hit) return findingFromBackend(hit)
    const alerts = await fetchAlerts()
    const alt = alerts?.find(a => a.alert_id === id)
    if (alt) return alertToFinding(alt)
    throw new NotFoundError('Finding', id)
  }
  await delay(60, 120)
  const finding = MOCK_FINDING_MAP[id]
  if (!finding) throw new NotFoundError('Finding', id)
  return { ...finding }
}

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists incidents with optional filtering.
 * Returns incidents sorted by risk score descending.
 */
export async function getIncidents(filters?: Partial<ListFilters>): Promise<Incident[]> {
  const live = await fetchIncidents()
  if (live && live.length) {
    let results = live.map(incidentFromBackend).sort((a, b) => b.riskScore - a.riskScore)
    if (filters?.status) results = results.filter(i => i.status === filters.status)
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      results = results.filter(i => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    }
    if (filters?.limit !== undefined) {
      const offset = filters.offset ?? 0
      results = results.slice(offset, offset + filters.limit)
    }
    return results
  }
  await delay(80, 150)
  let results = [...MOCK_INCIDENTS]

  if (filters?.status) {
    results = results.filter(i => i.status === filters.status)
  }
  if (filters?.severity) {
    // Map severity to risk score ranges
    const rangeMap: Record<string, [number, number]> = {
      critical: [80, 100],
      high: [60, 79],
      medium: [40, 59],
      low: [0, 39],
    }
    const range = rangeMap[filters.severity]
    if (range) {
      results = results.filter(i => i.riskScore >= range[0] && i.riskScore <= range[1])
    }
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q)
    )
  }

  results.sort((a, b) => b.riskScore - a.riskScore)

  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }

  return results.map(i => ({ ...i }))
}

/**
 * Fetches a single incident by ID.
 * @throws NotFoundError if the incident does not exist.
 */
export async function getIncident(id: string): Promise<Incident> {
  const live = await fetchIncident(id)
  if (live && live.incident) return incidentFromBackend(live.incident)
  await delay(60, 120)
  const incident = MOCK_INCIDENT_MAP[id]
  if (!incident) throw new NotFoundError('Incident', id)
  return { ...incident }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns timeline events, optionally filtered.
 * Events are always returned in chronological order (ascending timestamp).
 */
export async function getTimeline(filters?: Partial<ListFilters & {
  type?: string
  incidentId?: string
  captureId?: string
}>): Promise<TimelineEvent[]> {
  await delay(70, 130)
  let results = [...MOCK_TIMELINE_EVENTS]

  if ((filters as { type?: string })?.type) {
    results = results.filter(e => e.type === (filters as { type: string }).type)
  }
  if (filters?.captureId) {
    results = results.filter(e => e.captureId === filters.captureId)
  }
  if (filters?.incidentId) {
    results = results.filter(e => e.incidentId === filters.incidentId || e.findingId !== undefined)
  }
  if (filters?.from) {
    const fromTs = new Date(filters.from).getTime()
    results = results.filter(e => new Date(e.timestamp).getTime() >= fromTs)
  }
  if (filters?.to) {
    const toTs = new Date(filters.to).getTime()
    results = results.filter(e => new Date(e.timestamp).getTime() <= toTs)
  }

  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }

  return results.map(e => ({ ...e }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists evidence items with optional filtering.
 */
export async function getEvidence(filters?: Partial<ListFilters>): Promise<Evidence[]> {
  await delay(60, 120)
  let results = [...MOCK_EVIDENCE]

  if (filters?.captureId) {
    results = results.filter(e => e.captureId === filters.captureId)
  }
  if (filters?.findingId) {
    results = results.filter(e => e.findingId === filters.findingId)
  }

  if (filters?.limit !== undefined) {
    const offset = filters.offset ?? 0
    results = results.slice(offset, offset + filters.limit)
  }

  return results.map(e => ({ ...e }))
}

/**
 * Fetches a single evidence item by ID.
 * @throws NotFoundError if the evidence item does not exist.
 */
export async function getEvidenceItem(id: string): Promise<Evidence> {
  await delay(50, 100)
  const evidence = MOCK_EVIDENCE_MAP[id]
  if (!evidence) throw new NotFoundError('Evidence', id)
  return { ...evidence }
}

// ─────────────────────────────────────────────────────────────────────────────
// Investigations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all investigations, optionally filtered by customer.
 */
export async function getInvestigations(customerId?: string): Promise<Investigation[]> {
  await delay(70, 140)
  const investigations = customerId
    ? MOCK_INVESTIGATIONS.filter(i => i.customerId === customerId)
    : MOCK_INVESTIGATIONS
  return investigations.map(i => ({ ...i }))
}

/**
 * Fetches a single investigation by ID.
 * @throws NotFoundError if the investigation does not exist.
 */
export async function getInvestigation(id: string): Promise<Investigation> {
  await delay(60, 120)
  const investigation = MOCK_INVESTIGATION_MAP[id]
  if (!investigation) throw new NotFoundError('Investigation', id)
  return { ...investigation }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all reports for a customer.
 */
export async function getReports(customerId?: string): Promise<Report[]> {
  await delay(80, 150)
  const reports = customerId
    ? MOCK_REPORTS.filter(r => r.customerId === customerId)
    : MOCK_REPORTS
  return reports.map(r => ({ ...r }))
}

/**
 * Fetches a single report by ID.
 * @throws NotFoundError if the report does not exist.
 */
export async function getReport(id: string): Promise<Report> {
  await delay(60, 120)
  const report = MOCK_REPORT_MAP[id]
  if (!report) throw new NotFoundError('Report', id)
  return { ...report }
}

// ─────────────────────────────────────────────────────────────────────────────
// System Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current system health status.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const live = await fetchHealth()
  if (live) {
    const up = live['status'] === 'ok'
    const now = new Date().toISOString()
    return {
      overall: up ? 'healthy' : 'degraded',
      timestamp: now,
      components: [
        { name: 'API', status: up ? 'healthy' : 'degraded', lastChecked: now },
        { name: 'DPI engine', status: 'healthy', detail: String(live['dpi_mode'] ?? ''), lastChecked: now },
        { name: 'ML model', status: live['ml_trained_model'] ? 'healthy' : 'degraded', detail: live['ml_trained_model'] ? 'trained artifact loaded' : 'heuristic fallback', lastChecked: now },
        { name: 'AI provider', status: 'healthy', detail: `${live['ai_provider'] ?? 'mock'} / ${live['ai_model'] ?? '-'}`, lastChecked: now },
      ],
    }
  }
  await delay(30, 80)
  return { ...MOCK_SYSTEM_HEALTH }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all in-app notifications for the current consultant.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  await delay(30, 80)
  return MOCK_NOTIFICATIONS.map(n => ({ ...n }))
}

/**
 * Marks a notification as read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  await delay(20, 50)
  const notif = MOCK_NOTIFICATIONS.find(n => n.id === id)
  if (notif) notif.read = true
}

/**
 * Marks all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<void> {
  await delay(30, 80)
  MOCK_NOTIFICATIONS.forEach(n => { n.read = true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Searches across all entity types and returns ranked results.
 *
 * @param query - Search string (case-insensitive partial match)
 * @returns Array of SearchResult items, ranked by relevance
 */
export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const q = query.trim().toLowerCase()

  // Live first: entities and incidents from the backend, mock as fallback.
  const liveEntities = await fetchEntities()
  if (liveEntities) {
    const results: SearchResult[] = []
    for (const e of liveEntities) {
      if (e.id.toLowerCase().includes(q)) {
        results.push({
          type: e.kind === 'external' ? 'destination' : 'host',
          id: e.id,
          title: e.name,
          subtitle: `${e.id} - Risk ${e.risk}`,
          score: e.risk,
          url: `/network/${e.kind === 'external' ? 'destinations' : 'hosts'}/${e.id}`,
        })
      }
    }
    const liveIncs = await fetchIncidents()
    for (const i of liveIncs ?? []) {
      const inc = incidentFromBackend(i)
      if (inc.title.toLowerCase().includes(q) || inc.id.toLowerCase().includes(q)) {
        results.push({
          type: 'incident',
          id: inc.id,
          title: inc.title,
          subtitle: `${inc.id} - ${inc.status} - Risk ${inc.riskScore}`,
          score: inc.riskScore,
          timestamp: inc.lastSeen,
          url: `/incidents/${inc.id}`,
        })
      }
    }
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return results.slice(0, 20)
  }

  await delay(80, 180)

  const results: SearchResult[] = []

  // Hosts
  for (const host of MOCK_HOSTS) {
    const score = (host.hostname?.toLowerCase().includes(q) ? 3 : 0) +
                  (host.ip.includes(q) ? 2 : 0) +
                  (host.role?.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'host',
        id: host.id,
        title: host.hostname ?? host.ip,
        subtitle: `${host.ip} · Risk ${host.riskScore}`,
        score: host.riskScore,
        timestamp: host.lastSeen,
        url: `/hosts/${host.id}`,
      })
    }
  }

  // Destinations
  for (const dest of MOCK_DESTINATIONS) {
    const score = (dest.domain?.toLowerCase().includes(q) ? 3 : 0) +
                  (dest.ip.includes(q) ? 2 : 0) +
                  (dest.asnOrg?.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'destination',
        id: dest.id,
        title: dest.domain ?? dest.ip,
        subtitle: `${dest.ip} · ${dest.asnOrg ?? 'Unknown ASN'} · Risk ${dest.riskScore}`,
        score: dest.riskScore,
        timestamp: dest.lastSeen,
        url: `/destinations/${dest.id}`,
      })
    }
  }

  // Findings
  for (const finding of MOCK_FINDINGS) {
    const score = (finding.title.toLowerCase().includes(q) ? 3 : 0) +
                  (finding.description.toLowerCase().includes(q) ? 2 : 0) +
                  (finding.id.toLowerCase().includes(q) ? 1 : 0) +
                  (finding.category.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'finding',
        id: finding.id,
        title: finding.title,
        subtitle: `${finding.id} · ${finding.severity.toUpperCase()} · Risk ${finding.riskScore}`,
        severity: finding.severity,
        score: finding.riskScore,
        timestamp: finding.lastSeen,
        url: `/findings/${finding.id}`,
      })
    }
  }

  // Incidents
  for (const incident of MOCK_INCIDENTS) {
    const score = (incident.title.toLowerCase().includes(q) ? 3 : 0) +
                  (incident.description.toLowerCase().includes(q) ? 2 : 0) +
                  (incident.id.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'incident',
        id: incident.id,
        title: incident.title,
        subtitle: `${incident.id} · ${incident.status} · Risk ${incident.riskScore}`,
        score: incident.riskScore,
        timestamp: incident.lastSeen,
        url: `/incidents/${incident.id}`,
      })
    }
  }

  // Captures
  for (const capture of MOCK_CAPTURES) {
    const score = (capture.id.toLowerCase().includes(q) ? 2 : 0) +
                  (capture.sensorName.toLowerCase().includes(q) ? 1 : 0) +
                  (capture.filename?.toLowerCase().includes(q) ? 2 : 0) +
                  (capture.type.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'capture',
        id: capture.id,
        title: capture.filename ?? capture.id,
        subtitle: `${capture.type} · ${capture.status} · ${capture.sensorName}`,
        score: 50,
        timestamp: capture.startTime,
        url: `/captures/${capture.id}`,
      })
    }
  }

  // Sensors
  for (const sensor of MOCK_SENSORS) {
    const score = (sensor.name.toLowerCase().includes(q) ? 3 : 0) +
                  (sensor.hostname.toLowerCase().includes(q) ? 2 : 0) +
                  (sensor.id.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'sensor',
        id: sensor.id,
        title: sensor.name,
        subtitle: `${sensor.id} · ${sensor.status} · ${sensor.hostname}`,
        score: sensor.status === 'online' ? 70 : sensor.status === 'degraded' ? 50 : 30,
        timestamp: sensor.lastSeen,
        url: `/sensors/${sensor.id}`,
      })
    }
  }

  // Triggers
  for (const trigger of MOCK_TRIGGERS) {
    const score = (trigger.id.toLowerCase().includes(q) ? 2 : 0) +
                  (trigger.entityId.toLowerCase().includes(q) ? 2 : 0) +
                  (trigger.severity.toLowerCase().includes(q) ? 1 : 0) +
                  (trigger.preservationReason?.toLowerCase().includes(q) ? 1 : 0)
    if (score > 0) {
      results.push({
        type: 'trigger',
        id: trigger.id,
        title: `Trigger ${trigger.id}`,
        subtitle: `Score ${trigger.score} · ${trigger.severity.toUpperCase()} · ${trigger.entityId}`,
        severity: trigger.severity,
        score: trigger.score,
        timestamp: trigger.timestamp,
        url: `/triggers/${trigger.id}`,
      })
    }
  }

  // Sort by score descending, then by timestamp descending
  results.sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return tsB - tsA
  })

  return results.slice(0, 20) // return top 20
}
