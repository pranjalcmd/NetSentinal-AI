# NetSentinel Master Build Prompt

Copy this prompt into the coding agent when implementing or redesigning the project.

```text
You are the lead engineer and product designer for NetSentinel AI, an explainable network-security analytics product.

GOAL
Build a production-quality but focused experience: an interactive 3D network story on the public home page and a dense operational SOC dashboard where the real network connections are visible as a connected mesh. The implementation must preserve the existing backend contracts and must not create frontend-only fake wiring.

FIRST: READ THE REPO
Before editing, inspect:
- PRD.md
- README.md
- frontend/AGENTS.md and frontend/CLAUDE.md
- frontend/package.json
- frontend/app and frontend/components
- backend/app/main.py
- backend/app/services/analysis.py
- backend/app/services/graph.py
- client/capture_agent.py

Trace the real data path end to end:
capture/agent -> ingest or pcap endpoint -> normalized flows -> detection/ML -> graph projection -> frontend.
Do not guess endpoint names or response shapes. If a contract is unclear, inspect the backend implementation and document the assumption before coding.

NON-NEGOTIABLE ARCHITECTURE
1. One canonical Flow model for PCAP and live-agent data.
2. One typed frontend API client for all backend calls.
3. One graph adapter that maps backend graph data into render nodes and edges.
4. UI components render state; they do not invent domain data or duplicate API mapping.
5. The graph is derived from flows/entities returned by the backend. Never maintain a second hard-coded graph.
6. Keep capture, ingest, analysis, graph projection and presentation behind small stable interfaces.
7. Preserve working routes and backend response shapes unless a change is necessary and tested.

PUBLIC HOME PAGE
Create a memorable “Signal in the dark” home page.
- Full-screen dark graphite/navy background.
- Interactive WebGL network mesh: a glowing central NetSentinel core, internal hosts, services and external destinations connected by luminous arcs.
- Animate packets travelling along real-looking edges; keep motion slow and purposeful.
- Hover a node or edge to show a compact tooltip.
- Click the main CTA to open the dashboard.
- Add a scroll narrative: Capture, Normalize, Detect, Correlate, Explain.
- Show product truth: metadata-first, PCAP + live agent, rules + ML.
- Use the existing Three.js dependency where possible.
- Add a static SVG/CSS fallback for no-WebGL and reduced-motion users.
- Do not claim a real global sensor fleet unless the backend supplies it. Clearly label demo data.

DASHBOARD
Make the dashboard feel like a calm SOC workstation, not a marketing page.
- Header with environment, capture selector, refresh and live/stale state.
- KPI rail: total flows, suspicious flows, high-risk flows, incidents, freshness.
- Largest area: connected mesh with visible source -> destination relationships.
- Right rail: top incident, risky destination, noisy host.
- Bottom: severity timeline, protocol mix and recent alerts.
- Filters: severity, application/protocol, host, incident and time.
- Edge hover shows source, destination, application, bytes, packets, timestamp and risk.
- Node click pins selection and opens entity details.
- Edge click opens the exact related flow(s).
- Include loading, empty, stale, error and retry states.

GRAPH RULES
- Each rendered edge source and target must exist in the rendered node set.
- Each rendered edge must point to at least one backend flow_id.
- Aggregated bytes, packets and risk must be calculated from referenced flows or trusted backend fields.
- Selected graph objects must be traceable to existing detail routes.
- Use node kinds: internal, service, external, unknown.
- Use colour for meaning: teal/live, blue/low, amber/medium, orange/high, red/critical.
- Do not use random positions or random labels in production mode. Deterministic layout is preferred.

API/WIRING RULES
Use one typed module, for example frontend/lib/api.ts. All calls go through it.
Canonical routes:
GET /api/health
GET /api/dashboard
GET /api/flows
GET /api/flows/{flow_id}
GET /api/network/graph
GET /api/entities
GET /api/alerts
GET /api/alerts/{id}
POST /api/alerts/{id}/explain
POST /api/ai/ask
POST /api/ai/report
POST /api/pathfinder
POST /api/analyze/pcap
GET /api/jobs
POST /api/jobs/{id}/load
POST /api/agent/ingest

Never:
- hard-code production KPI values;
- call fetch() directly from many pages;
- silently convert backend errors into zeroes;
- show “live” when data is stale;
- render edges whose nodes do not exist;
- add a new dependency before checking installed packages and native CSS/Three.js capabilities.

BACKEND SAFETY
- Keep API-key authentication on live ingest.
- Use HTTPS in production.
- Do not send raw payloads, cookies, passwords, bearer tokens or authorization headers.
- Keep AI as an explanation layer, not the detector of record.

VISUAL QUALITY
- Use the existing graphite/navy/cyan design language as the base.
- Use Inter for UI and IBM Plex Mono for telemetry values.
- Keep cards restrained; avoid excessive glassmorphism and decorative gradients.
- Make the 3D hero impressive but keep the dashboard scannable.
- Respect keyboard navigation, visible focus, reduced motion and responsive layouts.
- Cap WebGL pixel ratio at 2 and dispose of Three.js resources on unmount.

IMPLEMENTATION ORDER
1. Validate backend endpoint shapes and existing graph component.
2. Create or update shared types and the single API client.
3. Create the graph adapter and validate graph invariants.
4. Wire dashboard KPIs, alerts and mesh to real data.
5. Build/refine the home 3D hero and fallback.
6. Add selection/detail interactions.
7. Add loading, empty, stale, error and reduced-motion states.
8. Run typecheck, lint, build and focused tests.
9. Inspect desktop and mobile screenshots once, fix the whole batch, then stop.

TESTS REQUIRED
- API client handles success and non-2xx responses.
- Graph adapter rejects or filters edges with missing node IDs.
- Every rendered edge maps to a real flow_id.
- Dashboard renders loading, empty, stale and error states.
- Home falls back when WebGL is unavailable or reduced motion is enabled.
- Existing backend/API tests remain green.

DEFINITION OF DONE
- Home page is interactive and visually memorable.
- Dashboard clearly shows which entities are connected and why.
- Clicking a graph object leads to real evidence.
- Upload/live ingest updates all dependent views through one source of truth.
- No fake production data is hidden in components.
- Build and lint pass.
- The final response lists changed files, verification results and any deliberately deferred work.

When you find an ambiguity, prefer the smallest implementation that preserves the existing contract. Do not stop at a plan: implement, verify, and report concrete results.
```

