/**
 * NetSentinal AI — Deterministic Mock Data
 *
 * Complete, realistic mock data for the golden demo scenario:
 *   Customer: Acme Financial Services
 *   Engagement: Q3 Network Security Assessment
 *   Incident: Suspicious outbound communication from FIN-WS-014
 *
 * All timestamps are anchored to the demo date: 2026-09-16
 * All data is fully deterministic — no Math.random() calls.
 */

import type {
  Customer,
  Engagement,
  Sensor,
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
  AppContextType,
  AIAnalysis,
  StoryStep,
  AnalysisStage,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Customer & Engagement
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CUSTOMER: Customer = {
  id: 'CUST-001',
  name: 'Acme Financial Services',
  industry: 'financial_services',
  tier: 'enterprise',
  contactEmail: 'security@acmefinancial.com',
  contactName: 'David Chen',
  createdAt: '2026-07-01T09:00:00Z',
}

export const MOCK_ENGAGEMENT: Engagement = {
  id: 'ENG-001',
  customerId: 'CUST-001',
  name: 'Q3 Network Security Assessment',
  type: 'network_assessment',
  status: 'active',
  startDate: '2026-09-01T08:00:00Z',
  endDate: '2026-09-30T18:00:00Z',
  scope: 'Full network perimeter and internal segment monitoring covering corporate LAN (10.0.0.0/24) and DMZ segment. Includes East-West traffic analysis.',
  assets: ['10.0.0.0/24', '10.0.1.0/24', 'DMZ-SEGMENT-01', 'CORE-SWITCH-FABRIC'],
  consultantId: 'CONS-007',
  consultantName: 'Alex Morgan',
}

export const MOCK_APP_CONTEXT: AppContextType = {
  customer: MOCK_CUSTOMER,
  engagement: MOCK_ENGAGEMENT,
  consultant: {
    name: 'Alex Morgan',
    role: 'Senior Security Consultant',
  },
  notifications: [], // populated below
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensors
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SENSORS: Sensor[] = [
  {
    id: 'SNS-042',
    name: 'ACME-SENSOR-01',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    hostname: 'acme-sensor-01.int.acmefinancial.com',
    os: 'Ubuntu 24.04 LTS',
    version: '2.8.4',
    interface: 'eth0',
    status: 'online',
    lastSeen: '2026-09-16T15:12:05Z',
    captureEngine: {
      healthy: true,
      rollingCapture: true,
      manualCapture: null,
      autoPreservation: true,
      queuedUploads: 0,
    },
    metrics: {
      mbps: 842,
      pps: 18420,
      flowsPerSec: 2184,
      activeHosts: 287,
      bufferDuration: 900,
      bufferSize: 107374182400, // 100 GB
      bufferPercent: 82,
    },
  },
  {
    id: 'SNS-037',
    name: 'ACME-EDGE-02',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    hostname: 'acme-edge-02.int.acmefinancial.com',
    os: 'Ubuntu 24.04 LTS',
    version: '2.8.3',
    interface: 'ens18',
    status: 'online',
    lastSeen: '2026-09-16T15:12:08Z',
    captureEngine: {
      healthy: true,
      rollingCapture: true,
      manualCapture: null,
      autoPreservation: true,
      queuedUploads: 2,
    },
    metrics: {
      mbps: 416,
      pps: 9240,
      flowsPerSec: 1092,
      activeHosts: 148,
      bufferDuration: 900,
      bufferSize: 107374182400,
      bufferPercent: 54,
    },
  },
  {
    id: 'SNS-051',
    name: 'ACME-BRANCH-05',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    hostname: 'acme-branch-05.br.acmefinancial.com',
    os: 'Ubuntu 22.04 LTS',
    version: '2.7.1',
    interface: 'eth0',
    status: 'degraded',
    lastSeen: '2026-09-16T15:08:14Z', // 4 minutes ago from 15:12
    captureEngine: {
      healthy: false,
      rollingCapture: false,
      manualCapture: null,
      autoPreservation: false,
      queuedUploads: 7,
    },
    metrics: {
      mbps: 0,
      pps: 0,
      flowsPerSec: 0,
      activeHosts: 0,
      bufferDuration: 900,
      bufferSize: 53687091200, // 50 GB
      bufferPercent: 61,
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Captures
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CAPTURES: Capture[] = [
  {
    id: 'CAP-1050',
    type: 'AUTO_PRESERVED',
    status: 'READY',
    sensorId: 'SNS-042',
    sensorName: 'ACME-SENSOR-01',
    startTime: '2026-09-16T14:26:04Z',
    endTime: '2026-09-16T15:07:42Z',
    duration: 2498,    // 41m 38s
    sizeBytes: 717225984, // 684 MB
    triggerIds: ['TRG-883'],
    sha256: 'a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4e3',
    analysisVersion: '3.14.2',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    metadata: {
      packets: 4218340,
      flows: 28491,
      hosts: 287,
      protocols: ['TLS 1.3', 'DNS', 'HTTP/2', 'TCP', 'UDP', 'ICMP'],
      dpiVersion: '4.2.1',
      analysisJobId: 'JOB-7f3a2b1c',
    },
  },
  {
    id: 'CAP-1047',
    type: 'MANUAL',
    status: 'ANALYZED',
    sensorId: 'SNS-042',
    sensorName: 'ACME-SENSOR-01',
    startTime: '2026-09-16T13:42:18Z',
    endTime: '2026-09-16T13:51:00Z',
    duration: 522,     // 8m 42s
    sizeBytes: 148897792, // 142 MB
    triggerIds: [],
    sha256: 'b7e8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
    analysisVersion: '3.14.2',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    metadata: {
      packets: 1084200,
      flows: 7214,
      hosts: 142,
      protocols: ['TLS 1.3', 'DNS', 'HTTP/2', 'TCP', 'UDP'],
      dpiVersion: '4.2.1',
      analysisJobId: 'JOB-4c2a1b9f',
    },
  },
  {
    id: 'CAP-1042',
    type: 'UPLOADED',
    status: 'ANALYZED',
    sensorId: 'SNS-042',
    sensorName: 'ACME-SENSOR-01',
    startTime: '2026-09-16T08:00:00Z',
    endTime: '2026-09-16T14:00:00Z',
    duration: 21600,   // 6h
    sizeBytes: 1975308288, // 1.84 GB
    triggerIds: [],
    sha256: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
    analysisVersion: '3.14.2',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    filename: 'incident_capture_2026-09-16.pcapng',
    uploadedAt: '2026-09-16T14:18:30Z',
    metadata: {
      packets: 18420000,
      flows: 142800,
      hosts: 312,
      protocols: ['TLS 1.3', 'TLS 1.2', 'DNS', 'HTTP/2', 'HTTP', 'TCP', 'UDP', 'ICMP', 'SMTP'],
      dpiVersion: '4.2.1',
      analysisJobId: 'JOB-2a1b9f8e',
    },
  },
  {
    id: 'CAP-1039',
    type: 'ROLLING',
    status: 'BUFFERING',
    sensorId: 'SNS-037',
    sensorName: 'ACME-EDGE-02',
    startTime: '2026-09-16T14:57:00Z',
    triggerIds: [],
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    metadata: {
      protocols: [],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Capture Segments (for CAP-1050)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CAPTURE_SEGMENTS: CaptureSegment[] = [
  {
    id: 'SEG-1050-001',
    captureId: 'CAP-1050',
    index: 0,
    startTime: '2026-09-16T14:26:04Z',
    endTime: '2026-09-16T14:36:04Z',
    sizeBytes: 173015040,
    sha256: 'f1e2d3c4b5a6978869504132241516e7d8c9b0a1f2e3d4c5b6a79808192a3b4c',
    status: 'complete',
  },
  {
    id: 'SEG-1050-002',
    captureId: 'CAP-1050',
    index: 1,
    startTime: '2026-09-16T14:36:04Z',
    endTime: '2026-09-16T14:46:04Z',
    sizeBytes: 173015040,
    sha256: 'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
    status: 'complete',
  },
  {
    id: 'SEG-1050-003',
    captureId: 'CAP-1050',
    index: 2,
    startTime: '2026-09-16T14:46:04Z',
    endTime: '2026-09-16T14:56:04Z',
    sizeBytes: 173015040,
    sha256: 'b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4',
    status: 'complete',
  },
  {
    id: 'SEG-1050-004',
    captureId: 'CAP-1050',
    index: 3,
    startTime: '2026-09-16T14:56:04Z',
    endTime: '2026-09-16T15:06:04Z',
    sizeBytes: 173015040,
    sha256: 'c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5',
    status: 'complete',
  },
  {
    id: 'SEG-1050-005',
    captureId: 'CAP-1050',
    index: 4,
    startTime: '2026-09-16T15:06:04Z',
    endTime: '2026-09-16T15:07:42Z',
    sizeBytes: 25165824,
    sha256: 'd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
    status: 'complete',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_TRIGGERS: Trigger[] = [
  {
    id: 'TRG-883',
    score: 92,
    severity: 'critical',
    status: 'preserved',
    entityId: '10.0.0.14',
    entityType: 'host',
    signals: [
      {
        type: 'dpi_risk',
        label: 'DPI risk indicators',
        value: 'Encrypted C2-pattern traffic detected',
        weight: 0.28,
      },
      {
        type: 'periodicity',
        label: 'Beacon periodicity',
        value: '~60s ± 2.4s interval (R² = 0.97)',
        weight: 0.24,
      },
      {
        type: 'destination_novelty',
        label: 'Destination novelty',
        value: '45.77.21.184 — first contact, no prior org history',
        weight: 0.22,
      },
      {
        type: 'outbound_volume_anomaly',
        label: 'Outbound volume anomaly',
        value: '+840% vs 30-day baseline for this host',
        weight: 0.18,
      },
      {
        type: 'ml_anomaly',
        label: 'ML behavioral anomaly',
        value: 'Isolation Forest score: 0.91',
        weight: 0.08,
      },
    ],
    captureId: 'CAP-1050',
    incidentId: 'INC-2026-041',
    timestamp: '2026-09-16T14:26:04Z',
    preservationReason:
      'Auto-preservation triggered: composite score 92/100 exceeded threshold 85. Pre-event buffer (15 min) + post-event buffer captured.',
  },
  {
    id: 'TRG-879',
    score: 68,
    severity: 'high',
    status: 'dismissed',
    entityId: '10.0.0.28',
    entityType: 'host',
    signals: [
      {
        type: 'destination_novelty',
        label: 'Destination novelty',
        value: 'cdn-sync-update.net — first contact',
        weight: 0.35,
      },
      {
        type: 'dns_entropy',
        label: 'DNS query entropy',
        value: 'High subdomain entropy: 4.82 bits',
        weight: 0.40,
      },
      {
        type: 'ml_anomaly',
        label: 'ML behavioral anomaly',
        value: 'Isolation Forest score: 0.74',
        weight: 0.25,
      },
    ],
    captureId: 'CAP-1047',
    timestamp: '2026-09-16T13:48:22Z',
    preservationReason: undefined,
  },
  {
    id: 'TRG-871',
    score: 51,
    severity: 'medium',
    status: 'dismissed',
    entityId: '10.0.0.28',
    entityType: 'host',
    signals: [
      {
        type: 'rare_port',
        label: 'Rare destination port',
        value: 'Port 8443 — 3rd percentile for this segment',
        weight: 0.60,
      },
      {
        type: 'ml_anomaly',
        label: 'ML behavioral anomaly',
        value: 'Isolation Forest score: 0.54',
        weight: 0.40,
      },
    ],
    timestamp: '2026-09-16T11:22:41Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Hosts
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_HOSTS: Host[] = [
  {
    id: 'HOST-014',
    ip: '10.0.0.14',
    hostname: 'FIN-WS-014',
    role: 'Financial Workstation',
    internal: true,
    customerId: 'CUST-001',
    riskScore: 87,
    findings: ['FND-8841', 'FND-8837', 'FND-8829'],
    flows: 18492,
    bytesIn: 1288490188,   // 1.2 GB
    bytesOut: 5153960550,  // 4.8 GB
    firstSeen: '2026-09-01T08:14:22Z',
    lastSeen: '2026-09-16T15:07:38Z',
  },
  {
    id: 'HOST-028',
    ip: '10.0.0.28',
    hostname: 'DEV-WS-028',
    role: 'Developer Workstation',
    internal: true,
    customerId: 'CUST-001',
    riskScore: 64,
    findings: ['FND-8814', 'FND-8802'],
    flows: 8240,
    bytesIn: 858993459,   // 0.8 GB
    bytesOut: 2254857830, // 2.1 GB
    firstSeen: '2026-09-01T08:22:44Z',
    lastSeen: '2026-09-16T15:10:12Z',
  },
  {
    id: 'HOST-005',
    ip: '10.0.0.5',
    hostname: 'CORE-DNS-01',
    role: 'Internal DNS Server',
    internal: true,
    customerId: 'CUST-001',
    riskScore: 21,
    findings: [],
    flows: 42180,
    bytesIn: 214748364,
    bytesOut: 322122547,
    firstSeen: '2026-09-01T08:00:02Z',
    lastSeen: '2026-09-16T15:12:04Z',
  },
  {
    id: 'HOST-001',
    ip: '10.0.0.1',
    hostname: 'CORE-GW-01',
    role: 'Core Gateway / Router',
    internal: true,
    customerId: 'CUST-001',
    riskScore: 18,
    findings: [],
    flows: 98420,
    bytesIn: 53687091200,
    bytesOut: 48318382080,
    firstSeen: '2026-09-01T08:00:00Z',
    lastSeen: '2026-09-16T15:12:08Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Destinations
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_DESTINATIONS: Destination[] = [
  {
    id: 'DEST-001',
    ip: '45.77.21.184',
    domain: undefined,
    asn: 'AS64514',
    asnOrg: 'Vultr Holdings LLC',
    country: 'NL',
    rarity: 'rare',
    riskScore: 82,
    labels: ['High Risk', 'Under Investigation', 'Rare', 'Cloud VPS', 'No Prior Contact'],
    hosts: ['HOST-014'],
    firstSeen: '2026-09-16T14:31:04Z',
    lastSeen: '2026-09-16T15:02:18Z',
    protocols: ['TLS 1.3'],
    findings: ['FND-8841'],
  },
  {
    id: 'DEST-002',
    ip: '140.82.112.4',
    domain: 'github.com',
    asn: 'AS36459',
    asnOrg: 'GitHub, Inc.',
    country: 'US',
    rarity: 'common',
    riskScore: 8,
    labels: ['Known Service', 'Developer Tool'],
    hosts: ['HOST-028', 'HOST-014'],
    firstSeen: '2026-09-01T09:00:00Z',
    lastSeen: '2026-09-16T14:58:22Z',
    protocols: ['TLS 1.3', 'HTTP/2'],
    findings: [],
  },
  {
    id: 'DEST-003',
    ip: '142.250.185.78',
    domain: 'google.com',
    asn: 'AS15169',
    asnOrg: 'Google LLC',
    country: 'US',
    rarity: 'common',
    riskScore: 4,
    labels: ['Known Service'],
    hosts: ['HOST-014', 'HOST-028', 'HOST-001'],
    firstSeen: '2026-09-01T08:30:00Z',
    lastSeen: '2026-09-16T15:11:44Z',
    protocols: ['TLS 1.3', 'HTTP/2', 'DNS'],
    findings: [],
  },
  {
    id: 'DEST-004',
    ip: '1.1.1.1',
    domain: 'cloudflare.com',
    asn: 'AS13335',
    asnOrg: 'Cloudflare, Inc.',
    country: 'US',
    rarity: 'common',
    riskScore: 5,
    labels: ['Known Service', 'CDN'],
    hosts: ['HOST-014', 'HOST-028'],
    firstSeen: '2026-09-01T08:30:00Z',
    lastSeen: '2026-09-16T15:09:38Z',
    protocols: ['TLS 1.3', 'DNS'],
    findings: [],
  },
  {
    id: 'DEST-005',
    ip: '185.220.101.47',
    domain: 'cdn-sync-update.net',
    asn: 'AS209854',
    asnOrg: 'Servius Ltd.',
    country: 'RO',
    rarity: 'rare',
    riskScore: 81,
    labels: ['Rare', 'High Risk', 'Suspicious Domain', 'No Historical Data', 'DGA Pattern'],
    hosts: ['HOST-028'],
    firstSeen: '2026-09-16T13:48:22Z',
    lastSeen: '2026-09-16T14:02:14Z',
    protocols: ['TLS 1.3', 'DNS'],
    findings: ['FND-8814'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Network Services
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_NETWORK_SERVICES: NetworkService[] = [
  {
    id: 'SVC-001',
    ip: '45.77.21.184',
    port: 443,
    transport: 'tcp',
    application: 'TLS/HTTPS (Unknown Application)',
    sources: ['HOST-014'],
    flows: 31,
    firstSeen: '2026-09-16T14:31:04Z',
    lastSeen: '2026-09-16T15:02:18Z',
    riskScore: 82,
  },
  {
    id: 'SVC-002',
    ip: '10.0.0.5',
    port: 53,
    transport: 'udp',
    application: 'DNS',
    sources: ['HOST-014', 'HOST-028', 'HOST-001'],
    flows: 42180,
    firstSeen: '2026-09-01T08:00:02Z',
    lastSeen: '2026-09-16T15:12:04Z',
    riskScore: 21,
  },
  {
    id: 'SVC-003',
    ip: '140.82.112.4',
    port: 443,
    transport: 'tcp',
    application: 'GitHub HTTPS',
    sources: ['HOST-028', 'HOST-014'],
    flows: 842,
    firstSeen: '2026-09-01T09:00:00Z',
    lastSeen: '2026-09-16T14:58:22Z',
    riskScore: 8,
  },
  {
    id: 'SVC-004',
    ip: '185.220.101.47',
    port: 443,
    transport: 'tcp',
    application: 'TLS/HTTPS (Unknown Application)',
    sources: ['HOST-028'],
    flows: 14,
    firstSeen: '2026-09-16T13:48:22Z',
    lastSeen: '2026-09-16T14:02:14Z',
    riskScore: 81,
  },
  {
    id: 'SVC-005',
    ip: '185.220.101.47',
    port: 8443,
    transport: 'tcp',
    application: 'Non-Standard HTTPS',
    sources: ['HOST-028'],
    flows: 6,
    firstSeen: '2026-09-16T11:22:41Z',
    lastSeen: '2026-09-16T11:44:18Z',
    riskScore: 42,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Flows (30 beaconing flows + supporting flows)
// ─────────────────────────────────────────────────────────────────────────────

// Helper to generate TLS beaconing flows at ~60s intervals
function makeTlsBeaconFlow(
  index: number,
  baseEpoch: number,    // seconds since epoch
  intervalSec: number,
  jitterSec: number,
  riskScore: number
): Flow {
  const jitter = [-2, 1, -1, 2, 0, -3, 1, 2, -1, 0, 3, -2, 1, -1, 2, 0, -3, 1, -2, 3, 0, -1, 2, 1, -2, 0, 3, -1, 2, -3][index % 30] * jitterSec / 3
  const ts = new Date((baseEpoch + index * intervalSec + jitter) * 1000).toISOString()
  const packets = 180 + [-4, 2, -1, 3, 0, -5, 4, -2, 1, 3, -3, 5, -1, 2, -4, 0, 3, -2, 1, -3, 4, -1, 2, -2, 3, 0, -4, 5, -1, 2][index % 30]
  const bytes = 281600 + [-2048, 1024, -512, 2048, 0, -4096, 3072, -1024, 512, 2048, -3072, 4096, -1024, 1024, -2048, 0, 2048, -1024, 512, -2048, 3072, -512, 1024, -2048, 2048, 0, -3072, 4096, -512, 1024][index % 30]
  const duration = 42 + [-1, 0, 1, -1, 2, 0, -2, 1, 0, -1, 1, 0, -1, 2, -2, 1, 0, -1, 1, -1, 0, 2, -2, 1, 0, -1, 1, 0, -1, 2][index % 30]
  const srcPort = 49152 + ((index * 137 + 41) % 16383)

  return {
    id: `FLOW-BC${String(index + 1).padStart(3, '0')}`,
    timestamp: ts,
    srcIp: '10.0.0.14',
    srcPort,
    dstIp: '45.77.21.184',
    dstPort: 443,
    protocol: 'TCP',
    application: 'TLS 1.3',
    packets,
    bytes,
    duration,
    riskScore,
    risk: riskScore >= 80 ? 'high' : 'medium',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dpiResult: {
      protocol: 'TLS',
      application: 'Unknown Encrypted Application',
      category: 'encrypted',
      riskIndicators: [
        'JA3 fingerprint matches known C2 framework',
        'Consistent payload sizes suggest automated beaconing',
        'No SNI extension (rare for legitimate TLS 1.3)',
        'Self-signed certificate on destination',
      ],
      confidence: 0.84,
    },
    tls: {
      version: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      serverName: '',
      ja3: 'e7d705a3286e19ea42f587b344ee6865',
      ja3s: 'ae4edc6faf64d08308082ad26be60767',
      certIssuer: 'CN=Self Signed CA',
      certSubject: 'CN=45.77.21.184',
      certExpiry: '2027-03-16T00:00:00Z',
    },
    features: {
      bytes_per_packet: +(bytes / packets).toFixed(2),
      inter_arrival_time: intervalSec + jitter,
      payload_entropy: 7.94,
      dst_port: 443,
      duration_sec: duration,
    },
    relatedFindings: ['FND-8841'],
  }
}

// Base epoch: 2026-09-16T14:31:04Z
const BEACON_BASE_EPOCH = 1758035464 // seconds
const BEACON_FLOWS: Flow[] = Array.from({ length: 30 }, (_, i) =>
  makeTlsBeaconFlow(
    i,
    BEACON_BASE_EPOCH,
    62,  // ~62 second intervals
    2,   // ±2 second jitter per step
    84 + (i % 8 === 0 ? 7 : i % 5 === 0 ? 5 : i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 0)
  )
)

// DNS flows from FIN-WS-014 to CORE-DNS-01
const DNS_FLOWS: Flow[] = [
  {
    id: 'FLOW-DNS001',
    timestamp: '2026-09-16T14:30:12Z',
    srcIp: '10.0.0.14',
    srcPort: 54218,
    dstIp: '10.0.0.5',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 2,
    bytes: 148,
    duration: 0.004,
    riskScore: 18,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dns: {
      query: '45.77.21.184.in-addr.arpa',
      type: 'PTR',
      response: 'NXDOMAIN',
      ttl: 0,
      queryTime: 4,
    },
    relatedFindings: [],
  },
  {
    id: 'FLOW-DNS002',
    timestamp: '2026-09-16T14:30:48Z',
    srcIp: '10.0.0.14',
    srcPort: 61042,
    dstIp: '10.0.0.5',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 2,
    bytes: 224,
    duration: 0.006,
    riskScore: 22,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dns: {
      query: 'update.cdn-sync-update.net',
      type: 'A',
      response: '185.220.101.47',
      ttl: 60,
      queryTime: 6,
    },
    relatedFindings: ['FND-8837'],
  },
  {
    id: 'FLOW-DNS003',
    timestamp: '2026-09-16T13:48:15Z',
    srcIp: '10.0.0.14',
    srcPort: 52841,
    dstIp: '10.0.0.5',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 2,
    bytes: 356,
    duration: 0.008,
    riskScore: 71,
    risk: 'high',
    captureId: 'CAP-1047',
    sensorId: 'SNS-042',
    dns: {
      query: 'aGVsbG8td29ybGQ.exfil.cdn-sync-update.net',
      type: 'TXT',
      response: 'dGhpcyBpcyBhIHRlc3Q=',
      ttl: 30,
      queryTime: 8,
    },
    relatedFindings: ['FND-8837'],
  },
  {
    id: 'FLOW-DNS004',
    timestamp: '2026-09-16T13:49:22Z',
    srcIp: '10.0.0.14',
    srcPort: 59124,
    dstIp: '10.0.0.5',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 2,
    bytes: 412,
    duration: 0.007,
    riskScore: 74,
    risk: 'high',
    captureId: 'CAP-1047',
    sensorId: 'SNS-042',
    dns: {
      query: 'dGVzdC1wYXlsb2Fk.exfil.cdn-sync-update.net',
      type: 'TXT',
      response: 'YWNr',
      ttl: 30,
      queryTime: 7,
    },
    relatedFindings: ['FND-8837'],
  },
]

// HTTP flows from FIN-WS-014 to GitHub
const HTTP_FLOWS: Flow[] = [
  {
    id: 'FLOW-HTTP001',
    timestamp: '2026-09-16T14:22:14Z',
    srcIp: '10.0.0.14',
    srcPort: 49824,
    dstIp: '140.82.112.4',
    dstPort: 443,
    protocol: 'TCP',
    application: 'GitHub HTTPS',
    packets: 42,
    bytes: 87040,
    duration: 3.2,
    riskScore: 8,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    tls: {
      version: 'TLSv1.3',
      cipher: 'TLS_AES_128_GCM_SHA256',
      serverName: 'github.com',
      ja3: 'aaa929d4a4e62a6c8e8b07da4e9afa87',
      ja3s: 'b2cf32d4a5e62b7c8e9f16da5a8bdc87',
      certIssuer: 'CN=DigiCert TLS Hybrid ECC SHA384 2020 CA1',
      certSubject: 'CN=github.com',
      certExpiry: '2027-03-21T00:00:00Z',
    },
    relatedFindings: [],
  },
  {
    id: 'FLOW-HTTP002',
    timestamp: '2026-09-16T14:54:08Z',
    srcIp: '10.0.0.14',
    srcPort: 51204,
    dstIp: '140.82.112.4',
    dstPort: 443,
    protocol: 'TCP',
    application: 'GitHub HTTPS',
    packets: 28,
    bytes: 54272,
    duration: 2.1,
    riskScore: 8,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    tls: {
      version: 'TLSv1.3',
      cipher: 'TLS_AES_128_GCM_SHA256',
      serverName: 'github.com',
      ja3: 'aaa929d4a4e62a6c8e8b07da4e9afa87',
      ja3s: 'b2cf32d4a5e62b7c8e9f16da5a8bdc87',
      certIssuer: 'CN=DigiCert TLS Hybrid ECC SHA384 2020 CA1',
      certSubject: 'CN=github.com',
      certExpiry: '2027-03-21T00:00:00Z',
    },
    relatedFindings: [],
  },
]

// Normal gateway flows
const GATEWAY_FLOWS: Flow[] = [
  {
    id: 'FLOW-GW001',
    timestamp: '2026-09-16T14:00:00Z',
    srcIp: '10.0.0.1',
    srcPort: 0,
    dstIp: '8.8.8.8',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 4,
    bytes: 280,
    duration: 0.012,
    riskScore: 4,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dns: {
      query: 'time.cloudflare.com',
      type: 'A',
      response: '162.159.200.1',
      ttl: 300,
      queryTime: 12,
    },
    relatedFindings: [],
  },
  {
    id: 'FLOW-GW002',
    timestamp: '2026-09-16T14:05:30Z',
    srcIp: '10.0.0.1',
    srcPort: 0,
    dstIp: '1.1.1.1',
    dstPort: 53,
    protocol: 'UDP',
    application: 'DNS',
    packets: 4,
    bytes: 312,
    duration: 0.009,
    riskScore: 4,
    risk: 'none',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dns: {
      query: 'updates.acmefinancial.com',
      type: 'A',
      response: '192.0.2.10',
      ttl: 3600,
      queryTime: 9,
    },
    relatedFindings: [],
  },
]

// Volume anomaly flows (large outbound transfer)
const VOLUME_FLOWS: Flow[] = [
  {
    id: 'FLOW-VOL001',
    timestamp: '2026-09-16T14:38:22Z',
    srcIp: '10.0.0.14',
    srcPort: 50841,
    dstIp: '45.77.21.184',
    dstPort: 443,
    protocol: 'TCP',
    application: 'TLS 1.3',
    packets: 8420,
    bytes: 4831838208, // ~4.5 GB over multiple segments
    duration: 2124,
    riskScore: 89,
    risk: 'critical',
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    dpiResult: {
      protocol: 'TLS',
      application: 'Unknown Encrypted Application',
      category: 'encrypted',
      riskIndicators: [
        'Extremely high outbound data volume',
        'Sustained high-bandwidth transfer to rare external host',
        'Data volume exceeds 30-day peer baseline by 2,400%',
      ],
      confidence: 0.91,
    },
    tls: {
      version: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      serverName: '',
      ja3: 'e7d705a3286e19ea42f587b344ee6865',
      ja3s: 'ae4edc6faf64d08308082ad26be60767',
      certIssuer: 'CN=Self Signed CA',
      certSubject: 'CN=45.77.21.184',
      certExpiry: '2027-03-16T00:00:00Z',
    },
    relatedFindings: ['FND-8829', 'FND-8841'],
  },
]

export const MOCK_FLOWS: Flow[] = [
  ...BEACON_FLOWS,
  ...DNS_FLOWS,
  ...HTTP_FLOWS,
  ...GATEWAY_FLOWS,
  ...VOLUME_FLOWS,
]

// ─────────────────────────────────────────────────────────────────────────────
// AI Analysis (for FND-8841)
// ─────────────────────────────────────────────────────────────────────────────

const FND_8841_AI_ANALYSIS: AIAnalysis = {
  summary:
    'Host FIN-WS-014 (10.0.0.14) exhibits classic Command & Control beaconing behavior, making 31 outbound TLS connections at a near-constant 62-second interval to IP 45.77.21.184 (AS64514, NL), a host with no prior contact history in this organization. The JA3 fingerprint matches patterns associated with known post-exploitation frameworks. Coupled with a 4.5 GB outbound data transfer during the same period, this strongly suggests an active compromise with ongoing data exfiltration.',
  whyItMatters:
    'C2 beaconing indicates an attacker maintains persistent remote access to this financial workstation. The consistent interval and payload sizes are hallmarks of automated malware. Given the host role (financial workstation), this represents a critical risk to customer financial data, credentials, and potentially the broader network if lateral movement has occurred.',
  alternativeExplanations: [
    'A legitimate cloud backup or synchronization agent configured with a non-standard schedule (less likely given the destination rarity and self-signed certificate).',
    'A scheduled monitoring or telemetry agent communicating to a vendor cloud endpoint — however the JA3 fingerprint mismatch and lack of SNI make this unlikely.',
    'A misconfigured or testing deployment of an internal tool — should be verified with the asset owner.',
  ],
  whatIsMissing: [
    'Process-level telemetry (EDR/endpoint data) to identify which process on FIN-WS-014 is making these connections.',
    'Memory dump from FIN-WS-014 to identify malware family and configuration.',
    'Lateral movement evidence — no East-West flows to other internal hosts have been identified yet, but the branch sensor (SNS-051) is currently degraded.',
    'Authentication logs from the workstation around 14:26 when beaconing began.',
    'Full PCAP decryption if the private key or session keys (via NSS keylog) can be obtained.',
  ],
  nextSteps: [
    'Isolate FIN-WS-014 from the network immediately to prevent further exfiltration.',
    'Collect a memory image and disk image of FIN-WS-014 for forensic analysis.',
    'Review Active Directory authentication logs for FIN-WS-014 over the past 48 hours.',
    'Search for lateral movement from 10.0.0.14 to other internal hosts, particularly finance segment.',
    'Block 45.77.21.184 and 185.220.101.47 at the perimeter firewall.',
    'Recover NSS key log file from FIN-WS-014 if Mozilla products are installed — enables TLS decryption.',
    'Contact David Chen (security@acmefinancial.com) to initiate internal IR procedures.',
  ],
  evidenceRefs: ['EVD-001', 'EVD-002', 'EVD-003', 'EVD-004'],
  generatedAt: '2026-09-16T15:08:42Z',
  modelVersion: 'netsentinal-ai-v3.2.1-forensic',
}

// ─────────────────────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_FINDINGS: Finding[] = [
  {
    id: 'FND-8841',
    title: 'Possible C2-style periodic traffic',
    description:
      'Host 10.0.0.14 (FIN-WS-014) has made 31 outbound TLS connections to 45.77.21.184:443 at a highly consistent ~62 second interval. The periodicity score of 0.97 (R²) is abnormally high for human-initiated traffic. The destination has no prior contact history and hosts a self-signed TLS certificate. JA3 fingerprint e7d705a3286e19ea42f587b344ee6865 matches known post-exploitation frameworks.',
    severity: 'high',
    status: 'open',
    category: 'beaconing',
    riskScore: 87,
    confidence: 0.79,
    hostIds: ['HOST-014'],
    destinationIds: ['DEST-001'],
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    triggerIds: ['TRG-883'],
    flowIds: BEACON_FLOWS.map(f => f.id),
    evidenceIds: ['EVD-001', 'EVD-002', 'EVD-003'],
    incidentId: 'INC-2026-041',
    firstSeen: '2026-09-16T14:31:04Z',
    lastSeen: '2026-09-16T15:02:18Z',
    aiAnalysis: FND_8841_AI_ANALYSIS,
  },
  {
    id: 'FND-8837',
    title: 'Possible DNS tunneling behavior',
    description:
      'Host 10.0.0.14 issued DNS TXT queries to exfil.cdn-sync-update.net with high-entropy subdomain labels (Base64-encoded content). The queries contained 320–412 bytes of payload data in the subdomain component — far exceeding legitimate DNS lookups. The parent domain cdn-sync-update.net was registered 12 days ago and has no legitimate CDN affiliation.',
    severity: 'high',
    status: 'open',
    category: 'dns_tunneling',
    riskScore: 81,
    confidence: 0.74,
    hostIds: ['HOST-014'],
    destinationIds: ['DEST-005'],
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    triggerIds: ['TRG-883'],
    flowIds: ['FLOW-DNS003', 'FLOW-DNS004'],
    evidenceIds: ['EVD-001', 'EVD-003'],
    incidentId: 'INC-2026-041',
    firstSeen: '2026-09-16T13:48:15Z',
    lastSeen: '2026-09-16T13:49:22Z',
  },
  {
    id: 'FND-8829',
    title: 'Unusual outbound data volume',
    description:
      'Host 10.0.0.14 transferred approximately 4.5 GB of data outbound to 45.77.21.184 over a 35-minute window. This represents a 2,400% increase over this host\'s 30-day peer baseline of ~180 MB/day. The transfer was sustained at high bandwidth (≈35 Mbps) throughout the observation period, which is inconsistent with normal financial workstation usage patterns.',
    severity: 'medium',
    status: 'open',
    category: 'volume_anomaly',
    riskScore: 73,
    confidence: 0.91,
    hostIds: ['HOST-014'],
    destinationIds: ['DEST-001'],
    captureId: 'CAP-1050',
    sensorId: 'SNS-042',
    triggerIds: ['TRG-883'],
    flowIds: ['FLOW-VOL001'],
    evidenceIds: ['EVD-001', 'EVD-004'],
    incidentId: 'INC-2026-041',
    firstSeen: '2026-09-16T14:31:04Z',
    lastSeen: '2026-09-16T15:07:38Z',
  },
  {
    id: 'FND-8814',
    title: 'New external destination observed',
    description:
      'Host 10.0.0.28 (DEV-WS-028) contacted cdn-sync-update.net (185.220.101.47) for the first time. This domain was registered 12 days ago and follows DGA-like naming patterns. The domain has no legitimate CDN affiliation and is hosted on infrastructure associated with past malware campaigns.',
    severity: 'medium',
    status: 'open',
    category: 'new_destination',
    riskScore: 68,
    confidence: 0.88,
    hostIds: ['HOST-028'],
    destinationIds: ['DEST-005'],
    captureId: 'CAP-1047',
    sensorId: 'SNS-042',
    triggerIds: ['TRG-879'],
    flowIds: ['FLOW-DNS002'],
    evidenceIds: ['EVD-005'],
    incidentId: 'INC-2026-041',
    firstSeen: '2026-09-16T13:48:22Z',
    lastSeen: '2026-09-16T14:02:14Z',
  },
  {
    id: 'FND-8802',
    title: 'Rare destination port observed',
    description:
      'Host 10.0.0.28 connected to 185.220.101.47 on port 8443/TCP. While not unusual in isolation, port 8443 is in the 3rd percentile for external connections from this network segment, and the combination of rare port + rare destination with TLS on a non-standard port warrants investigation.',
    severity: 'low',
    status: 'open',
    category: 'rare_port',
    riskScore: 42,
    confidence: 0.67,
    hostIds: ['HOST-028'],
    destinationIds: ['DEST-005'],
    captureId: 'CAP-1047',
    sensorId: 'SNS-042',
    triggerIds: ['TRG-871'],
    flowIds: [],
    evidenceIds: ['EVD-005'],
    incidentId: 'INC-2026-041',
    firstSeen: '2026-09-16T11:22:41Z',
    lastSeen: '2026-09-16T11:44:18Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Incident
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_STORY: StoryStep[] = [
  {
    timestamp: '2026-09-16T11:22:41Z',
    event: 'Unusual port access',
    type: 'discovery',
    entityId: 'HOST-028',
    entityType: 'host',
    description: 'DEV-WS-028 made the first contact with cdn-sync-update.net on port 8443/TCP — an unusual port for this segment. Trigger TRG-871 raised at score 51 (below preservation threshold).',
    findingId: 'FND-8802',
  },
  {
    timestamp: '2026-09-16T13:48:15Z',
    event: 'DNS tunneling detected',
    type: 'c2',
    entityId: 'HOST-014',
    entityType: 'host',
    description: 'FIN-WS-014 began issuing Base64-encoded DNS TXT queries to exfil.cdn-sync-update.net. High subdomain entropy and large query payloads indicate DNS tunneling activity.',
    findingId: 'FND-8837',
  },
  {
    timestamp: '2026-09-16T14:26:04Z',
    event: 'C2 beaconing begins',
    type: 'c2',
    entityId: 'HOST-014',
    entityType: 'host',
    description: 'FIN-WS-014 initiated first TLS connection to 45.77.21.184:443. Trigger TRG-883 raised at score 92, exceeding preservation threshold of 85. Auto-preservation of rolling buffer initiated.',
    findingId: 'FND-8841',
  },
  {
    timestamp: '2026-09-16T14:26:04Z',
    event: 'Auto-preservation triggered',
    type: 'response',
    entityId: 'CAP-1050',
    entityType: 'capture',
    description: 'Auto-preservation of 15-minute pre-event rolling buffer initiated. Sensor SNS-042 began recording post-event traffic. Capture CAP-1050 created.',
  },
  {
    timestamp: '2026-09-16T14:31:04Z',
    event: 'Beaconing confirmed',
    type: 'c2',
    entityId: 'HOST-014',
    entityType: 'host',
    description: 'After 5 beacon intervals (5 × 62s ≈ 5 min), periodicity score confirmed at R²=0.97. System confirmed beaconing pattern. Finding FND-8841 created.',
    findingId: 'FND-8841',
  },
  {
    timestamp: '2026-09-16T14:38:22Z',
    event: 'Large data transfer begins',
    type: 'exfiltration',
    entityId: 'HOST-014',
    entityType: 'host',
    description: 'A sustained high-bandwidth TLS stream began to 45.77.21.184. Transfer rate ~35 Mbps — consistent with bulk data exfiltration. Finding FND-8829 created.',
    findingId: 'FND-8829',
  },
  {
    timestamp: '2026-09-16T15:07:38Z',
    event: 'Transfer ended / host went quiet',
    type: 'c2',
    entityId: 'HOST-014',
    entityType: 'host',
    description: 'All outbound connections from FIN-WS-014 to 45.77.21.184 ceased. Total exfiltrated data: ~4.8 GB. Capture CAP-1050 finalized at 15:07:42.',
  },
  {
    timestamp: '2026-09-16T15:08:42Z',
    event: 'AI analysis completed',
    type: 'alert',
    entityId: 'INC-2026-041',
    entityType: 'incident',
    description: 'NetSentinal AI completed deep analysis of CAP-1050. 5 findings generated, incident INC-2026-041 created. AI summary: Active C2 compromise with data exfiltration from financial workstation.',
  },
]

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-041',
    title: 'Suspicious outbound communication from FIN-WS-014',
    description:
      'Financial workstation FIN-WS-014 (10.0.0.14) has been observed making periodic encrypted connections to a rare external IP (45.77.21.184, AS64514, NL) with characteristics consistent with command-and-control beaconing. The same host has also exhibited DNS tunneling behavior and transferred approximately 4.8 GB of data outbound over a 41-minute period. A second host (DEV-WS-028) contacted the same threat infrastructure earlier in the day.',
    status: 'investigating',
    riskScore: 91,
    confidence: 0.78,
    hostIds: ['HOST-014', 'HOST-028'],
    findingIds: ['FND-8841', 'FND-8837', 'FND-8829', 'FND-8814', 'FND-8802'],
    captureIds: ['CAP-1050', 'CAP-1047'],
    sensorIds: ['SNS-042'],
    firstSeen: '2026-09-16T11:22:41Z',
    lastSeen: '2026-09-16T15:07:38Z',
    story: INCIDENT_STORY,
    aiSummary:
      'This incident represents a high-confidence active compromise of financial workstation FIN-WS-014. The attack pattern is consistent with a staged intrusion: initial reconnaissance via DEV-WS-028 (which may have been compromised earlier), followed by deployment of a backdoor on FIN-WS-014 that uses TLS-encrypted C2 beaconing at 62-second intervals. The 4.8 GB outbound transfer strongly suggests bulk data exfiltration. Immediate host isolation and forensic imaging are recommended.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_EVIDENCE: Evidence[] = [
  {
    id: 'EVD-001',
    type: 'pcap',
    source: 'CAP-1050 (Auto-Preserved)',
    captureId: 'CAP-1050',
    findingId: 'FND-8841',
    hash: 'a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4e3',
    timestamp: '2026-09-16T15:07:42Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      sizeBytes: 717225984,
      sizeHuman: '684 MB',
      duration: '41m 38s',
      packets: 4218340,
      flows: 28491,
      captureFormat: 'pcapng',
      captureEngine: 'libpcap 1.10.4',
      compressionAlgo: 'none',
    },
  },
  {
    id: 'EVD-002',
    type: 'flow_record',
    source: 'Beacon flow analysis — 31 flows',
    captureId: 'CAP-1050',
    findingId: 'FND-8841',
    hash: 'b7e8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
    timestamp: '2026-09-16T15:08:22Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      flowCount: 31,
      srcIp: '10.0.0.14',
      dstIp: '45.77.21.184',
      dstPort: 443,
      protocol: 'TLS 1.3',
      periodicityScore: 0.97,
      intervalSec: 62,
      jitterSec: 2.4,
      exportFormat: 'JSON',
    },
  },
  {
    id: 'EVD-003',
    type: 'tls_metadata',
    source: 'TLS handshake extraction — CAP-1050',
    captureId: 'CAP-1050',
    findingId: 'FND-8841',
    hash: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
    timestamp: '2026-09-16T15:08:28Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      ja3: 'e7d705a3286e19ea42f587b344ee6865',
      ja3s: 'ae4edc6faf64d08308082ad26be60767',
      tlsVersion: 'TLSv1.3',
      cipher: 'TLS_AES_256_GCM_SHA384',
      certIssuer: 'CN=Self Signed CA',
      certSubject: 'CN=45.77.21.184',
      certExpiry: '2027-03-16T00:00:00Z',
      sniPresent: 0,
    },
  },
  {
    id: 'EVD-004',
    type: 'volume_analysis',
    source: 'Outbound volume analysis — FIN-WS-014',
    captureId: 'CAP-1050',
    findingId: 'FND-8829',
    hash: 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
    timestamp: '2026-09-16T15:08:35Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      totalBytesOut: 4831838208,
      totalBytesOutHuman: '4.5 GB',
      durationSec: 2114,
      averageBandwidthMbps: 18.3,
      peakBandwidthMbps: 42.7,
      baselineBytes30d: 188743680,
      deviationPercent: 2400,
    },
  },
  {
    id: 'EVD-005',
    type: 'dns_query_log',
    source: 'DNS analysis — CDN-SYNC-UPDATE.NET queries',
    captureId: 'CAP-1047',
    findingId: 'FND-8814',
    hash: 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2',
    timestamp: '2026-09-16T13:51:00Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      queryCount: 14,
      highEntropyQueryCount: 12,
      avgSubdomainEntropy: 4.82,
      avgQueryPayloadBytes: 376,
      domainAge: '12 days',
      domainRegistrar: 'NameCheap',
      dgaConfidence: 0.84,
    },
  },
  {
    id: 'EVD-006',
    type: 'ai_analysis_report',
    source: 'NetSentinal AI Analysis — INC-2026-041',
    findingId: 'FND-8841',
    hash: 'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3',
    timestamp: '2026-09-16T15:08:42Z',
    analysisVersion: '3.14.2',
    integrity: 'verified',
    metadata: {
      modelVersion: 'netsentinal-ai-v3.2.1-forensic',
      findingsAnalyzed: 5,
      hostsAnalyzed: 2,
      flowsAnalyzed: 38,
      processingTimeSec: 14.2,
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Events (25+ events)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'TLV-001',
    timestamp: '2026-09-16T08:00:00Z',
    type: 'capture',
    title: 'Sensors online — monitoring begins',
    description: 'SNS-042 and SNS-037 reporting healthy. Rolling ring-buffer capture active. Monitoring engagement ENG-001.',
  },
  {
    id: 'TLV-002',
    timestamp: '2026-09-16T11:22:41Z',
    type: 'detection',
    title: 'Trigger TRG-871: Rare port 8443',
    description: 'Host DEV-WS-028 connected to 185.220.101.47:8443/TCP. Score 51 — below preservation threshold. Logged.',
    severity: 'medium',
    entityId: 'HOST-028',
    entityType: 'host',
  },
  {
    id: 'TLV-003',
    timestamp: '2026-09-16T11:44:18Z',
    type: 'flow',
    title: 'Connection to port 8443 ended',
    description: 'DEV-WS-028 → 185.220.101.47:8443 connection terminated after 21m 37s. 6 flows, 2.1 MB transferred.',
    entityId: 'HOST-028',
    entityType: 'host',
  },
  {
    id: 'TLV-004',
    timestamp: '2026-09-16T13:42:18Z',
    type: 'capture',
    title: 'Manual capture CAP-1047 started',
    description: 'Consultant Alex Morgan initiated manual capture on SNS-042 for baseline traffic analysis.',
    captureId: 'CAP-1047',
  },
  {
    id: 'TLV-005',
    timestamp: '2026-09-16T13:48:15Z',
    type: 'detection',
    title: 'DNS tunneling detected — FIN-WS-014',
    description: 'Host FIN-WS-014 began issuing Base64-encoded DNS TXT queries to exfil.cdn-sync-update.net. High subdomain entropy (4.82 bits avg).',
    severity: 'high',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8837',
  },
  {
    id: 'TLV-006',
    timestamp: '2026-09-16T13:48:22Z',
    type: 'trigger',
    title: 'Trigger TRG-879: Score 68 — DEV-WS-028',
    description: 'DEV-WS-028 contacted cdn-sync-update.net. Score 68 raised. Below threshold; analyst notified.',
    severity: 'high',
    entityId: 'HOST-028',
    entityType: 'host',
  },
  {
    id: 'TLV-007',
    timestamp: '2026-09-16T13:49:22Z',
    type: 'flow',
    title: 'DNS tunneling — second query',
    description: 'Second high-entropy DNS TXT query from FIN-WS-014 to exfil.cdn-sync-update.net. Pattern confirmed.',
    severity: 'high',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8837',
  },
  {
    id: 'TLV-008',
    timestamp: '2026-09-16T13:51:00Z',
    type: 'capture',
    title: 'Manual capture CAP-1047 completed',
    description: 'Manual capture CAP-1047 finalized. Duration: 8m 42s, 142 MB. Analysis queued.',
    captureId: 'CAP-1047',
  },
  {
    id: 'TLV-009',
    timestamp: '2026-09-16T13:52:14Z',
    type: 'finding',
    title: 'Finding FND-8837: DNS tunneling behavior',
    description: 'Analysis pipeline created finding FND-8837 (HIGH) — possible DNS tunneling from FIN-WS-014 via exfil.cdn-sync-update.net.',
    severity: 'high',
    findingId: 'FND-8837',
    captureId: 'CAP-1047',
  },
  {
    id: 'TLV-010',
    timestamp: '2026-09-16T13:52:14Z',
    type: 'finding',
    title: 'Finding FND-8814: New destination',
    description: 'Finding FND-8814 (MEDIUM) — DEV-WS-028 contacted newly registered domain cdn-sync-update.net.',
    severity: 'medium',
    findingId: 'FND-8814',
    captureId: 'CAP-1047',
  },
  {
    id: 'TLV-011',
    timestamp: '2026-09-16T14:26:04Z',
    type: 'trigger',
    title: 'CRITICAL: Trigger TRG-883 — Score 92 on FIN-WS-014',
    description: 'Composite risk score 92/100 exceeded preservation threshold 85. Auto-preservation initiated. Pre-event rolling buffer (15 min) captured.',
    severity: 'critical',
    entityId: 'HOST-014',
    entityType: 'host',
  },
  {
    id: 'TLV-012',
    timestamp: '2026-09-16T14:26:04Z',
    type: 'capture',
    title: 'Auto-preservation CAP-1050 created',
    description: 'Capture CAP-1050 started — includes 15-minute pre-event rolling buffer (from 14:11:04) plus ongoing post-event recording.',
    severity: 'critical',
    captureId: 'CAP-1050',
  },
  {
    id: 'TLV-013',
    timestamp: '2026-09-16T14:30:12Z',
    type: 'dns',
    title: 'Reverse DNS query for 45.77.21.184',
    description: 'FIN-WS-014 issued PTR record lookup for 45.77.21.184 — returned NXDOMAIN. Suggests malware performing basic network reconnaissance.',
    entityId: 'HOST-014',
    entityType: 'host',
  },
  {
    id: 'TLV-014',
    timestamp: '2026-09-16T14:31:04Z',
    type: 'tls',
    title: 'First TLS beacon to 45.77.21.184:443',
    description: 'TLS 1.3 handshake with 45.77.21.184:443. No SNI. Self-signed certificate. JA3: e7d705a3... (matches C2 frameworks). Flow FLOW-BC001.',
    severity: 'high',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8841',
  },
  {
    id: 'TLV-015',
    timestamp: '2026-09-16T14:32:06Z',
    type: 'tls',
    title: 'Beacon 2 of 31',
    description: 'Second TLS connection. Interval from prior: 62s. Consistent payload size ~275 KB.',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8841',
  },
  {
    id: 'TLV-016',
    timestamp: '2026-09-16T14:36:10Z',
    type: 'finding',
    title: 'Beaconing pattern confirmed — FND-8841 raised',
    description: 'After 5 beacon intervals, periodicity analysis confirmed R²=0.97. Finding FND-8841 (HIGH) created: Possible C2-style periodic traffic.',
    severity: 'high',
    findingId: 'FND-8841',
    captureId: 'CAP-1050',
  },
  {
    id: 'TLV-017',
    timestamp: '2026-09-16T14:38:22Z',
    type: 'flow',
    title: 'Large data transfer initiated',
    description: 'Sustained high-bandwidth TLS stream began to 45.77.21.184 at ~35 Mbps. Consistent with bulk data staging/exfiltration.',
    severity: 'high',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8829',
  },
  {
    id: 'TLV-018',
    timestamp: '2026-09-16T14:39:04Z',
    type: 'finding',
    title: 'Finding FND-8829: Volume anomaly',
    description: 'Finding FND-8829 (MEDIUM) created — outbound data volume 2,400% above 30-day baseline for FIN-WS-014.',
    severity: 'medium',
    findingId: 'FND-8829',
  },
  {
    id: 'TLV-019',
    timestamp: '2026-09-16T14:40:00Z',
    type: 'analyst_action',
    title: 'Alex Morgan reviewing triggers',
    description: 'Consultant Alex Morgan acknowledged TRG-883 and opened incident investigation dashboard.',
  },
  {
    id: 'TLV-020',
    timestamp: '2026-09-16T14:42:14Z',
    type: 'finding',
    title: 'Finding FND-8802: Rare port',
    description: 'Analysis correlated earlier TRG-871 data. Finding FND-8802 (LOW) created — rare port 8443 observed from DEV-WS-028.',
    severity: 'low',
    findingId: 'FND-8802',
  },
  {
    id: 'TLV-021',
    timestamp: '2026-09-16T15:02:18Z',
    type: 'tls',
    title: 'Final beacon — beacon 31 of 31',
    description: 'Last observed C2 beacon from FIN-WS-014 to 45.77.21.184:443. Connection terminated cleanly after ~42s.',
    entityId: 'HOST-014',
    entityType: 'host',
    findingId: 'FND-8841',
  },
  {
    id: 'TLV-022',
    timestamp: '2026-09-16T15:07:38Z',
    type: 'flow',
    title: 'All outbound connections from FIN-WS-014 ceased',
    description: 'FIN-WS-014 went silent. No further connections to 45.77.21.184. Large transfer completed. Total: 4.8 GB exfiltrated.',
    entityId: 'HOST-014',
    entityType: 'host',
  },
  {
    id: 'TLV-023',
    timestamp: '2026-09-16T15:07:42Z',
    type: 'capture',
    title: 'Auto-preservation CAP-1050 finalized',
    description: 'Capture CAP-1050 recording ended. Final size: 684 MB, 41m 38s duration, SHA-256 computed and verified.',
    captureId: 'CAP-1050',
  },
  {
    id: 'TLV-024',
    timestamp: '2026-09-16T15:07:50Z',
    type: 'ai_analysis',
    title: 'Deep analysis pipeline started on CAP-1050',
    description: 'Investigation INV-001 started with profile: deep. All 12 pipeline stages queued. Estimated completion: 15 minutes.',
    captureId: 'CAP-1050',
  },
  {
    id: 'TLV-025',
    timestamp: '2026-09-16T15:08:42Z',
    type: 'ai_analysis',
    title: 'AI analysis completed — INC-2026-041 created',
    description: 'NetSentinal AI completed deep analysis. 5 findings generated, incident INC-2026-041 created. AI summary published.',
    captureId: 'CAP-1050',
  },
  {
    id: 'TLV-026',
    timestamp: '2026-09-16T15:08:42Z',
    type: 'incident',
    title: 'Incident INC-2026-041 created',
    description: 'Incident "Suspicious outbound communication from FIN-WS-014" created with status: investigating. Risk score: 91, Confidence: 78%.',
    severity: 'critical',
    incidentId: 'INC-2026-041',
  },
  {
    id: 'TLV-027',
    timestamp: '2026-09-16T15:10:00Z',
    type: 'analyst_action',
    title: 'Alex Morgan — AI analysis reviewed',
    description: 'Consultant confirmed AI findings and began drafting incident report. Recommendation to isolate FIN-WS-014 sent to client.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Investigation (INV-001)
// ─────────────────────────────────────────────────────────────────────────────

const INV_STAGES: AnalysisStage[] = [
  {
    name: 'Capture Validation',
    status: 'completed',
    startTime: '2026-09-16T15:07:50Z',
    endTime: '2026-09-16T15:07:52Z',
    itemsProcessed: 1,
    itemsTotal: 1,
    errors: [],
  },
  {
    name: 'Packet Ingest',
    status: 'completed',
    startTime: '2026-09-16T15:07:52Z',
    endTime: '2026-09-16T15:07:58Z',
    itemsProcessed: 4218340,
    itemsTotal: 4218340,
    errors: [],
  },
  {
    name: 'Flow Extraction',
    status: 'completed',
    startTime: '2026-09-16T15:07:58Z',
    endTime: '2026-09-16T15:08:04Z',
    itemsProcessed: 28491,
    itemsTotal: 28491,
    errors: [],
  },
  {
    name: 'Deep Packet Inspection',
    status: 'completed',
    startTime: '2026-09-16T15:08:04Z',
    endTime: '2026-09-16T15:08:14Z',
    itemsProcessed: 28491,
    itemsTotal: 28491,
    errors: [],
  },
  {
    name: 'Feature Extraction',
    status: 'completed',
    startTime: '2026-09-16T15:08:14Z',
    endTime: '2026-09-16T15:08:18Z',
    itemsProcessed: 28491,
    itemsTotal: 28491,
    errors: [],
  },
  {
    name: 'Rule Engine',
    status: 'completed',
    startTime: '2026-09-16T15:08:18Z',
    endTime: '2026-09-16T15:08:22Z',
    itemsProcessed: 28491,
    itemsTotal: 28491,
    errors: [],
  },
  {
    name: 'ML Anomaly Detection',
    status: 'completed',
    startTime: '2026-09-16T15:08:22Z',
    endTime: '2026-09-16T15:08:26Z',
    itemsProcessed: 28491,
    itemsTotal: 28491,
    errors: [],
  },
  {
    name: 'Periodicity Analysis',
    status: 'completed',
    startTime: '2026-09-16T15:08:26Z',
    endTime: '2026-09-16T15:08:28Z',
    itemsProcessed: 31,
    itemsTotal: 31,
    errors: [],
  },
  {
    name: 'Finding Correlation',
    status: 'completed',
    startTime: '2026-09-16T15:08:28Z',
    endTime: '2026-09-16T15:08:32Z',
    itemsProcessed: 5,
    itemsTotal: 5,
    errors: [],
  },
  {
    name: 'AI Narrative Generation',
    status: 'completed',
    startTime: '2026-09-16T15:08:32Z',
    endTime: '2026-09-16T15:08:40Z',
    itemsProcessed: 5,
    itemsTotal: 5,
    errors: [],
  },
  {
    name: 'Graph Index',
    status: 'completed',
    startTime: '2026-09-16T15:08:40Z',
    endTime: '2026-09-16T15:08:42Z',
    itemsProcessed: 287,
    itemsTotal: 287,
    errors: [],
  },
  {
    name: 'Report Scaffold',
    status: 'completed',
    startTime: '2026-09-16T15:08:42Z',
    endTime: '2026-09-16T15:08:42Z',
    itemsProcessed: 1,
    itemsTotal: 1,
    errors: [],
  },
]

export const MOCK_INVESTIGATIONS: Investigation[] = [
  {
    id: 'INV-001',
    captureId: 'CAP-1050',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    status: 'completed',
    profile: 'deep',
    stages: INV_STAGES,
    findings: ['FND-8841', 'FND-8837', 'FND-8829', 'FND-8814', 'FND-8802'],
    incidents: ['INC-2026-041'],
    createdAt: '2026-09-16T15:07:50Z',
    completedAt: '2026-09-16T15:08:42Z',
    progress: {
      flowsProcessed: 28491,
      hostsIdentified: 287,
      protocolsFound: 6,
      findingsSoFar: 5,
      errors: [],
    },
  },
  {
    id: 'INV-002',
    captureId: 'CAP-1047',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    status: 'completed',
    profile: 'standard',
    stages: INV_STAGES.map((s, i) => ({
      ...s,
      startTime: s.startTime
        ? new Date(new Date(s.startTime).getTime() - 3600000).toISOString()
        : undefined,
      endTime: s.endTime
        ? new Date(new Date(s.endTime).getTime() - 3600000).toISOString()
        : undefined,
    })),
    findings: ['FND-8837', 'FND-8814', 'FND-8802'],
    incidents: ['INC-2026-041'],
    createdAt: '2026-09-16T14:07:50Z',
    completedAt: '2026-09-16T14:08:42Z',
    progress: {
      flowsProcessed: 7214,
      hostsIdentified: 142,
      protocolsFound: 5,
      findingsSoFar: 3,
      errors: [],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// System Health
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SYSTEM_HEALTH: SystemHealth = {
  overall: 'degraded',
  components: [
    {
      name: 'API Gateway',
      status: 'healthy',
      latencyMs: 12,
      errorRate: 0.01,
      detail: 'v4.2.1 — all routes nominal',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Sensor Manager',
      status: 'healthy',
      latencyMs: 8,
      errorRate: 0,
      queueDepth: 0,
      detail: '3 sensors registered, 2 online, 1 degraded',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Capture Storage',
      status: 'healthy',
      latencyMs: 24,
      errorRate: 0,
      detail: 'S3-compatible backend — 84.2 TB used / 200 TB total',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Flow Database',
      status: 'healthy',
      latencyMs: 18,
      errorRate: 0,
      queueDepth: 142,
      detail: 'ClickHouse cluster — 3 nodes healthy',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'DPI Engine',
      status: 'degraded',
      latencyMs: 847,
      errorRate: 2.4,
      queueDepth: 1840,
      detail: 'High queue depth — processing backlog from CAP-1042 (1.84 GB upload). Normal in ~8 minutes.',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'ML Inference',
      status: 'healthy',
      latencyMs: 142,
      errorRate: 0,
      queueDepth: 28,
      detail: 'GPU cluster online — 4× A100, model v4.2.1',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'AI Analysis (LLM)',
      status: 'healthy',
      latencyMs: 2840,
      errorRate: 0.1,
      queueDepth: 2,
      detail: 'netsentinal-ai-v3.2.1-forensic — warm',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Graph Engine',
      status: 'healthy',
      latencyMs: 32,
      errorRate: 0,
      detail: 'Neo4j cluster — 3 nodes healthy',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Notification Service',
      status: 'healthy',
      latencyMs: 6,
      errorRate: 0,
      queueDepth: 0,
      detail: 'All channels operational',
      lastChecked: '2026-09-16T15:12:00Z',
    },
    {
      name: 'Report Engine',
      status: 'healthy',
      latencyMs: 88,
      errorRate: 0,
      detail: 'LaTeX + Markdown renderer — v2.1.4',
      lastChecked: '2026-09-16T15:12:00Z',
    },
  ],
  timestamp: '2026-09-16T15:12:00Z',
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (8 items)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NOTIF-001',
    type: 'error',
    title: 'CRITICAL: Auto-preservation triggered',
    message: 'Trigger TRG-883 (score 92) exceeded threshold on FIN-WS-014. CAP-1050 auto-preserved — 684 MB, 41m 38s.',
    timestamp: '2026-09-16T14:26:04Z',
    read: true,
    link: '/captures/CAP-1050',
  },
  {
    id: 'NOTIF-002',
    type: 'error',
    title: 'Incident created: INC-2026-041',
    message: 'New incident "Suspicious outbound communication from FIN-WS-014" created. Risk: 91 · 5 findings.',
    timestamp: '2026-09-16T15:08:42Z',
    read: false,
    link: '/incidents/INC-2026-041',
  },
  {
    id: 'NOTIF-003',
    type: 'warning',
    title: 'Sensor SNS-051 degraded',
    message: 'ACME-BRANCH-05 has not reported a heartbeat in 4 minutes. Capture engine offline. 7 uploads queued.',
    timestamp: '2026-09-16T15:08:14Z',
    read: false,
    link: '/health',
  },
  {
    id: 'NOTIF-004',
    type: 'success',
    title: 'Analysis completed: INV-001',
    message: 'Deep analysis of CAP-1050 completed in 52s. 5 findings, 1 incident. AI narrative generated.',
    timestamp: '2026-09-16T15:08:42Z',
    read: false,
    link: '/incidents',
  },
  {
    id: 'NOTIF-005',
    type: 'warning',
    title: 'DPI Engine queue depth elevated',
    message: 'DPI Engine queue depth at 1,840 items. Processing CAP-1042 (1.84 GB). Expected to clear in ~8 minutes.',
    timestamp: '2026-09-16T15:05:12Z',
    read: true,
    link: '/health',
  },
  {
    id: 'NOTIF-006',
    type: 'info',
    title: 'Finding FND-8841 AI analysis ready',
    message: 'AI analysis for "Possible C2-style periodic traffic" is available. 7 next steps recommended.',
    timestamp: '2026-09-16T15:08:42Z',
    read: false,
    link: '/findings/FND-8841',
  },
  {
    id: 'NOTIF-007',
    type: 'warning',
    title: 'High trigger score: TRG-879',
    message: 'Score 68 on DEV-WS-028 — new destination cdn-sync-update.net. Below threshold; review recommended.',
    timestamp: '2026-09-16T13:48:22Z',
    read: true,
    link: '/findings',
  },
  {
    id: 'NOTIF-008',
    type: 'info',
    title: 'Manual capture CAP-1047 analyzed',
    message: 'Analysis of manual capture CAP-1047 completed. 3 findings generated (1 HIGH, 1 MEDIUM, 1 LOW).',
    timestamp: '2026-09-16T14:02:14Z',
    read: true,
    link: '/captures/CAP-1047',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_REPORTS: Report[] = [
  {
    id: 'RPT-001',
    type: 'technical_incident',
    title: 'Q3 Network Security Assessment — Incident Report: INC-2026-041',
    status: 'draft',
    customerId: 'CUST-001',
    engagementId: 'ENG-001',
    version: '0.1',
    sections: [
      {
        id: 'SEC-001',
        title: 'Executive Summary',
        content:
          '## Executive Summary\n\nDuring network monitoring for the Q3 Security Assessment, NetSentinal AI detected and auto-preserved evidence of a suspected active compromise on financial workstation **FIN-WS-014** (10.0.0.14). The workstation was observed making periodic encrypted connections to an external IP address (45.77.21.184) at consistent ~62-second intervals — a pattern strongly indicative of Command & Control (C2) malware beaconing. A concurrent outbound data transfer of approximately **4.8 GB** to the same destination raises significant concern for data exfiltration.\n\n**Immediate containment of FIN-WS-014 is recommended.**',
        order: 1,
        evidenceRefs: ['EVD-001', 'EVD-002'],
      },
      {
        id: 'SEC-002',
        title: 'Incident Timeline',
        content:
          '## Incident Timeline\n\n| Time (UTC) | Event |\n|---|---|\n| 11:22 | DEV-WS-028 first contacted suspicious infrastructure on port 8443 |\n| 13:48 | DNS tunneling activity detected from FIN-WS-014 |\n| 14:26 | C2 beaconing began; auto-preservation triggered (CAP-1050) |\n| 14:38 | Large outbound data transfer commenced (~35 Mbps) |\n| 15:07 | All outbound connections from FIN-WS-014 ceased |\n| 15:08 | AI analysis completed; Incident INC-2026-041 created |',
        order: 2,
        evidenceRefs: [],
      },
      {
        id: 'SEC-003',
        title: 'Technical Findings',
        content:
          '## Technical Findings\n\n### FND-8841 — C2 Beaconing (HIGH)\nHost FIN-WS-014 made 31 outbound TLS 1.3 connections to 45.77.21.184:443 at a statistically consistent 62-second interval (R²=0.97). The JA3 fingerprint `e7d705a3286e19ea42f587b344ee6865` matches patterns from known post-exploitation frameworks. No SNI extension was present in the TLS handshake, and the server certificate was self-signed.\n\n### FND-8837 — DNS Tunneling (HIGH)\nHigh-entropy DNS TXT queries to `exfil.cdn-sync-update.net` contained Base64-encoded payloads in subdomain labels (avg 376 bytes per query, entropy 4.82 bits). This is consistent with a DNS tunnel protocol used for C2 communication or data staging.\n\n### FND-8829 — Volume Anomaly (MEDIUM)\nApproximately 4.8 GB of data was transferred outbound during the beaconing period — a 2,400% deviation from this host\'s 30-day baseline. Peak bandwidth: 42.7 Mbps.',
        order: 3,
        evidenceRefs: ['EVD-001', 'EVD-002', 'EVD-003', 'EVD-004'],
      },
      {
        id: 'SEC-004',
        title: 'Recommendations',
        content:
          '## Recommendations\n\n1. **Immediately isolate FIN-WS-014** from all network segments.\n2. **Preserve forensic image** of FIN-WS-014 disk and memory.\n3. **Block at perimeter**: 45.77.21.184 and 185.220.101.47.\n4. **Review Active Directory logs** for FIN-WS-014 over the past 7 days.\n5. **Check for lateral movement** from FIN-WS-014 to other internal hosts.\n6. **Restore SNS-051** (ACME-BRANCH-05) to ensure complete network visibility.\n7. **Initiate password resets** for all accounts that authenticated on FIN-WS-014.\n8. **Notify incident response team** and assess regulatory notification requirements.',
        order: 4,
        evidenceRefs: [],
      },
    ],
    createdAt: '2026-09-16T15:10:00Z',
    updatedAt: '2026-09-16T15:10:00Z',
    createdBy: 'Alex Morgan',
    incidentIds: ['INC-2026-041'],
    findingIds: ['FND-8841', 'FND-8837', 'FND-8829', 'FND-8814', 'FND-8802'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Convenience lookup maps
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SENSOR_MAP = Object.fromEntries(MOCK_SENSORS.map(s => [s.id, s]))
export const MOCK_CAPTURE_MAP = Object.fromEntries(MOCK_CAPTURES.map(c => [c.id, c]))
export const MOCK_TRIGGER_MAP = Object.fromEntries(MOCK_TRIGGERS.map(t => [t.id, t]))
export const MOCK_HOST_MAP = Object.fromEntries(MOCK_HOSTS.map(h => [h.id, h]))
export const MOCK_DESTINATION_MAP = Object.fromEntries(MOCK_DESTINATIONS.map(d => [d.id, d]))
export const MOCK_FLOW_MAP = Object.fromEntries(MOCK_FLOWS.map(f => [f.id, f]))
export const MOCK_FINDING_MAP = Object.fromEntries(MOCK_FINDINGS.map(f => [f.id, f]))
export const MOCK_INCIDENT_MAP = Object.fromEntries(MOCK_INCIDENTS.map(i => [i.id, i]))
export const MOCK_EVIDENCE_MAP = Object.fromEntries(MOCK_EVIDENCE.map(e => [e.id, e]))
export const MOCK_INVESTIGATION_MAP = Object.fromEntries(MOCK_INVESTIGATIONS.map(i => [i.id, i]))
export const MOCK_REPORT_MAP = Object.fromEntries(MOCK_REPORTS.map(r => [r.id, r]))
