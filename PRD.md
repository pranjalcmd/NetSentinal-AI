# NetSentinel — Product Requirements Document

Version: 2.0  
Status: Implementation-ready  
Product: NetSentinel AI

## 1. Product promise

NetSentinel turns network telemetry into an explainable security picture. It accepts PCAP/PCAPNG captures and live application telemetry, normalizes both into the same flow model, detects suspicious behaviour with rules plus ML, correlates related flows into incidents, and shows the result as an interactive network mesh.

### Judge-ready one-liner

> NetSentinel is a privacy-aware network intelligence cockpit where every connection becomes a visible, explainable edge in a live 3D/2D security mesh.

## 2. Product principles

1. **One flow model:** PCAP and live agent data must enter the same analysis pipeline.
2. **Truthful UI:** demo data is labelled; loading, empty, stale and error states are explicit.
3. **Evidence before opinion:** every alert links back to flows, rules, features and related entities.
4. **Privacy by default:** collect normalized metadata, not raw payloads, passwords or tokens.
5. **Operational clarity:** 3D is for orientation and storytelling; dense investigation stays readable in 2D tables and panels.
6. **Deep seams:** capture, ingest, analysis, graph projection and presentation communicate through small stable interfaces.

## 3. Users and jobs

### SOC analyst

- See whether the environment is healthy now.
- Find the riskiest host, destination and connection.
- Understand why a flow was flagged.
- Move from alert to incident to evidence without losing context.

### Security consultant / investigator

- Upload a capture or reopen a previous capture.
- Explore entities and paths through the network.
- Produce an explainable report.

### Customer / site owner

- Install a small agent in an application backend.
- See whether telemetry is arriving and when it last flushed.
- Understand what data leaves the site.

## 4. Information architecture

### Public home (`/`)

Purpose: explain the product in one cinematic interaction and route the visitor into the product.

Required sections:

1. **Interactive network hero** — dark space, a glowing central NetSentinel core, orbiting internal hosts and external destinations, animated connection arcs, visible packets travelling along edges.
2. **Live signal readout** — `N nodes`, `N active edges`, `N suspicious flows`, `Last analysis`.
3. **Scroll narrative** — Capture → Normalize → Detect → Correlate → Explain.
4. **Trust strip** — metadata-first, PCAP + live agent, rules + ML, explainable findings.
5. **Primary CTA** — `Explore dashboard`.

The hero must remain useful without WebGL: show a static SVG/CSS mesh fallback with the same labels and CTA.

### Operations dashboard (`/overview`)

Purpose: answer “what needs attention?” within five seconds.

Layout:

- Header: environment name, live/stale indicator, refresh, capture selector.
- KPI rail: total flows, suspicious flows, high-risk flows, incidents, telemetry freshness.
- Main canvas: connected network mesh. Internal hosts on the left/centre, services in the middle, external destinations on the right. Edges visibly connect the exact nodes that appear in the data.
- Right rail: top active incident, top risky destination, top noisy host.
- Lower area: severity timeline, protocol mix, recent alerts.

### Network mesh (`/network/mesh`)

Purpose: investigate relationships.

Required interactions:

- Zoom, pan, fit-to-screen and reset.
- Hover edge: show source, destination, application, bytes, packets, risk and timestamp.
- Click node: pin it and open entity details.
- Click edge: open flow details.
- Filter by severity, application, protocol, host and incident.
- Focus modes: Traffic, Threat, Incident and Host.
- Highlight a selected node’s first-degree connections; dim unrelated graph elements.
- Show a legend for node types and severity colours.

### Investigation surfaces

- Captures: upload, job status, history and reload.
- Alerts/findings: sortable, filterable, evidence-linked.
- Incidents: correlated findings with timeline and graph context.
- AI: explanation and report generation from minimized telemetry only.
- Health/sensors: ingestion status, DPI mode, model status and last event.

## 5. Visual direction

### Home visual world: “Signal in the dark”

- Background: near-black graphite/navy, subtle radial depth.
- Accent: cyan/teal for live telemetry and trusted system state.
- Severity: critical red, high orange, medium amber, low blue.
- Typography: Inter for interface, IBM Plex Mono for telemetry and technical values.
- 3D language: spherical network mesh, thin luminous arcs, soft node halos, restrained star field, slow camera drift.
- Avoid: decorative random planets, fake global sensor claims, excessive neon, unreadable glass cards, animation that hides data.

### Dashboard visual world: “Quiet SOC workstation”

- Dense, high-contrast, low-radius panels.
- The graph gets the largest visual area.
- Colour is reserved for live state, severity and selection.
- Tables use monospace only for IDs, IPs, ports, timestamps and counts.
- Motion communicates state changes, not decoration.

## 6. Canonical data contract

Every source must produce this normalized flow shape:

```ts
type Flow = {
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
  metadata: Record<string, unknown>;
  ml_detection?: Record<string, unknown>;
};
```

The network graph is derived from the flow list, never maintained as a second manually edited dataset:

```ts
type GraphNode = {
  id: string;
  label: string;
  kind: 'internal' | 'service' | 'external' | 'unknown';
  risk: number;
  flow_count: number;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  flow_ids: string[];
  application?: string;
  bytes: number;
  packets: number;
  risk: number;
  severity?: string;
};
```

### Graph invariants

- Every edge `source` and `target` must match an existing node ID.
- Every edge must contain at least one real `flow_id`.
- Aggregated edge totals must equal the sum of its referenced flows.
- A selected edge must be traceable to a flow detail route.
- If graph data is missing, show an honest empty state; do not invent nodes.

## 7. Backend wiring contract

The frontend must use a single typed client module. Components must not create ad-hoc URLs or duplicate response mapping.

Canonical endpoints already exposed by the backend:

| Capability | Method | Endpoint |
|---|---:|---|
| Health | GET | `/api/health` |
| Summary | GET | `/api/dashboard` |
| Flows | GET | `/api/flows` |
| Flow detail | GET | `/api/flows/{flow_id}` |
| Graph | GET | `/api/network/graph` |
| Entities | GET | `/api/entities` |
| Alerts | GET | `/api/alerts` |
| Alert detail | GET | `/api/alerts/{id}` |
| Explain alert | POST | `/api/alerts/{id}/explain` |
| AI question | POST | `/api/ai/ask` |
| AI report | POST | `/api/ai/report` |
| Path finder | POST | `/api/pathfinder` |
| Capture upload | POST | `/api/analyze/pcap` |
| Capture history | GET | `/api/jobs` |
| Reload capture | POST | `/api/jobs/{id}/load` |
| Live ingest | POST | `/api/agent/ingest` |

### State rules

- Initial fetch: skeleton state.
- Successful fetch with zero records: empty state with next action.
- Request failure: retry state with human-readable cause.
- Live data older than the freshness threshold: `stale`, never `live`.
- Refresh must preserve selected filters when possible.
- Changing capture/job must invalidate all graph, KPI, alert and timeline queries together.

## 8. Capture and live-agent behaviour

The live agent batches events into flows and sends them to `/api/agent/ingest`. Production integrations are application-level SDKs or backend middleware; browser JavaScript alone cannot inspect arbitrary packet-level traffic.

The agent must:

- identify itself with `client_id` and API key;
- aggregate repeated destination/application events;
- send HTTPS requests in batches;
- retain a failed batch for retry;
- avoid raw payloads, cookies, passwords and authorization headers;
- expose last flush, queue size and last error to the health surface.

## 9. Detection and explanation

Detection is layered:

1. L7/DPI protocol and hostname identity;
2. explicit behavioural rules;
3. ML classification;
4. cross-flow context and correlation;
5. severity and risk scoring.

AI explains evidence. It does not override rule severity, confidence, privacy filters or recommended system state. A finding must remain useful if AI is unavailable.

## 10. Accessibility, performance and safety

- Provide keyboard access to filters, node selection and detail panels.
- Never encode severity using colour alone.
- Respect `prefers-reduced-motion`.
- Pause or reduce 3D animation on hidden tabs and small screens.
- Keep WebGL device-pixel-ratio capped at 2.
- Use the 2D graph/table fallback when WebGL is unavailable.
- Do not block dashboard content on the 3D hero.
- Never expose secrets in client bundles or rendered telemetry.

## 11. Demo acceptance criteria

The demo is ready only when all are true:

- The home hero is interactive and visibly shows connected nodes and animated edges.
- The dashboard graph uses real backend graph data, not a second hard-coded graph.
- Selecting a node or edge reveals the exact related entity/flow.
- Uploading or ingesting a capture updates KPIs, mesh, alerts and incidents together.
- A backend-down state is visible and recoverable.
- Empty and stale states are honest.
- The app builds and lint passes.
- At least one test proves that graph edges reference valid nodes and real flows.

## 12. Deliberate MVP limits

- No browser-wide packet sniffer in a normal web page; use a backend SDK, extension or network sensor for that scope.
- No automatic blocking or remediation.
- No raw-payload retention by default.
- No separate frontend-only analytics dataset.
- No second graph engine unless the existing `NetworkMesh` cannot satisfy a measured requirement.

## 26.2. Canonical graph and evidence wiring

This legacy section anchor is retained for backend documentation and tests. The
current requirements are defined in sections 6–9 above: graph edges must map to
real nodes and flows, and every alert must remain traceable to evidence.

## Compatibility index for existing implementation references

The following anchors preserve the section references used by the existing
backend and tests. They are intentionally short; the redesigned requirements
above are authoritative for new work.

### 1.2. Product principles
### 13.4. Analysis behaviour
### 13.8. Provider behaviour
### 15. Reports
### 16. AI analyst layer
### 16.1. AI safety
### 19. Data model
### 19.1. Flow model
### 19.2. Finding model
### 20. Detection
### 20.1. Detection inputs
### 21. Scoring
### 22. Protocol analysis
### 23. Behavioural rules
### 24. Correlation
### 25. Alert projection
### 26. Risk model
### 26.1. Severity
### 26.3. Confidence
### 27. Capture parsing
### 27.1. DPI adapter
### 28. Synthetic data
### 28.2. Sample generation
### 29. API behaviour
### 30. Empty and partial captures
### 32. Persistence
### 45. AI explanations
### 46. Privacy minimization
### 47. Failure handling
### 51. Reports and exports
### 53. Detection tests
### 66. Non-remediation policy
### 68. Model boundaries
