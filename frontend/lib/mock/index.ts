/**
 * NetSentinal AI — Mock Data & Services
 *
 * Deterministic mock data for all domain entities. Used by the shell
 * and all UI components during development.
 */

import type {
  Customer,
  Engagement,
  ConsultantContext,
  AppNotification,
  Finding,
  Incident,
  Host,
  Capture,
  Sensor,
  SearchResult,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Context mocks
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CUSTOMER: Customer = {
  id: 'cust-001',
  name: 'Acme Financial',
  industry: 'financial_services',
  tier: 'enterprise',
  contactEmail: 'cto@acmefinancial.com',
  contactName: 'Jordan Mercer',
  createdAt: '2026-01-15T09:00:00Z',
};

export const MOCK_ENGAGEMENT: Engagement = {
  id: 'eng-001',
  customerId: 'cust-001',
  name: 'Q3 Network Assessment',
  type: 'network_assessment',
  status: 'active',
  startDate: '2026-07-01T00:00:00Z',
  endDate: '2026-09-30T23:59:59Z',
  scope: 'Core financial network segments — trading floor, back-office, DMZ',
  assets: ['10.0.0.0/8', '172.16.0.0/12'],
  consultantId: 'user-consultant-01',
  consultantName: 'Alex Marchetti',
};

export const MOCK_CONSULTANT: ConsultantContext = {
  name: 'Alex Marchetti',
  role: 'Senior Consultant',
};

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-001',
    type: 'error',
    title: 'Critical Finding Detected',
    message: 'DNS tunneling activity confirmed on host 10.0.4.17 — Score 94',
    timestamp: '2026-09-17T16:01:00Z',
    read: false,
    link: '/findings',
  },
  {
    id: 'notif-002',
    type: 'warning',
    title: 'Auto-Preservation Triggered',
    message: 'Capture CAP-0044 auto-preserved due to score 87 on 10.0.3.142',
    timestamp: '2026-09-17T15:48:00Z',
    read: false,
    link: '/captures',
  },
  {
    id: 'notif-003',
    type: 'info',
    title: 'Sensor SNS-041 Degraded',
    message: 'SNS-041 reporting 20% packet loss. Check interface configuration.',
    timestamp: '2026-09-17T15:30:00Z',
    read: false,
    link: '/health',
  },
  {
    id: 'notif-004',
    type: 'success',
    title: 'Investigation Complete',
    message: 'INV-0021 completed — 6 findings, 1 new incident raised',
    timestamp: '2026-09-17T15:00:00Z',
    read: true,
    link: '/incidents',
  },
  {
    id: 'notif-005',
    type: 'warning',
    title: 'Lateral Movement Suspected',
    message: 'Host 10.0.2.88 scanning internal subnets — 347 probes in 60s',
    timestamp: '2026-09-17T14:45:00Z',
    read: true,
    link: '/findings',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Findings mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_FINDINGS: Finding[] = [
  {
    id: 'find-001',
    title: 'DNS Tunneling — Exfiltration Suspected',
    description: 'Host 10.0.4.17 is encoding data in DNS TXT record queries targeting a newly registered domain. Beacon interval is highly periodic at 30s.',
    severity: 'critical',
    status: 'confirmed',
    category: 'dns_tunneling',
    riskScore: 94,
    confidence: 0.96,
    hostIds: ['host-004'],
    destinationIds: ['dest-007'],
    captureId: 'cap-0042',
    sensorId: 'sns-042',
    triggerIds: ['trg-011'],
    flowIds: ['flow-0091', 'flow-0092', 'flow-0093'],
    evidenceIds: ['ev-001', 'ev-002'],
    firstSeen: '2026-09-17T14:22:00Z',
    lastSeen: '2026-09-17T16:18:00Z',
  },
  {
    id: 'find-002',
    title: 'Beaconing — Custom C2 Protocol',
    description: 'Host 10.0.2.55 is making periodic HTTPS connections to 185.220.101.47 (TOR exit node) at a 5-minute interval with anomalous JA3 fingerprint.',
    severity: 'high',
    status: 'open',
    category: 'beaconing',
    riskScore: 87,
    confidence: 0.91,
    hostIds: ['host-002'],
    destinationIds: ['dest-002'],
    captureId: 'cap-0041',
    sensorId: 'sns-042',
    triggerIds: ['trg-009'],
    flowIds: ['flow-0044', 'flow-0045'],
    evidenceIds: ['ev-003'],
    firstSeen: '2026-09-17T12:05:00Z',
    lastSeen: '2026-09-17T16:10:00Z',
  },
  {
    id: 'find-003',
    title: 'Lateral Movement — Internal Port Scan',
    description: 'Host 10.0.2.88 scanned 347 internal IPs on ports 22, 445, 3389 in under 60 seconds. Consistent with automated lateral movement tooling.',
    severity: 'high',
    status: 'needs_investigation',
    category: 'lateral_movement',
    riskScore: 82,
    confidence: 0.88,
    hostIds: ['host-003'],
    destinationIds: [],
    captureId: 'cap-0040',
    sensorId: 'sns-042',
    triggerIds: ['trg-008'],
    flowIds: ['flow-0031', 'flow-0032'],
    evidenceIds: [],
    firstSeen: '2026-09-17T13:44:00Z',
    lastSeen: '2026-09-17T13:46:00Z',
  },
  {
    id: 'find-004',
    title: 'Data Exfiltration — Large Outbound Transfer',
    description: 'Workstation 10.0.1.42 transferred 2.4GB to an external IP in Austria over 18 minutes. DPI shows encrypted blob, not matching any known application.',
    severity: 'critical',
    status: 'open',
    category: 'data_exfiltration',
    riskScore: 91,
    confidence: 0.89,
    hostIds: ['host-001'],
    destinationIds: ['dest-005'],
    captureId: 'cap-0044',
    sensorId: 'sns-042',
    triggerIds: ['trg-012'],
    flowIds: ['flow-0101', 'flow-0102'],
    evidenceIds: ['ev-004'],
    firstSeen: '2026-09-17T15:20:00Z',
    lastSeen: '2026-09-17T15:38:00Z',
  },
  {
    id: 'find-005',
    title: 'Rare Port Activity — 4444/tcp Outbound',
    description: 'Host 10.0.3.99 initiated 12 connections on port 4444/tcp to 3 distinct external IPs. Port 4444 is commonly used by Metasploit reverse shells.',
    severity: 'medium',
    status: 'open',
    category: 'rare_port',
    riskScore: 72,
    confidence: 0.78,
    hostIds: ['host-005'],
    destinationIds: ['dest-009'],
    captureId: 'cap-0040',
    sensorId: 'sns-042',
    triggerIds: [],
    flowIds: ['flow-0055'],
    evidenceIds: [],
    firstSeen: '2026-09-17T11:30:00Z',
    lastSeen: '2026-09-17T14:15:00Z',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Incidents mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    title: 'APT-Style Intrusion — Acme Financial Trading Floor',
    description: 'Multi-stage intrusion campaign spanning beaconing, lateral movement, and DNS-based exfiltration across the trading floor segment.',
    status: 'investigating',
    riskScore: 96,
    confidence: 0.93,
    hostIds: ['host-001', 'host-002', 'host-003', 'host-004'],
    findingIds: ['find-001', 'find-002', 'find-003', 'find-004'],
    captureIds: ['cap-0040', 'cap-0041', 'cap-0042', 'cap-0044'],
    sensorIds: ['sns-042'],
    firstSeen: '2026-09-17T12:05:00Z',
    lastSeen: '2026-09-17T16:18:00Z',
    aiSummary: 'A sophisticated multi-stage attack is underway on the Acme Financial trading floor segment. The threat actor appears to have gained initial access through host 10.0.2.55, established C2 beaconing, moved laterally to additional hosts, and is actively exfiltrating data via DNS tunneling.',
  },
  {
    id: 'inc-002',
    title: 'Anomalous Outbound Data Transfer — Back-Office',
    description: 'Large-volume encrypted transfer from workstation 10.0.1.42 to unregistered Austrian IP address.',
    status: 'open',
    riskScore: 81,
    confidence: 0.85,
    hostIds: ['host-001'],
    findingIds: ['find-004'],
    captureIds: ['cap-0044'],
    sensorIds: ['sns-042'],
    firstSeen: '2026-09-17T15:20:00Z',
    lastSeen: '2026-09-17T15:38:00Z',
    aiSummary: 'An unusual 2.4GB encrypted transfer was initiated from a back-office workstation to an external IP with no prior communication history. The transfer pattern and destination suggest potential data staging or exfiltration.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hosts mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_HOSTS: Host[] = [
  {
    id: 'host-001',
    ip: '10.0.1.42',
    hostname: 'ACMEFIN-WS042',
    role: 'workstation',
    internal: true,
    customerId: 'cust-001',
    riskScore: 91,
    findings: ['find-004'],
    flows: 18240,
    bytesIn: 142000000,
    bytesOut: 2580000000,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-09-17T15:38:00Z',
  },
  {
    id: 'host-002',
    ip: '10.0.2.55',
    hostname: 'ACMEFIN-TRD055',
    role: 'workstation',
    internal: true,
    customerId: 'cust-001',
    riskScore: 87,
    findings: ['find-002'],
    flows: 6710,
    bytesIn: 41000000,
    bytesOut: 38000000,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-09-17T16:10:00Z',
  },
  {
    id: 'host-003',
    ip: '10.0.2.88',
    hostname: 'ACMEFIN-TRD088',
    role: 'workstation',
    internal: true,
    customerId: 'cust-001',
    riskScore: 82,
    findings: ['find-003'],
    flows: 2190,
    bytesIn: 8200000,
    bytesOut: 6100000,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-09-17T13:46:00Z',
  },
  {
    id: 'host-004',
    ip: '10.0.4.17',
    hostname: 'ACMEFIN-SRV017',
    role: 'application_server',
    internal: true,
    customerId: 'cust-001',
    riskScore: 94,
    findings: ['find-001'],
    flows: 44200,
    bytesIn: 210000000,
    bytesOut: 184000000,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-09-17T16:18:00Z',
  },
  {
    id: 'host-005',
    ip: '10.0.3.99',
    hostname: 'ACMEFIN-BO099',
    role: 'workstation',
    internal: true,
    customerId: 'cust-001',
    riskScore: 72,
    findings: ['find-005'],
    flows: 3400,
    bytesIn: 12000000,
    bytesOut: 9800000,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-09-17T14:15:00Z',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Captures mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CAPTURES: Capture[] = [
  {
    id: 'cap-0044',
    type: 'AUTO_PRESERVED',
    status: 'ANALYZED',
    sensorId: 'sns-042',
    sensorName: 'SNS-042',
    startTime: '2026-09-17T15:18:00Z',
    endTime: '2026-09-17T15:40:00Z',
    duration: 1320,
    sizeBytes: 717225984,
    triggerIds: ['trg-012'],
    sha256: 'a3f9d2c1b0e8f7a6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2',
    analysisVersion: '3.1.4',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    uploadedAt: '2026-09-17T15:41:22Z',
    metadata: {
      packets: 4820000,
      flows: 18240,
      hosts: 42,
      protocols: ['TLS', 'HTTP/2', 'DNS', 'TCP'],
      dpiVersion: '2.4.1',
      analysisJobId: 'job-0091',
    },
  },
  {
    id: 'cap-0042',
    type: 'MANUAL',
    status: 'ANALYZED',
    sensorId: 'sns-042',
    sensorName: 'SNS-042',
    startTime: '2026-09-17T14:20:00Z',
    endTime: '2026-09-17T14:50:00Z',
    duration: 1800,
    sizeBytes: 1975308288,
    triggerIds: ['trg-011'],
    sha256: 'b4e8f2a1c9d7b5e3f0a8c6d4b2e0f8d6c4b2a0f8e6d4c2b0a8f6e4d2c0b8f6e4',
    analysisVersion: '3.1.4',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    uploadedAt: '2026-09-17T14:51:30Z',
    metadata: {
      packets: 6140000,
      flows: 24800,
      hosts: 58,
      protocols: ['DNS', 'TLS', 'HTTP', 'TCP', 'UDP'],
      dpiVersion: '2.4.1',
      analysisJobId: 'job-0088',
    },
  },
  {
    id: 'cap-0041',
    type: 'ROLLING',
    status: 'ANALYZED',
    sensorId: 'sns-042',
    sensorName: 'SNS-042',
    startTime: '2026-09-17T12:00:00Z',
    endTime: '2026-09-17T13:00:00Z',
    duration: 3600,
    sizeBytes: 3145728000,
    triggerIds: ['trg-009'],
    sha256: 'c5f9e3b1d7a5f3e1c9b7a5f3e1c9b7a5f3e1c9b7a5d3e1c9b7a5f3e1c9b7a501',
    analysisVersion: '3.1.4',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    uploadedAt: '2026-09-17T13:01:15Z',
    metadata: {
      packets: 9820000,
      flows: 42100,
      hosts: 91,
      protocols: ['TLS', 'HTTP/2', 'DNS', 'SMB', 'RDP', 'TCP', 'UDP'],
      dpiVersion: '2.4.1',
      analysisJobId: 'job-0085',
    },
  },
  {
    id: 'cap-0040',
    type: 'ROLLING',
    status: 'ANALYZED',
    sensorId: 'sns-042',
    sensorName: 'SNS-042',
    startTime: '2026-09-17T11:00:00Z',
    endTime: '2026-09-17T12:00:00Z',
    duration: 3600,
    sizeBytes: 2684354560,
    triggerIds: ['trg-008'],
    sha256: 'd6a0f4c2e8b6d4c2a0e8c6d4b2a0e8c6b4a2e0c8b6d4c2a0e8c6d4b2a0e8c6d4',
    analysisVersion: '3.1.4',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    uploadedAt: '2026-09-17T12:01:05Z',
    metadata: {
      packets: 8210000,
      flows: 35600,
      hosts: 78,
      protocols: ['TLS', 'HTTP', 'DNS', 'TCP', 'UDP', 'ICMP'],
      dpiVersion: '2.4.1',
      analysisJobId: 'job-0082',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sensors mock data
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SENSORS: Sensor[] = [
  {
    id: 'sns-042',
    name: 'SNS-042',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    hostname: 'netsentinal-sensor-042.acmefin.internal',
    os: 'NetSentinal OS 2.4',
    version: '2.4.1',
    interface: 'eth1',
    status: 'online',
    lastSeen: '2026-09-17T16:26:00Z',
    captureEngine: {
      healthy: true,
      rollingCapture: true,
      manualCapture: null,
      autoPreservation: true,
      queuedUploads: 0,
    },
    metrics: {
      mbps: 842,
      pps: 98400,
      flowsPerSec: 1240,
      activeHosts: 91,
      bufferDuration: 3600,
      bufferSize: 107374182400,
      bufferPercent: 68,
    },
  },
  {
    id: 'sns-041',
    name: 'SNS-041',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    hostname: 'netsentinal-sensor-041.acmefin.internal',
    os: 'NetSentinal OS 2.4',
    version: '2.4.0',
    interface: 'eth1',
    status: 'degraded',
    lastSeen: '2026-09-17T16:24:00Z',
    captureEngine: {
      healthy: true,
      rollingCapture: true,
      manualCapture: null,
      autoPreservation: false,
      queuedUploads: 2,
    },
    metrics: {
      mbps: 215,
      pps: 22100,
      flowsPerSec: 312,
      activeHosts: 34,
      bufferDuration: 3600,
      bufferSize: 107374182400,
      bufferPercent: 41,
    },
  },
  {
    id: 'sns-043',
    name: 'SNS-043',
    customerId: 'cust-001',
    engagementId: 'eng-001',
    hostname: 'netsentinal-sensor-043.acmefin.internal',
    os: 'NetSentinal OS 2.4',
    version: '2.4.1',
    interface: 'eth0',
    status: 'offline',
    lastSeen: '2026-09-17T14:10:00Z',
    captureEngine: {
      healthy: false,
      rollingCapture: false,
      manualCapture: null,
      autoPreservation: false,
      queuedUploads: 0,
    },
    metrics: {
      mbps: 0,
      pps: 0,
      flowsPerSec: 0,
      activeHosts: 0,
      bufferDuration: 0,
      bufferSize: 107374182400,
      bufferPercent: 0,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs a global search across all mock entity types.
 * Returns matched SearchResult items grouped by category.
 */
export function searchAll(query: string): SearchResult[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().trim();

  const results: SearchResult[] = [];

  // Search findings
  for (const f of MOCK_FINDINGS) {
    if (
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.severity.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'finding',
        id: f.id,
        title: f.title,
        subtitle: `${f.severity.toUpperCase()} · Score ${f.riskScore} · ${f.status}`,
        severity: f.severity,
        score: f.riskScore,
        timestamp: f.lastSeen,
        url: `/findings/${f.id}`,
      });
    }
  }

  // Search incidents
  for (const inc of MOCK_INCIDENTS) {
    if (
      inc.title.toLowerCase().includes(q) ||
      inc.description.toLowerCase().includes(q) ||
      inc.id.toLowerCase().includes(q) ||
      inc.status.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'incident',
        id: inc.id,
        title: inc.title,
        subtitle: `Score ${inc.riskScore} · ${inc.status} · ${inc.findingIds.length} findings`,
        score: inc.riskScore,
        timestamp: inc.lastSeen,
        url: `/incidents/${inc.id}`,
      });
    }
  }

  // Search hosts
  for (const h of MOCK_HOSTS) {
    if (
      h.ip.includes(q) ||
      (h.hostname && h.hostname.toLowerCase().includes(q)) ||
      (h.role && h.role.toLowerCase().includes(q)) ||
      h.id.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'host',
        id: h.id,
        title: h.hostname ?? h.ip,
        subtitle: `${h.ip} · Risk ${h.riskScore} · ${h.findings.length} findings`,
        score: h.riskScore,
        timestamp: h.lastSeen,
        url: `/network/hosts/${h.id}`,
      });
    }
  }

  // Search captures
  for (const c of MOCK_CAPTURES) {
    if (
      c.id.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q) ||
      c.sensorName.toLowerCase().includes(q) ||
      (c.filename && c.filename.toLowerCase().includes(q))
    ) {
      results.push({
        type: 'capture',
        id: c.id,
        title: c.filename ?? c.id,
        subtitle: `${c.type} · ${c.status} · ${c.sensorName}`,
        timestamp: c.startTime,
        url: `/captures/${c.id}`,
      });
    }
  }


  return results;
}
