/**
 * NetSentinal AI — Core Platform Types
 *
 * This file contains all TypeScript type definitions for the NetSentinal AI
 * enterprise cybersecurity platform. Types are organized by domain:
 *
 *  - Customer & Engagement management
 *  - Sensor infrastructure
 *  - Capture lifecycle
 *  - Threat detection (Triggers, Findings, Incidents)
 *  - Network topology (Hosts, Destinations, Services, Flows)
 *  - Investigation pipeline
 *  - Reporting & Evidence
 *  - AI assistant integration
 *  - Application state & notifications
 */

// ─────────────────────────────────────────────────────────────────────────────
// Customer & Engagement
// ─────────────────────────────────────────────────────────────────────────────

/** Industry vertical for a customer organization. */
export type CustomerIndustry =
  | 'financial_services'
  | 'healthcare'
  | 'government'
  | 'technology'
  | 'retail'
  | 'energy'
  | 'manufacturing'
  | 'other'

/** Service tier / priority level for a customer engagement. */
export type CustomerTier = 'standard' | 'premium' | 'enterprise'

/**
 * A customer organization that has engaged NetSentinal AI services.
 */
export type Customer = {
  id: string
  name: string
  industry: CustomerIndustry
  tier: CustomerTier
  contactEmail: string
  contactName: string
  createdAt: string // ISO 8601
  logoUrl?: string
}

/** The type of security engagement being performed. */
export type EngagementType =
  | 'network_assessment'
  | 'incident_response'
  | 'threat_hunt'
  | 'continuous_monitoring'
  | 'red_team_support'

/** Lifecycle status of an engagement. */
export type EngagementStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived'

/**
 * A scoped security engagement for a given customer,
 * covering a set of assets and performed by a named consultant.
 */
export type Engagement = {
  id: string
  customerId: string
  name: string
  type: EngagementType
  status: EngagementStatus
  startDate: string // ISO 8601
  endDate?: string  // ISO 8601
  scope: string
  assets: string[]
  consultantId: string
  consultantName: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensors
// ─────────────────────────────────────────────────────────────────────────────

/** Operational status of a sensor appliance. */
export type SensorStatus = 'online' | 'degraded' | 'offline'

/**
 * Live throughput and activity metrics reported by a sensor.
 */
export type SensorMetrics = {
  /** Current throughput in megabits per second. */
  mbps: number
  /** Packets per second observed on the capture interface. */
  pps: number
  /** Active flow records per second being processed. */
  flowsPerSec: number
  /** Number of distinct active hosts seen in the rolling window. */
  activeHosts: number
  /** Rolling buffer retention window in seconds. */
  bufferDuration: number
  /** Total rolling buffer capacity in bytes. */
  bufferSize: number
  /** Buffer utilization as a percentage (0–100). */
  bufferPercent: number
}

/**
 * Represents an in-progress manual capture session on a sensor.
 */
export type CaptureSession = {
  captureId: string
  startTime: string // ISO 8601
  elapsedSeconds: number
  sizeBytes: number
}

/**
 * Status of the capture engine running on a sensor appliance.
 */
export type CaptureEngineStatus = {
  /** Whether the capture engine process is healthy. */
  healthy: boolean
  /** Whether the rolling ring-buffer capture is currently active. */
  rollingCapture: boolean
  /** Active manual capture session, or null if none is running. */
  manualCapture: CaptureSession | null
  /** Whether auto-preservation on trigger is enabled. */
  autoPreservation: boolean
  /** Number of capture files queued for upload to the cloud. */
  queuedUploads: number
}

/**
 * A physical or virtual sensor appliance deployed in a customer network.
 */
export type Sensor = {
  id: string
  name: string
  customerId: string
  engagementId: string
  hostname: string
  os: string
  version: string
  interface: string
  status: SensorStatus
  /** ISO 8601 timestamp of the last heartbeat received. */
  lastSeen: string
  captureEngine: CaptureEngineStatus
  metrics: SensorMetrics
}

// ─────────────────────────────────────────────────────────────────────────────
// Captures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The origin type of a packet capture file.
 *
 * - ROLLING: Automatically captured from the continuous ring buffer.
 * - MANUAL: Triggered manually by a consultant via the UI or API.
 * - AUTO_PRESERVED: Automatically preserved when a trigger score exceeded threshold.
 * - UPLOADED: An external PCAP file uploaded directly by the consultant.
 * - IMPORTED: Ingested from an external system or integration.
 */
export type CaptureType = 'ROLLING' | 'MANUAL' | 'AUTO_PRESERVED' | 'UPLOADED' | 'IMPORTED'

/**
 * Lifecycle status of a capture file.
 *
 * BUFFERING → RECORDING → FINALIZING → READY → ANALYZED
 *                                            ↘ FAILED
 *                               UPLOADING (for cloud uploads)
 */
export type CaptureStatus =
  | 'BUFFERING'
  | 'RECORDING'
  | 'FINALIZING'
  | 'READY'
  | 'ANALYZED'
  | 'FAILED'
  | 'UPLOADING'

/**
 * Metadata extracted from a capture after ingestion and DPI.
 */
export type CaptureMetadata = {
  /** Total number of packets in the capture. */
  packets?: number
  /** Total number of reconstructed flow records. */
  flows?: number
  /** Number of distinct IP hosts observed. */
  hosts?: number
  /** List of protocols identified via DPI. */
  protocols: string[]
  /** Version of the DPI engine that processed this capture. */
  dpiVersion?: string
  /** Backend job ID for the analysis pipeline. */
  analysisJobId?: string
}

/**
 * A packet capture file — the primary evidence unit in NetSentinal AI.
 */
export type Capture = {
  id: string
  type: CaptureType
  status: CaptureStatus
  sensorId: string
  sensorName: string
  /** ISO 8601 — when packet recording began. */
  startTime: string
  /** ISO 8601 — when packet recording ended (undefined if still recording). */
  endTime?: string
  /** Duration in seconds. */
  duration?: number
  durationSec?: number
  /** Capture file size in bytes. */
  sizeBytes?: number
  /** Reason why this capture was preserved. */
  preservationReason?: string
  /** IDs of triggers that caused or are associated with this capture. */
  triggerIds: string[]
  /** SHA-256 hash of the capture file for integrity verification. */
  sha256?: string
  /** Version of the analysis pipeline that processed this capture. */
  analysisVersion?: string
  customerId: string
  engagementId: string
  /** Original filename (for uploaded/imported captures). */
  filename?: string
  /** ISO 8601 — when the file was uploaded to cloud storage. */
  uploadedAt?: string
  metadata: CaptureMetadata
}

/**
 * A time-segmented chunk of a larger capture, used for streaming and resumable uploads.
 */
export type CaptureSegment = {
  id: string
  captureId: string
  index: number
  startTime: string  // ISO 8601
  endTime: string    // ISO 8601
  sizeBytes: number
  sha256: string
  status: 'pending' | 'uploading' | 'complete' | 'failed'
}

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

/** Severity tier for a detection trigger. */
export type TriggerSeverity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Lifecycle status of a trigger event.
 *
 * active → preservation_requested → preserving → preserved
 *        → dismissed
 */
export type TriggerStatus =
  | 'active'
  | 'preservation_requested'
  | 'preserving'
  | 'preserved'
  | 'dismissed'

/**
 * A contributing signal that explains part of a trigger score.
 */
export type TriggerSignal = {
  /** Signal type identifier (e.g. 'dpi_risk', 'periodicity', 'ml_anomaly'). */
  type: string
  /** Human-readable label for display. */
  label: string
  /** The observed value or description for this signal. */
  value: string | number
  /** Contribution weight to the overall trigger score (0.0–1.0). */
  weight: number
}

/**
 * A real-time detection trigger raised by the sensor analysis engine.
 * Triggers drive the auto-preservation workflow and link to incidents.
 */
export type Trigger = {
  id: string
  /** Composite risk score (0–100). */
  score: number
  severity: TriggerSeverity
  status: TriggerStatus
  /** ID of the entity (host IP, destination, etc.) that caused this trigger. */
  entityId: string
  /** Type of the entity ('host' | 'destination' | 'flow'). */
  entityType: string
  /** Ordered list of signals contributing to this trigger. */
  signals: TriggerSignal[]
  /** Capture ID generated by auto-preservation (if triggered). */
  captureId?: string
  /** Linked incident ID (once correlated). */
  incidentId?: string
  /** ISO 8601 timestamp when the trigger was raised. */
  timestamp: string
  /** Human-readable reason if preservation was requested. */
  preservationReason?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Topology
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A network host (internal or external IP) observed in captured traffic.
 */
export type Host = {
  id: string
  ip: string
  hostname?: string
  /** Functional role label (e.g. 'workstation', 'dns_server', 'gateway'). */
  role?: string
  /** Whether this host belongs to the monitored internal network. */
  internal: boolean
  customerId: string
  /** Composite risk score (0–100). */
  riskScore: number
  /** IDs of findings associated with this host. */
  findings: string[]
  /** Total number of flow records observed. */
  flows: number
  bytesIn: number
  bytesOut: number
  /** ISO 8601 — first time this host was seen. */
  firstSeen: string
  /** ISO 8601 — most recent time this host was seen. */
  lastSeen: string
}

/**
 * How commonly an external destination has been observed across the platform.
 */
export type DestinationRarity = 'rare' | 'unusual' | 'observed' | 'common'

/**
 * An external network destination (domain or IP) that internal hosts communicate with.
 */
export type Destination = {
  id: string
  domain?: string
  ip: string
  /** Autonomous System Number. */
  asn?: string
  /** ASN owner organization name. */
  asnOrg?: string
  /** ISO 3166-1 alpha-2 country code. */
  country?: string
  rarity: DestinationRarity
  /** Composite risk score (0–100). */
  riskScore: number
  /** Descriptive risk labels (e.g. 'High Risk', 'Under Investigation', 'Rare'). */
  labels: string[]
  /** IDs of internal hosts that communicated with this destination. */
  hosts: string[]
  firstSeen: string  // ISO 8601
  lastSeen: string   // ISO 8601
  /** Layer-7 protocols observed in communication with this destination. */
  protocols: string[]
  /** IDs of findings referencing this destination. */
  findings: string[]
}

/**
 * A network service (open port) observed on a host.
 */
export type NetworkService = {
  id: string
  ip: string
  port: number
  transport: 'tcp' | 'udp'
  /** Application-layer protocol identified by DPI. */
  application?: string
  /** IDs of source hosts that connected to this service. */
  sources: string[]
  /** Total number of flows to this service. */
  flows: number
  firstSeen: string  // ISO 8601
  lastSeen: string   // ISO 8601
  /** Risk score for this service. */
  riskScore: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Flows & Traffic
// ─────────────────────────────────────────────────────────────────────────────

/** Risk tier for an individual flow record. */
export type FlowRisk = 'critical' | 'high' | 'medium' | 'low' | 'none'

/**
 * Deep Packet Inspection result for a flow.
 */
export type DPIResult = {
  /** Layer-7 protocol name identified by DPI (e.g. 'TLS', 'DNS'). */
  protocol: string
  /** Application name if identifiable (e.g. 'custom_c2', 'HTTP/2'). */
  application: string
  /** Application category (e.g. 'encrypted', 'file_transfer', 'command_control'). */
  category: string
  /** List of DPI-detected risk indicators. */
  riskIndicators: string[]
  /** Confidence of the DPI classification (0.0–1.0). */
  confidence: number
}

/**
 * DNS record metadata extracted from a flow.
 */
export type DNSRecord = {
  query: string
  type: string
  response: string
  /** Time-to-live in seconds. */
  ttl: number
  /** Round-trip query time in milliseconds. */
  queryTime: number
}

/**
 * TLS handshake metadata extracted from a flow.
 */
export type TLSRecord = {
  /** TLS version string (e.g. 'TLSv1.3'). */
  version: string
  cipher: string
  /** Server Name Indication (SNI) hostname. */
  serverName: string
  /** JA3 client fingerprint. */
  ja3?: string
  /** JA3S server fingerprint. */
  ja3s?: string
  certIssuer: string
  certSubject: string
  /** ISO 8601 certificate expiry timestamp. */
  certExpiry: string
}

/**
 * An individual bidirectional network flow record extracted from a capture.
 */
export type Flow = {
  id: string
  /** ISO 8601 — flow start timestamp. */
  timestamp: string
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  /** Transport protocol (e.g. 'TCP', 'UDP'). */
  protocol: string
  /** Layer-7 application protocol if identified. */
  application?: string
  packets: number
  bytes: number
  /** Flow duration in seconds. */
  duration: number
  /** Composite risk score (0–100). */
  riskScore: number
  risk: FlowRisk
  captureId: string
  sensorId: string
  dpiResult?: DPIResult
  /** Feature vector used for ML anomaly scoring. */
  features?: Record<string, number | string>
  dns?: DNSRecord
  tls?: TLSRecord
  /** IDs of findings that reference this flow as evidence. */
  relatedFindings: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────────────────────

/** Severity tier of a security finding. */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/**
 * Analyst triage status for a finding.
 *
 * open → confirmed | benign | needs_investigation | resolved
 */
export type FindingStatus = 'open' | 'confirmed' | 'benign' | 'needs_investigation' | 'resolved'

/**
 * Detection category / technique type for a finding.
 */
export type FindingCategory =
  | 'beaconing'
  | 'dns_tunneling'
  | 'data_exfiltration'
  | 'lateral_movement'
  | 'port_scan'
  | 'unusual_protocol'
  | 'new_destination'
  | 'volume_anomaly'
  | 'rare_port'
  | 'other'

/**
 * AI-generated analysis of a finding, including narrative summary and next steps.
 */
export type AIAnalysis = {
  /** High-level narrative summary of what was detected. */
  summary: string
  /** Explanation of why this finding is significant. */
  whyItMatters: string
  /** Alternative benign explanations that should be ruled out. */
  alternativeExplanations: string[]
  /** Evidence gaps — what data would confirm or refute the hypothesis. */
  whatIsMissing: string[]
  /** Recommended analyst actions. */
  nextSteps: string[]
  /** References to specific evidence items used in this analysis. */
  evidenceRefs: string[]
  /** ISO 8601 — when this analysis was generated. */
  generatedAt: string
  /** Model version that generated this analysis. */
  modelVersion: string
}

/**
 * A security finding — a correlated detection with analyst context and AI enrichment.
 */
export type Finding = {
  id: string
  title: string
  description: string
  severity: FindingSeverity
  status: FindingStatus
  category: FindingCategory
  /** Composite risk score (0–100). */
  riskScore: number
  /** Model confidence (0.0–1.0). */
  confidence: number
  /** IDs of hosts involved in this finding. */
  hostIds: string[]
  /** IDs of destinations involved in this finding. */
  destinationIds: string[]
  captureId?: string
  sensorId?: string
  /** IDs of triggers that contributed to this finding. */
  triggerIds: string[]
  /** IDs of flow records that serve as evidence. */
  flowIds: string[]
  /** IDs of evidence items for chain-of-custody. */
  evidenceIds: string[]
  /** Linked incident ID (if escalated). */
  incidentId?: string
  firstSeen: string  // ISO 8601
  lastSeen: string   // ISO 8601
  /** Analyst triage decision label. */
  analystDecision?: string
  /** Analyst free-text notes. */
  analystNotes?: string
  /** AI-generated analysis for this finding. */
  aiAnalysis?: AIAnalysis
}

// ─────────────────────────────────────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a security incident.
 *
 * open → investigating → contained → resolved → closed
 */
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed'

/**
 * A single step in the AI-generated incident narrative (attack story).
 */
export type StoryStep = {
  /** ISO 8601 timestamp of this story event. */
  timestamp: string
  /** Short event label. */
  event: string
  /** Story step type for icon/color rendering. */
  type: 'initial_access' | 'discovery' | 'execution' | 'c2' | 'exfiltration' | 'alert' | 'response'
  entityId?: string
  entityType?: string
  /** Detailed description of what happened. */
  description: string
  /** Associated finding ID if applicable. */
  findingId?: string
}

/**
 * A correlated incident composed of multiple findings across hosts and captures.
 */
export type Incident = {
  id: string
  title: string
  description: string
  status: IncidentStatus
  /** Composite risk score (0–100). */
  riskScore: number
  /** Correlation confidence (0.0–1.0). */
  confidence: number
  /** IDs of hosts involved in this incident. */
  hostIds: string[]
  /** IDs of findings that make up this incident. */
  findingIds: string[]
  /** IDs of captures used as evidence. */
  captureIds: string[]
  /** IDs of sensors that detected activity. */
  sensorIds: string[]
  firstSeen: string  // ISO 8601
  lastSeen: string   // ISO 8601
  /** AI-generated attack narrative / story steps. */
  story?: StoryStep[]
  analystNotes?: string
  /** AI-generated executive summary of the incident. */
  aiSummary?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type of event that can appear in the investigation timeline.
 */
export type TimelineEventType =
  | 'flow'
  | 'dns'
  | 'tls'
  | 'detection'
  | 'trigger'
  | 'finding'
  | 'incident'
  | 'analyst_action'
  | 'ai_analysis'
  | 'capture'

/**
 * A single event on the investigation timeline.
 * Used to reconstruct the chronological story of an incident.
 */
export type TimelineEvent = {
  id: string
  /** ISO 8601 timestamp. */
  timestamp: string
  type: TimelineEventType
  title: string
  description: string
  /** Optional severity for color-coding. */
  severity?: FindingSeverity | TriggerSeverity
  entityId?: string
  entityType?: string
  findingId?: string
  incidentId?: string
  captureId?: string
  flowId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An evidence item preserved for chain-of-custody and legal admissibility.
 */
export type Evidence = {
  id: string
  /** Evidence type (e.g. 'pcap', 'flow_record', 'screenshot', 'log_extract'). */
  type: string
  /** Source system or entity that produced this evidence. */
  source: string
  captureId?: string
  flowId?: string
  findingId?: string
  /** SHA-256 hash of the evidence file for integrity. */
  hash: string
  /** ISO 8601 — when this evidence was collected. */
  timestamp: string
  /** Analysis pipeline version that processed this evidence. */
  analysisVersion?: string
  integrity: 'verified' | 'pending' | 'failed'
  /** Arbitrary key-value metadata (file size, encoding, etc.). */
  metadata: Record<string, string | number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Investigations (Analysis Pipeline)
// ─────────────────────────────────────────────────────────────────────────────

/** Overall status of an analysis investigation job. */
export type InvestigationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Analysis depth profile for an investigation.
 *
 * - rapid: Fast heuristic-only analysis (< 2 min).
 * - standard: Full rules + ML pipeline (~5 min).
 * - deep: Full pipeline + AI correlation + extended ML (~15 min).
 */
export type AnalysisProfile = 'standard' | 'deep' | 'rapid'

/**
 * A single stage in the analysis pipeline.
 */
export type AnalysisStage = {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  /** ISO 8601 — when this stage started. */
  startTime?: string
  /** ISO 8601 — when this stage completed. */
  endTime?: string
  itemsProcessed?: number
  itemsTotal?: number
  errors: string[]
}

/**
 * Running progress snapshot of an investigation.
 */
export type InvestigationProgress = {
  flowsProcessed: number
  hostsIdentified: number
  protocolsFound: number
  findingsSoFar: number
  errors: string[]
}

/**
 * A full analysis investigation job — runs the complete detection pipeline
 * against a capture file and produces findings, incidents, and AI summaries.
 */
export type Investigation = {
  id: string
  captureId: string
  customerId: string
  engagementId: string
  status: InvestigationStatus
  profile: AnalysisProfile
  /** Ordered pipeline stages. */
  stages: AnalysisStage[]
  /** IDs of findings generated by this investigation. */
  findings: string[]
  /** IDs of incidents created or updated by this investigation. */
  incidents: string[]
  /** ISO 8601 — when this investigation was created. */
  createdAt: string
  /** ISO 8601 — when this investigation completed (if applicable). */
  completedAt?: string
  progress: InvestigationProgress
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Report template type.
 */
export type ReportType =
  | 'executive_assessment'
  | 'technical_incident'
  | 'network_exposure'
  | 'consultancy_finding'

/**
 * Authoring / delivery status of a report.
 */
export type ReportStatus = 'draft' | 'review' | 'final' | 'delivered'

/**
 * A single section of a report (maps to a document heading).
 */
export type ReportSection = {
  id: string
  title: string
  /** Markdown-formatted content. */
  content: string
  /** Rendering order (lower = earlier in document). */
  order: number
  /** Evidence item IDs referenced in this section. */
  evidenceRefs: string[]
}

/**
 * A security report generated from findings and incidents for a customer.
 */
export type Report = {
  id: string
  type: ReportType
  title: string
  status: ReportStatus
  customerId: string
  engagementId: string
  /** Semantic version of this report (e.g. '1.0', '1.1'). */
  version: string
  sections: ReportSection[]
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  createdBy: string
  /** Incident IDs covered by this report. */
  incidentIds: string[]
  /** Finding IDs covered by this report. */
  findingIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Assistant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single message in the AI assistant conversation thread.
 */
export type AIMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  /** Markdown-formatted message content. */
  content: string
  /** ISO 8601 timestamp. */
  timestamp: string
  /** Evidence item IDs referenced in this message. */
  evidenceRefs?: string[]
  /** Finding IDs referenced in this message. */
  findingRefs?: string[]
  /** Incident IDs referenced in this message. */
  incidentRefs?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// System Health
// ─────────────────────────────────────────────────────────────────────────────

/** Health status of a platform infrastructure component. */
export type HealthComponentStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

/**
 * Health report for a single platform component.
 */
export type HealthComponent = {
  name: string
  status: HealthComponentStatus
  /** API response latency in milliseconds. */
  latencyMs?: number
  /** Error rate as a percentage (0–100). */
  errorRate?: number
  /** Queue depth for async workers. */
  queueDepth?: number
  /** Human-readable detail string (error message, version, etc.). */
  detail?: string
  /** ISO 8601 — last health check timestamp. */
  lastChecked: string
}

/**
 * Aggregated system health report for the NetSentinal AI platform.
 */
export type SystemHealth = {
  overall: HealthComponentStatus
  components: HealthComponent[]
  /** ISO 8601 — when this health report was generated. */
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────────────────────

/** Consultant identity loaded into application context. */
export type ConsultantContext = {
  name: string
  role: string
}

/**
 * In-app notification for the consultant.
 */
export type AppNotification = {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  /** ISO 8601 timestamp. */
  timestamp: string
  /** Whether the consultant has read / dismissed this notification. */
  read: boolean
  /** Optional deep-link URL for navigation. */
  link?: string
}

/**
 * Root application context — injected via React context provider.
 */
export type AppContextType = {
  customer: Customer
  engagement: Engagement
  consultant: ConsultantContext
  notifications: AppNotification[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility / Shared
// ─────────────────────────────────────────────────────────────────────────────

/** Generic paginated API response wrapper. */
export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/** Generic filter options shared across list endpoints. */
export type ListFilters = {
  customerId?: string
  engagementId?: string
  sensorId?: string
  captureId?: string
  incidentId?: string
  findingId?: string
  severity?: FindingSeverity | TriggerSeverity
  status?: string
  from?: string   // ISO 8601
  to?: string     // ISO 8601
  limit?: number
  offset?: number
  search?: string
}

/** Universal search result item returned by the global search API. */
export type SearchResult = {
  type: 'host' | 'destination' | 'finding' | 'incident' | 'capture' | 'flow' | 'sensor' | 'trigger'
  id: string
  title: string
  subtitle: string
  severity?: string
  score?: number
  timestamp?: string
  url: string
}
