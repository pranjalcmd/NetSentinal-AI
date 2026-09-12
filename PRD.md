# NetSentinel AI — In-Depth Product Requirements & Codebase Specification

**Document type:** Hackathon implementation PRD / engineering handoff / UI specification  
**Version:** 1.0  
**Status:** Build-ready MVP + stretch scope  
**Primary audience:** 4-person hackathon engineering team, UI designer, presenter, judges-facing team members  
**Product:** NetSentinel AI — AI-assisted network traffic intelligence platform

---

# 0. Executive Summary

NetSentinel AI is a security-analysis web application that turns authorized network captures into understandable, prioritized security findings.

The product has four technical layers:

1. **DPI layer:** nDPI identifies application/protocol information and exposes available flow-risk indicators.
2. **Detection layer:** our own transparent rules look for a deliberately small set of suspicious behaviours such as high DNS frequency, repeated connections, unusual legacy ports, and high outbound volume.
3. **AI layer:** an AI API receives minimized, structured telemetry and explains what the evidence may indicate, why it was flagged, what should be investigated next, and what uncertainty remains.
4. **Experience layer:** a polished SOC-style dashboard presents the analysis without exposing implementation complexity to the user.

The product is intentionally NOT framed as a universal IDS, automatic malware detector, or zero-day oracle. The central differentiator is **explainable network triage**.

The product's core user story is:

> Upload an authorized network capture → understand what traffic exists → see which flows deserve attention → inspect evidence → ask AI to explain the alert → decide what to investigate next.

The architecture deliberately isolates nDPI behind an adapter. This matters because nDPI is a mature library with its own build/API surface; the rest of our platform should consume a stable internal flow schema rather than couple every module to nDPI internals. The upstream nDPI project documents both a standalone `ndpiReader`-style usage path and a C API; the project also supports flow-risk export and multiple protocol/risk detection capabilities. The current stable release is nDPI 6.0 (August 2026). [Official nDPI GitHub](https://github.com/ntop/nDPI/) [nDPI 6.0 release notes](https://github.com/ntop/nDPI/releases)

---

# 1. Product Vision

## 1.1 Vision statement

Build a lightweight, visually impressive network-security assistant that helps a junior or intermediate analyst answer three questions quickly:

1. **What happened on the network?**
2. **Why does this flow look suspicious?**
3. **What should I investigate next?**

## 1.2 Product principles

### Principle A — Evidence before AI

The underlying signal must come from network telemetry and explicit detection logic. AI is not the only detector.

### Principle B — Human-readable security

Every important alert should be explainable in plain language.

### Principle C — Minimize data exposure

Do not send raw packet dumps to an external AI provider. Prefer normalized metadata, indicators, and evidence.

### Principle D — Demo reliability over feature count

A deterministic PCAP/demo mode is more important than a fragile live-capture showcase.

### Principle E — Claims must match implementation

We say “possible DNS tunneling indicators”, not “we detected DNS tunneling with 100% certainty”.

### Principle F — One golden path

The main judge demo should require only four major interactions:

**Dashboard → Analyze Traffic → Threat Detail → AI Investigation**

Everything else is supporting functionality.

---

# 2. Problem Definition

Network security tools can expose a large amount of low-level telemetry. A capture may contain thousands of packets and hundreds or thousands of flows. The volume itself is not the user's desired answer.

The user wants a prioritization layer.

For example, this raw data:

```text
Source: 192.168.1.20
Destination: 8.8.8.8
Protocol: UDP
Port: 53
Packets: 380
Duration: 60 seconds
Average DNS query length: 72
```

should become:

```text
HIGH RISK — Possible abnormal DNS behaviour

Evidence:
• High DNS request frequency
• Long query characteristics
• Repeated communication pattern

AI assessment:
This combination may be consistent with DNS tunneling or other abnormal DNS use.

Suggested next step:
Inspect the originating endpoint and correlate domain/process logs.
```

The product therefore optimizes for **triage latency**, not raw packet-processing capability.

---

# 3. Target Personas

## 3.1 SOC Analyst

Needs quick visibility, alert prioritization and evidence.

Primary actions:

- upload/analyze capture
- filter alerts
- inspect source/destination
- view evidence
- ask AI for contextual explanation
- export findings

## 3.2 Junior Security Analyst

Needs understandable language and guided investigation.

Primary actions:

- understand why an alert fired
- view recommended steps
- distinguish observed facts from hypotheses

## 3.3 Hackathon Judge

Needs to understand the product within 30–60 seconds.

Primary experience:

- impressive dashboard
- obvious pipeline
- one strong alert
- one clear AI explanation
- easy-to-explain architecture

---

# 4. Scope

## 4.1 Must-have MVP

- Dashboard
- PCAP/demo input flow
- nDPI integration boundary
- Flow normalization
- Rule-based detection engine
- Risk scoring
- Alert list
- Alert detail
- AI explanation
- Network flow table
- Basic reports screen
- Demo fixture mode
- Error/empty states
- Privacy messaging

## 4.2 Should-have

- Live traffic mode
- Alert timeline
- Filters
- Flow drill-down
- JSON report export
- PDF report export
- AI “ask about this alert” prompts

## 4.3 Could-have

- MITRE ATT&CK technique mapping
- Multi-provider AI selection
- Historical analysis comparison
- Baseline profiles
- Role-based auth
- Cloud deployment
- Streamed live alerts

## 4.4 Won't-have for hackathon MVP

- Packet blocking
- Automated containment
- Malware sandbox
- Full endpoint detection and response
- Autonomous security actions
- Claims of universal attack detection
- Custom LLM training
- Full commercial SIEM replacement

---

# 5. Functional Architecture

```text
                         ┌──────────────────────┐
                         │      USER / JUDGE     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      React UI        │
                         └──────────┬───────────┘
                                    │ REST/JSON
                                    ▼
                         ┌──────────────────────┐
                         │      FastAPI         │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐   ┌─────────────┐  ┌─────────────┐
              │  PCAP    │   │ Flow Store  │  │ AI Service  │
              │ Pipeline │   │ / Database  │  │             │
              └────┬─────┘   └─────────────┘  └──────┬──────┘
                   │                                  │
                   ▼                                  │
              ┌──────────┐                            │
              │   nDPI   │                            │
              └────┬─────┘                            │
                   ▼                                  │
              ┌──────────┐                            │
              │Normalizer│                            │
              └────┬─────┘                            │
                   ▼                                  │
              ┌──────────┐                            │
              │Detection │────────────────────────────┘
              │  Engine  │       structured evidence
              └────┬─────┘
                   ▼
              ┌──────────┐
              │   Risk   │
              │ Scoring  │
              └──────────┘
```

---

# 6. Navigation and Information Architecture

The left navigation has **six primary tabs plus Settings**.

```text
1. Dashboard
2. Traffic Analysis
3. Threats
4. Network Flows
5. AI Investigation
6. Reports
7. Settings
```

## 6.1 Navigation behavior

- Current page is highlighted.
- Clicking the product logo returns to Dashboard.
- Active analysis state displays a small progress indicator.
- Alerts count appears as a badge next to Threats when there are new/open alerts.
- AI Investigation can show a badge when an alert is selected.

## 6.2 Global header

Every primary page contains:

**Left:** page title + one-line context.

**Right:**

- System status badge
- Run Demo Analysis / Analyze action
- Optional Live Monitor toggle

## 6.3 Global footer

Small footer:

```text
NetSentinel AI · Authorized traffic analysis only · AI is advisory
```

---

# 7. Design Language

## 7.1 Visual direction

Use a modern dark SOC dashboard:

- near-black / blue-black background
- subtle borders
- glass/soft panel treatment only where useful
- high contrast typography
- restrained accent color
- red/orange/yellow reserved for severity
- green for healthy/online status

## 7.2 Severity semantics

| Severity | Meaning | UI treatment |
|---|---|---|
| LOW | Weak indicator / informational | muted green |
| MEDIUM | Worth reviewing | amber |
| HIGH | Strong combination of indicators | red/orange |
| CRITICAL | Multiple strong indicators | vivid red |

Never use color alone. Always show a text label.

## 7.3 Typography hierarchy

- Product: 18–20 px
- Page title: 28–32 px
- Section title: 15–18 px
- Metric: 28–34 px
- Labels: 11–13 px
- Table text: 13–14 px

---

# 8. SCREEN 0 — Optional Login

## Purpose

Only include if authentication helps the hackathon narrative.

## UI

```text
          ◈
     NetSentinel AI
 Network Threat Intelligence

 Email
 [_______________________]

 Password
 [_______________________]

 [ Sign In ]

 [ Continue in Demo Mode ]
```

## Buttons

### Sign In

- validates credentials if auth exists
- shows inline validation errors
- redirects to Dashboard on success

### Continue in Demo Mode

- skips auth
- loads safe local fixture mode
- places `DEMO` badge in header

## Recommendation

For hackathon MVP, **skip real authentication unless the challenge explicitly values identity/access control**. It adds surface area without improving the core demo.

---

# 9. SCREEN 1 — DASHBOARD

This is the default landing screen.

## 9.1 Header

Title:

**Network Security Overview**

Subtitle:

**DPI-assisted traffic analysis and AI-supported investigation.**

Actions:

- `[ Upload PCAP ]`
- `[ Run Demo Analysis ]`
- optional `[ Live Monitor ]`

## 9.2 System status

```text
● System Online
DPI Engine: Ready
AI: Connected / Demo
```

If AI provider is unavailable:

```text
● Analysis Online
AI Explanation: Unavailable
```

Do not mark the whole product offline just because AI failed.

## 9.3 KPI cards

Four large cards:

### Total Flows

Definition: all normalized flows analyzed in the current dataset/job.

### Suspicious Flows

Definition: flows with one or more detection findings.

### High Risk

Definition: alerts with HIGH or CRITICAL severity.

### Protocols

Definition: number of distinct application protocols observed.

Each card supports a secondary label such as:

```text
+18% vs previous run
```

only when real historical comparison exists. Otherwise omit fabricated deltas.

## 9.4 Protocol Distribution panel

Shows top application protocols as horizontal bars.

Example:

```text
HTTPS    ███████████████████    1240
DNS      ████████               530
HTTP     █████                  302
QUIC     ████                   219
SSH      ██                      91
```

### Interaction

Clicking a protocol bar:

- navigates to Network Flows
- pre-filters application protocol

## 9.5 Risk Distribution panel

Shows Low / Medium / High / Critical counts.

Clicking a severity:

- opens Threats
- pre-filters that severity

## 9.6 Recent Threats panel

Rows include:

- severity
- alert title
- source/flow reference
- risk score
- timestamp
- View button

### View button

Opens Threat Detail / AI Investigation depending on routing strategy.

Recommended:

**View → Threat Detail**

## 9.7 Empty Dashboard state

Before the first analysis:

```text
No traffic analysed yet.

Upload an authorized PCAP or run the demo analysis to populate this dashboard.

[ Analyse Demo ]
```

## 9.8 Dashboard button matrix

| Button | Action | Success |
|---|---|---|
| Upload PCAP | Navigate to Traffic Analysis | Upload screen |
| Run Demo | Call `/api/demo/load` | Dashboard refresh |
| Live Monitor | Open live mode | Live status page |
| Protocol | Apply protocol filter | Flows filtered |
| Severity | Apply severity filter | Threats filtered |
| View alert | Open detail | Alert detail |

---

# 10. SCREEN 2 — TRAFFIC ANALYSIS

## 10.1 Purpose

This is the entry point for a real PCAP workflow and the primary visualisation of the analysis pipeline.

## 10.2 Upload area

```text
┌──────────────────────────────────────────────┐
│              Upload PCAP                     │
│                                              │
│       Drag & drop your capture here          │
│                    or                        │
│             [ Browse Files ]                 │
│                                              │
│       .pcap / .pcapng supported              │
└──────────────────────────────────────────────┘
```

## 10.3 Browse Files button

Opens OS file picker.

Validation:

- extension `.pcap` or `.pcapng`
- file size <= configured limit
- filename length reasonable

Errors:

```text
Unsupported file type.
Please select a .pcap or .pcapng file.
```

or:

```text
File is larger than the configured 100 MB limit.
```

## 10.4 Selected file card

After selection:

```text
suspicious_dns.pcap
18.4 MB
Ready for analysis

[ Remove ] [ Analyse Traffic ]
```

### Remove button

Clears selection.

### Analyse Traffic button

Starts analysis.

Disabled when:

- no file
- invalid file
- analysis already running

## 10.5 Analysis pipeline animation

Display a stepper:

```text
✓ Capture loaded
✓ Packet ingestion
✓ Deep Packet Inspection
✓ Flow normalization
✓ Behaviour detection
● Risk aggregation
○ AI enrichment
○ Dashboard update
```

### Technical mapping

- Capture loaded → upload layer
- Packet ingestion → packet/PCAP layer
- Deep Packet Inspection → nDPI
- Flow normalization → internal schema
- Behaviour detection → rules
- Risk aggregation → scoring
- AI enrichment → AI API
- Dashboard update → FastAPI → frontend

## 10.6 Completion screen

```text
Analysis Complete ✓

2,481 flows analysed
214 suspicious flows
50 high-risk alerts

[ View Threats ]
[ Open Dashboard ]
```

## 10.7 Failure screen

If nDPI integration fails:

```text
Analysis could not be completed.

Cause: DPI engine unavailable.

[ Retry ] [ Use Demo Dataset ]
```

If AI fails:

```text
Network analysis completed.
AI enrichment could not be completed.

Your rule-based findings are still available.

[ View Findings ] [ Retry AI ]
```

---

# 11. SCREEN 3 — THREATS

## 11.1 Purpose

Central alert queue.

## 11.2 Header

```text
Threat Detection
214 alerts

[ All ] [ Critical ] [ High ] [ Medium ] [ Low ]
Search: __________________
```

## 11.3 Filters

### Severity dropdown

- All
- Low
- Medium
- High
- Critical

### Protocol dropdown

Data-driven list.

### Source IP field

Filters by exact/prefix match.

### Status dropdown

- Open
- Investigating
- Resolved
- Dismissed

### Search

Searches:

- alert title
- source IP
- destination IP
- flow ID
- protocol

## 11.4 Alert table

Columns:

```text
Severity
Threat
Source
Destination
Protocol
Risk Score
Time
Status
Action
```

## 11.5 Row actions

### View

Opens Threat Detail.

### Investigate

Opens AI Investigation with the alert preselected.

### Mark Investigating

Changes status from Open → Investigating.

### Dismiss

Requires confirmation modal.

```text
Dismiss this alert?
This only changes workflow status; it does not remove telemetry.

[ Cancel ] [ Dismiss Alert ]
```

## 11.6 Alert sort

Default:

1. severity descending
2. newest first

Other sort options:

- Risk score
- Newest
- Oldest
- Source

---

# 12. SCREEN 4 — THREAT DETAIL

A threat detail view may be implemented as a full page or right-side detail drawer.

Full page is better for the hackathon demo because the judge gets a clear narrative.

## 12.1 Header

```text
← Back to Threats

Possible DNS Tunneling

HIGH
Risk Score 91/100
```

Important wording rule:

If evidence only indicates a possibility, use:

**Possible DNS tunneling**

not:

**DNS tunneling confirmed**

## 12.2 Flow identity block

```text
Source
192.168.1.20:53001

Destination
8.8.8.8:53

Transport
UDP

Application
DNS

Duration
60 sec

Packets
380

Bytes
42 KB
```

## 12.3 Detection evidence

Section title:

**Why was this flagged?**

Example:

```text
✓ High DNS request frequency
✓ Unusually long query characteristics
✓ Repeated destination communication
```

Each evidence item should optionally have an info icon.

Info tooltip:

> This is an observed signal used by the rule engine. It is not proof of malicious activity by itself.

## 12.4 Risk composition

Show score breakdown when available:

```text
High DNS frequency       +25
Long DNS query           +20
Repeated destination     +15
nDPI risk indicator      +25
--------------------------------
Total                     85
```

Actual total depends on the rules fired.

## 12.5 Technical details collapsible panel

Collapsed by default.

Contains:

- flow ID
- timestamps
- ports
- transport
- application protocol
- nDPI indicators
- metadata

This prevents the normal user from being overwhelmed.

## 12.6 AI action block

Primary CTA:

**[ Analyse with AI ]**

Secondary:

**[ Open in AI Investigation ]**

---

# 13. SCREEN 5 — AI INVESTIGATION

This is the “wow” page.

## 13.1 Purpose

Turn the detection evidence into a concise analyst-oriented report.

## 13.2 Layout

Left column:

- selected alert
- traffic evidence
- risk score

Right column:

- AI summary
- threat category
- confidence
- recommendations
- caveats

## 13.3 AI header

```text
🤖 AI Security Analysis

Possible DNS Tunneling
HIGH
Confidence: 87%
```

Use “confidence” as **model output confidence/assessment**, not mathematical certainty.

## 13.4 Executive summary

Example:

> The observed flow shows multiple characteristics associated with abnormal DNS usage. The combination warrants further investigation, but does not independently prove compromise.

## 13.5 Evidence section

Repeat the observed evidence.

Why?

The user should always see the facts on which the AI response is based.

## 13.6 Recommended investigation

Example:

```text
1. Inspect the originating endpoint.
2. Review queried domains.
3. Correlate endpoint/process activity.
4. Check whether similar activity appears across other hosts.
```

Recommendations must remain **investigation-oriented**, not destructive.

## 13.7 Caveats

Example:

```text
AI is an analyst-assistance layer.
Behavioural indicators can have benign explanations.
Validate conclusions using authorized telemetry.
```

## 13.8 Ask AI box

```text
Ask about this alert...

[ ________________________________ ]
                         [ Ask AI ]
```

Preset prompt buttons:

- Why is this suspicious?
- What evidence supports this?
- What should I investigate first?
- What could explain this benignly?

## 13.9 Ask AI response constraints

The AI service should receive:

- current alert
- current flow
- detection evidence
- allowed context fields

It must NOT receive the full capture by default.

It should not invent:

- a process name
- a malware family
- a geographic actor
- a confirmed compromise
- a CVE

unless the evidence explicitly contains those facts.

---

# 14. SCREEN 6 — NETWORK FLOWS

## 14.1 Purpose

Technical analyst view.

## 14.2 Header

```text
Network Flows
2,481 flows

Search ___________________
```

## 14.3 Filters

- application protocol
- transport
- source
- destination
- risk
- port

## 14.4 Table

```text
Flow ID | Source | Destination | Protocol | Packets | Bytes | Duration | Risk
```

## 14.5 Flow row action

### View

Open flow detail.

### Investigate

Create/select alert if one exists.

If no alert exists, show:

```text
No detection alert exists for this flow.
AI investigation can still summarise observed telemetry.
```

Use this sparingly because it should not imply every flow is malicious.

## 14.6 Flow detail

```text
Flow F-001

Source: 192.168.1.20:53001
Destination: 8.8.8.8:53
Transport: UDP
Application: DNS
Packets: 380
Bytes: 42000
Duration: 60s

nDPI Risks
None

Detection Findings
High DNS frequency
Long DNS query characteristics
Repeated destination
```

---

# 15. SCREEN 7 — REPORTS

## 15.1 Purpose

Provide a compact summary suitable for judges and post-analysis handoff.

## 15.2 Report card

```text
Network Analysis Report

Capture: suspicious_dns.pcap
Flows: 2,481
Alerts: 214
High risk: 50
Generated: 09 Sep 2026 20:00

[ View Report ] [ Export JSON ] [ Export PDF ]
```

## 15.3 View Report

Report sections:

1. Executive Summary
2. Traffic Overview
3. Top Protocols
4. Alert Summary
5. Highest Risk Alerts
6. Evidence
7. AI Insights
8. Limitations / Caveats

## 15.4 Export JSON

Download sanitized report JSON.

## 15.5 Export PDF

Stretch feature.

Do not block the MVP on PDF generation.

---

# 16. SCREEN 8 — SETTINGS

## 16.1 AI provider

```text
AI Provider
[ Mock / Gemini / OpenAI-compatible ]
```

The provider selector changes the backend adapter only, not the rest of the application contract.

## 16.2 Detection thresholds

Example:

```text
DNS packets/sec threshold     [ 4.0 ]
Long DNS query threshold      [ 55 ]
High outbound multiplier      [ 5x ]
```

Changes should require a Save action.

## 16.3 Privacy

Display:

```text
Raw packet payloads are not sent to the AI provider by default.
Only selected normalized telemetry is eligible for AI enrichment.
```

## 16.4 Save Settings button

Validates values and updates the backend config.

## 16.5 Reset Defaults button

Confirmation:

```text
Restore default thresholds?
[ Cancel ] [ Restore ]
```

---

# 17. OPTIONAL SCREEN 9 — LIVE MONITOR

This is stretch scope.

## 17.1 Header

```text
Live Network Monitor

● Capturing
Interface: Ethernet

[ Pause ] [ Stop ]
```

## 17.2 Metrics

- flows/sec
- packets/sec
- suspicious flows
- active alerts

## 17.3 Live alerts

Newest first.

Each row:

- timestamp
- severity
- title
- source
- destination

## 17.4 Stop button

Stops capture and returns to a completed snapshot view.

---

# 18. REQUIRED BUTTON / INTERACTION CATALOG

## Global buttons

### Logo

Action: Dashboard.

### Run Demo Analysis

Action: POST `/api/demo/load`.

Success: load deterministic fixture and refresh dashboard.

Failure: show toast and remain on current page.

### Upload PCAP

Action: navigate to Traffic Analysis.

### Live Monitor

Action: open live capture screen.

---

## Traffic Analysis buttons

### Browse Files

Action: native file picker.

### Remove File

Action: clear selected file.

### Analyse Traffic

Action: start analysis job.

### Cancel Analysis

Optional. If implemented, cancel server-side job or at minimum disable UI and discard pending result.

### Use Demo Dataset

Fallback when nDPI is not ready or user wants a known working path.

---

## Threat buttons

### View

Open alert detail.

### Investigate

Open AI Investigation with alert selected.

### Dismiss

Change workflow status after confirmation.

### Mark Investigating

Change status.

### Resolve

Only when the team adds workflow semantics. This is a status change, not proof that the traffic was benign.

---

## AI buttons

### Analyse with AI

POST `/api/alerts/{alert_id}/explain`.

### Retry AI

Repeats AI call after failure.

### Ask AI

Sends a bounded question plus alert context.

### Copy Summary

Copies generated summary to clipboard.

### Open Flow

Navigate to Network Flows with flow selected.

---

## Report buttons

### View Report

Open report detail.

### Export JSON

Generate/download JSON.

### Export PDF

Generate/download PDF if implemented.

---

# 19. CORE DATA MODEL

## 19.1 Flow

```json
{
  "flow_id": "F-001",
  "timestamp": "2026-09-09T14:00:00Z",
  "source_ip": "192.168.1.20",
  "destination_ip": "8.8.8.8",
  "source_port": 53001,
  "destination_port": 53,
  "transport": "UDP",
  "application": "DNS",
  "packets": 380,
  "bytes": 42000,
  "duration_seconds": 60,
  "ndpi_risks": [],
  "metadata": {
    "avg_query_length": 72,
    "repeated_destination": true,
    "high_outbound_ratio": false
  }
}
```

## 19.2 Detection alert

```json
{
  "alert_id": "A-F-001",
  "flow_id": "F-001",
  "rule_ids": [
    "DNS_HIGH_FREQUENCY",
    "DNS_LONG_QUERY",
    "REPEATED_DESTINATION"
  ],
  "title": "Possible abnormal DNS behaviour",
  "severity": "HIGH",
  "risk_score": 75,
  "evidence": [
    "Observed 6.3 packets/sec on a DNS flow.",
    "Average observed DNS query length is above the configured threshold.",
    "The source repeatedly contacted the same external destination."
  ],
  "created_at": "2026-09-09T14:10:00Z",
  "status": "open"
}
```

## 19.3 AI analysis

```json
{
  "threat_category": "Possible abnormal DNS behaviour",
  "severity": "HIGH",
  "confidence": 0.87,
  "summary": "The observed flow contains multiple indicators associated with abnormal DNS usage and warrants investigation.",
  "observed_evidence": [
    "High DNS request frequency",
    "Long DNS query characteristics",
    "Repeated destination communication"
  ],
  "recommendations": [
    "Inspect the originating endpoint.",
    "Review the queried domains.",
    "Correlate with endpoint/process logs."
  ],
  "caveats": [
    "These indicators can have benign explanations.",
    "AI is not the sole detection authority."
  ]
}
```

---

# 20. DETECTION ENGINE SPECIFICATION

The detection engine is deliberately rule-based for explainability and Q&A safety.

## 20.1 Rule: DNS_HIGH_FREQUENCY

### Purpose

Flag unusually frequent DNS traffic.

### Example condition

```text
packets / duration > threshold
```

### Default MVP threshold

4 packets/sec.

### Weight

25.

### Evidence string

```text
Observed X packets/sec on a DNS flow.
```

### Caveat

High DNS volume can have benign causes such as software updaters, service discovery, or noisy applications.

---

# 21. DETECTION RULE: DNS_LONG_QUERY

### Purpose

Identify unusually long DNS query characteristics.

### Default threshold

Average observed query length >= 55 characters.

### Weight

20.

### Evidence

```text
Average observed DNS query length is above the configured threshold.
```

### Interpretation

This is an indicator, not proof of DNS tunneling.

---

# 22. DETECTION RULE: UNUSUAL_LEGACY_PORT

### Purpose

Flag selected legacy remote-access ports.

### MVP examples

- 23
- 2323

### Weight

15.

### Important wording

Do not call the traffic malicious merely because the port was observed.

Use:

**Legacy remote-access port observed**

not:

**Telnet attack detected**

unless the evidence actually supports an attack pattern.

---

# 23. DETECTION RULE: REPEATED_DESTINATION

### Purpose

Flag repeated outbound connections to a single destination.

### Weight

15.

### Evidence

```text
The source repeatedly contacted the same external destination.
```

### Use

As a correlation indicator. Avoid using it as a sole high-confidence malicious signal.

---

# 24. DETECTION RULE: HIGH_OUTBOUND_VOLUME

### Purpose

Highlight abnormal outbound volume relative to a baseline.

### Weight

15.

### Requirement

Only activate if baseline metadata is available.

For fixture mode, baseline flag can be embedded in test data.

---

# 25. DETECTION RULE: NDPI_RISK

### Purpose

Forward nDPI-supported risk indicators into our risk aggregator.

### Weight

25 for MVP.

### Important

Do not blindly add every nDPI signal to the same score without documentation. Store the exact risk indicator name so the analyst can inspect it.

nDPI's upstream project documents flow-risk features and the ability to enable/disable risk export/configuration; use those capabilities through the adapter rather than duplicating protocol-detection logic in our app. [nDPI release notes](https://github.com/ntop/nDPI/releases)

---

# 26. RISK SCORING

## 26.1 Formula

Simplest defensible MVP:

```text
Risk Score = sum(triggered rule weights), capped at 100
```

## 26.2 Severity mapping

```text
0–34       LOW
35–64      MEDIUM
65–84      HIGH
85–100     CRITICAL
```

The exact cutoffs can be configured but should remain documented.

## 26.3 Risk composition UI

Always show the individual contributions for important alerts.

This makes the score explainable.

---

# 27. nDPI INTEGRATION DESIGN

The product should use nDPI as a dedicated module rather than spreading nDPI-specific logic across the repository.

Official nDPI documentation describes it as an open-source deep packet inspection library and notes that it can be embedded into an application. The repository also provides example reader utilities and build instructions. [Official repository](https://github.com/ntop/nDPI/) [reader utility](https://github.com/ntop/nDPI/blob/dev/example/reader_util.h)

## 27.1 Integration boundary

File:

```text
/dpi/ndpi_adapter.py
```

Public method:

```python
analyze_pcap(pcap_path) -> list[Flow]
```

## 27.2 Rule

Everything outside `/dpi` consumes our normalized schema.

Do NOT import nDPI-specific types into React, API schemas, or detection rules.

## 27.3 Integration options

### Option A — nDPI reader subprocess

Use the locally compiled nDPI reader tooling and parse its structured output.

Pros:

- fastest hackathon path
- low FFI complexity

Cons:

- output parser needs stable handling

### Option B — C/C++ wrapper

Create a small adapter around nDPI C APIs and expose structured output to Python.

Pros:

- tighter integration

Cons:

- more build complexity

### Recommendation

**Option A for hackathon.** Keep Option B as future architecture.

The nDPI repository explicitly documents library embedding and also provides reader utilities, so the adapter approach is consistent with upstream usage patterns. [nDPI GitHub](https://github.com/ntop/nDPI/)

---

# 28. PCAP DATA STRATEGY

A PCAP is test input, not an nDPI output.

The project should maintain:

```text
samples/
├── normal.pcap
├── suspicious_dns.pcap
├── repeated_connections.pcap
└── high_outbound.pcap
```

During early development, equivalent JSON fixtures may be used so all four developers can work without waiting for the nDPI runtime integration.

## 28.1 Why fixture mode exists

Without fixture mode:

- frontend waits for nDPI
- backend waits for PCAP
- AI developer waits for backend
- integration becomes serial

With fixture mode:

```text
M1 → can build real DPI
M2 → can use flow fixtures
M3 → can use alert fixtures
M4 → can use API/mock data
```

## 28.2 Demo dataset policy

The demo dataset must contain enough variety to show:

- normal HTTPS
- normal DNS
- suspicious DNS-like behaviour
- an unusual legacy port
- high outbound traffic + a risk indicator

Avoid claiming that fixture data represents a real-world confirmed intrusion.

---

# 29. API CONTRACT

Base URL:

```text
http://localhost:8000
```

## GET `/api/health`

Response:

```json
{"status":"ok","service":"netsentinel-api"}
```

## GET `/api/dashboard`

Returns the dashboard summary.

## GET `/api/flows`

Returns normalized flows.

## GET `/api/alerts`

Returns alerts.

## GET `/api/alerts/{alert_id}`

Returns:

```json
{
  "alert": {},
  "flow": {}
}
```

## POST `/api/alerts/{alert_id}/explain`

Generates AI analysis and returns the stable `AIAnalysis` schema.

## POST `/api/demo/load`

Loads deterministic demo fixture data.

## POST `/api/analyze/pcap`

Target production endpoint:

```text
multipart/form-data
file=<capture>
```

Current starter intentionally returns a clear “runtime integration pending” response until the local nDPI execution method is configured.

This avoids pretending that a fake parser is the real DPI engine.

---

# 30. ERROR STATES

Every user-facing action needs a graceful failure mode.

## API offline

```text
Backend unavailable.
Please check that the analysis service is running.
```

## AI offline

```text
AI explanation unavailable.
Underlying network findings are still available.
```

## Invalid PCAP

```text
This file could not be processed as a supported network capture.
```

## Empty capture

```text
Capture contains no analyzable flows.
```

## No threats

```text
No suspicious behaviour was flagged in this capture.

This does not guarantee the absence of threats; it means the configured rules did not generate alerts.
```

This last sentence is excellent from a security-product perspective and protects against overclaiming.

---

# 31. LOADING STATES

Use skeletons/spinners only where they communicate an actual pending operation.

## Dashboard loading

Show KPI skeleton cards.

## PCAP analysis

Use the pipeline stepper.

## AI generation

Show:

```text
Analysing selected evidence…
```

Do not show a fake percentage unless the backend provides real progress.

---

# 32. DATABASE / PERSISTENCE

MVP may use SQLite.

Recommended production-compatible schema:

## `analysis_jobs`

- job_id
- filename
- created_at
- status
- total_flows
- alert_count

## `flows`

- flow_id
- job_id
- timestamp
- source_ip
- destination_ip
- source_port
- destination_port
- transport
- application
- packets
- bytes
- duration_seconds
- metadata_json

## `alerts`

- alert_id
- flow_id
- severity
- risk_score
- title
- rules_json
- evidence_json
- status
- created_at

## `ai_analysis`

- id
- alert_id
- provider
- model
- confidence
- threat_category
- summary
- recommendations_json
- caveats_json
- created_at

---

# 33. FRONTEND COMPONENT TREE

Recommended structure:

```text
src/
├── main.jsx
├── App.jsx
├── styles.css
├── components/
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── MetricCard.jsx
│   ├── Panel.jsx
│   ├── ThreatTable.jsx
│   ├── SeverityBadge.jsx
│   ├── ProtocolChart.jsx
│   ├── RiskChart.jsx
│   ├── PipelineStepper.jsx
│   ├── EmptyState.jsx
│   └── Toast.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── TrafficAnalysis.jsx
│   ├── Threats.jsx
│   ├── ThreatDetail.jsx
│   ├── NetworkFlows.jsx
│   ├── AIInvestigation.jsx
│   ├── Reports.jsx
│   └── Settings.jsx
├── services/
│   ├── api.js
│   └── ai.js
└── types/
    └── schemas.js
```

The starter repository includes a compact single-file frontend for speed, but this component split is the target architecture once the team begins polishing.

---

# 34. BACKEND COMPONENT TREE

Target:

```text
backend/app/
├── main.py
├── api/
│   ├── dashboard.py
│   ├── analysis.py
│   ├── alerts.py
│   ├── flows.py
│   └── ai.py
├── core/
│   ├── config.py
│   └── security.py
├── models/
│   ├── flow.py
│   ├── alert.py
│   └── analysis_job.py
├── schemas/
│   ├── flow.py
│   ├── alert.py
│   └── ai.py
└── services/
    ├── analysis.py
    ├── ai_service.py
    ├── report_service.py
    └── store.py
```

---

# 35. TEAM OWNERSHIP — 4 PEOPLE

## MEMBER 1 — DPI / NETWORK ENGINEER

Owns:

- `/dpi`
- nDPI build
- PCAP reader
- flow normalization
- sample captures

Deliverables:

1. nDPI compiled and documented
2. one known PCAP processed
3. normalized JSON output
4. nDPI risk fields captured where available
5. integration notes

Must answer in Q&A:

> Why nDPI instead of writing DPI yourself?

Suggested answer:

> We use an established DPI engine so that our engineering effort can focus on explainable detection, triage, and AI-assisted investigation rather than rebuilding a mature protocol-classification layer.

---

# 36. MEMBER 2 — SECURITY / DETECTION ENGINEER

Owns:

- `/detection`
- rule configuration
- risk scoring
- evidence generation
- threshold documentation

Deliverables:

1. five reliable rules
2. risk scoring
3. severity mapping
4. false-positive test cases
5. evidence schema

Must answer:

> Is every alert a confirmed attack?

Correct answer:

> No. The rules identify indicators that warrant investigation. We explicitly separate observed evidence from hypotheses.

---

# 37. MEMBER 3 — BACKEND / AI ENGINEER

Owns:

- `/backend`
- `/ai`
- REST APIs
- database
- AI provider adapter
- prompt/schema

Deliverables:

1. FastAPI service
2. stable API contracts
3. alert-to-AI flow
4. mock AI fallback
5. provider failure handling

Must answer:

> What does AI actually contribute?

Correct answer:

> The DPI and rules generate structured evidence. AI turns those findings into contextual, human-readable explanations, confidence wording, and suggested investigation steps.

---

# 38. MEMBER 4 — FRONTEND / UX / DEMO ENGINEER

Owns:

- `/frontend`
- UI/UX
- charts
- interaction states
- demo narrative
- presentation screenshots/video

Deliverables:

1. polished dark SOC UI
2. complete golden-path flow
3. responsive layout
4. alert detail page
5. AI Investigation page
6. demo mode fallback

Must answer:

> What does a security analyst actually do with this?

Correct answer:

> They can go from a capture to prioritized flows, inspect the evidence behind an alert, and use AI to understand what to investigate next.

---

# 39. PARALLEL DEVELOPMENT PLAN

## Track A — M1

Build against real or representative PCAPs.

## Track B — M2

Use `samples/demo_flows.json` initially.

## Track C — M3

Use fixture alert JSON initially.

## Track D — M4

Use mock API payloads initially.

Then integrate in order:

```text
M1 → M2 → M3 → M4
```

But do not wait for each track to finish before starting the next.

---

# 40. IMPLEMENTATION MILESTONES

## Milestone 1 — Skeleton

Done when:

- backend runs
- frontend runs
- demo fixture loads

## Milestone 2 — Detection

Done when:

- at least 5 rules produce deterministic findings

## Milestone 3 — DPI

Done when:

- nDPI produces flow/protocol data through the adapter

## Milestone 4 — AI

Done when:

- selected alert can generate stable AI response

## Milestone 5 — UI

Done when:

- all primary pages work

## Milestone 6 — Demo Hardening

Done when:

- demo works from a clean machine or documented environment
- AI failure does not break the dashboard
- demo mode exists
- no secret is committed to Git

---

# 41. DEMO MODE SPEC

The demo must work even if the real nDPI environment is temporarily broken.

## Demo button

`Run Demo Analysis`

Action:

```text
POST /api/demo/load
```

It loads known flow fixtures, runs the actual detection engine, stores alerts, and populates the dashboard.

This is better than hardcoding the final dashboard output because the demo still demonstrates the **real rule engine**.

The only mocked component in the initial starter is the nDPI ingestion layer itself until the local runtime is wired.

---

# 42. GOLDEN PATH — THE EXACT JUDGE DEMO

## Step 1

Open Dashboard.

Narration:

> “NetSentinel converts network telemetry into analyst-readable security findings.”

## Step 2

Click `Run Demo Analysis`.

## Step 3

Show analysis stepper:

```text
Packet ingestion
→ nDPI
→ Flow normalization
→ Detection
→ Risk scoring
→ AI
```

## Step 4

Threat count updates.

Point to:

**Possible abnormal DNS behaviour — HIGH**

## Step 5

Open alert.

Show evidence.

## Step 6

Click `Analyse with AI`.

## Step 7

Show:

- threat category
- confidence
- evidence
- explanation
- recommended investigation

## Step 8

One architecture line:

> “We intentionally do not ask an LLM to blindly inspect raw packets. We perform network inspection locally and send minimized structured evidence to the AI layer.”

## Step 9

One limitation line:

> “The system is an analyst-assistance layer; an alert is an investigation lead, not an automatic verdict.”

This sequence is short enough to present and deep enough to demonstrate real engineering.

---

# 43. VISUAL “WOW” FEATURES

These are approved features because they improve perception without creating dangerous technical complexity.

## A. Analysis Pipeline

Animated step-by-step progress.

## B. Risk Score Ring

Large 91/100 display.

## C. Flow-to-Alert Relationship

Show:

```text
Flow F-001
       ↓
3 detection rules
       ↓
Risk 91
       ↓
AI analysis
```

## D. Evidence Chips

```text
HIGH DNS FREQUENCY
LONG QUERY
REPEATED DESTINATION
```

## E. AI confidence badge

Example:

```text
87% assessment confidence
```

## F. Threat timeline

Optional timeline of events for an alert.

## G. “Explain this” interaction

Judges immediately understand the role of AI.

---

# 44. FEATURES THAT LOOK COOL BUT SHOULD NOT BE OVERBUILT

## MITRE ATT&CK mapping

A small mapping for a couple of relevant cases is enough.

Do not build a full ATT&CK database.

## Live monitoring

A simple stream is sufficient; do not implement a distributed packet-ingestion cluster.

## PDF report

A single professional report is enough.

## Chatbot

Use bounded prompt presets rather than a generic “cybersecurity ChatGPT”.

---

# 45. AI PROMPT SPECIFICATION

## System prompt

```text
You are a network security analyst assistant.

You will receive structured network telemetry and detection evidence.

Your job is to:
1. summarize what was observed,
2. identify a plausible threat category only when supported by the evidence,
3. explain why the traffic was flagged,
4. recommend safe investigation steps,
5. clearly distinguish observation from inference.

Do not invent facts.
Do not claim compromise with certainty from behavioural indicators alone.
Do not invent malware names, actors, processes, domains, or vulnerabilities.
If the evidence is insufficient, say so.
Return valid JSON according to the supplied schema.
```

## AI request object

```json
{
  "alert": {
    "title": "Possible abnormal DNS behaviour",
    "severity": "HIGH",
    "risk_score": 75,
    "evidence": [
      "High DNS request frequency",
      "Long query characteristics"
    ]
  },
  "flow": {
    "application": "DNS",
    "transport": "UDP",
    "packets": 380,
    "duration_seconds": 60
  }
}
```

## AI response schema

The frontend should never depend on provider-specific raw text. Normalize provider output into:

```text
threat_category
severity
confidence
summary
observed_evidence[]
recommendations[]
caveats[]
```

---

# 46. PRIVACY AND DATA MINIMIZATION

## Never send by default

- raw packet bodies
- passwords
- cookies
- bearer tokens
- authorization headers
- personal identifiers not needed for analysis

## Send only what is needed

- protocol
- flow statistics
- selected metadata
- rule findings
- nDPI risk names

## UI disclosure

On AI Investigation page:

> “Only normalized telemetry selected by the analysis pipeline is sent for AI enrichment. Raw packet payloads are not sent by default.”

---

# 47. SECURITY REQUIREMENTS FOR THE APP ITSELF

## Secrets

Use `.env`.

Never commit:

```text
AI_API_KEY=...
```

## Uploads

- restrict extension
- enforce size limit
- store outside public web root
- sanitize filenames
- avoid rendering uploaded content directly

## CORS

For local demo, allow frontend origin only.

Do not leave `*` in a deployed configuration.

## Logging

Do not log AI API keys or raw sensitive content.

---

# 48. ACCEPTANCE CRITERIA — DASHBOARD

Given that no analysis has run:

- Dashboard displays zero-state.
- Demo button is visible.
- No fake historical numbers appear.

Given that demo analysis succeeds:

- KPI cards update.
- protocols populate.
- risk distribution populates.
- threat list populates.

Given that there are no alerts:

- dashboard explicitly states no findings.
- no empty blank section appears.

---

# 49. ACCEPTANCE CRITERIA — THREATS

Given alerts exist:

- table loads.
- severity filters work.
- search works.
- clicking an alert opens detail.
- risk score is visible.

Given an alert is dismissed:

- status changes.
- alert remains in data/history.

---

# 50. ACCEPTANCE CRITERIA — AI

Given a valid alert:

- AI button is enabled.
- response matches schema.
- loading state appears.
- failure state is graceful.
- caveats remain visible.

Given AI provider is unavailable:

- rule-based alert remains visible.
- user can retry later.

---

# 51. ACCEPTANCE CRITERIA — PCAP

Given a valid capture:

- upload is accepted.
- analysis begins.
- progress states render.
- result or error is shown.

Given invalid extension:

- user gets validation error.

Given oversized file:

- user gets size error.

---

# 52. TEST CASES

## TC-01 Normal HTTPS

Expected:

- flow detected
- low/no alert

## TC-02 Normal DNS

Expected:

- DNS classified
- below frequency threshold
- no high-risk alert

## TC-03 DNS anomaly

Expected:

- DNS rule triggers
- evidence visible
- high/medium score depending on combined indicators

## TC-04 Legacy port

Expected:

- legacy-port indicator
- medium or low depending on other signals

## TC-05 High outbound traffic

Expected:

- outbound-volume finding

## TC-06 nDPI risk

Expected:

- nDPI risk passed to rule engine
- risk composition includes it

## TC-07 AI down

Expected:

- threat page still works
- AI error shown separately

## TC-08 Backend down

Expected:

- frontend shows service unavailable message

---

# 53. PERFORMANCE TARGETS

Hackathon target, not enterprise SLA:

- frontend first view: <3s locally
- demo analysis: <10s on a small fixture
- AI explanation: typically <10s depending on provider/network
- table rendering: 2,500 flows without visible lag

For large captures, use pagination rather than rendering every row simultaneously.

---

# 54. RESPONSIVENESS

Desktop-first because judges usually view on laptops.

Minimum useful breakpoints:

- 1440 px
- 1200 px
- 900 px
- 650 px

At <900 px:

- charts stack
- sidebar narrows

At <650 px:

- sidebar collapses
- tables become horizontally scrollable
- KPI grid stacks

---

# 55. EMPTY STATES

Every page needs a meaningful empty state.

## Threats

“No alerts have been generated yet.”

## Flows

“No traffic has been analyzed.”

## AI Investigation

“Select an alert from Threats to begin an investigation.”

## Reports

“Run an analysis to create a report.”

Never show a blank page.

---

# 56. TOASTS / NOTIFICATIONS

Use short, non-blocking toasts.

Examples:

```text
✓ Demo analysis complete
✓ Alert status updated
✓ AI analysis generated
⚠ AI provider unavailable
✕ Upload failed
```

Do not use modal popups for normal success messages.

---

# 57. ACCESSIBILITY BASICS

- buttons must have labels
- keyboard navigation should work
- severity must include text
- charts should have text summaries
- table headers must be explicit
- focus states should be visible

---

# 58. GITHUB / REPOSITORY PRACTICES

Recommended branches:

```text
main
├── feature/dpi
├── feature/detection
├── feature/backend-ai
└── feature/frontend
```

Pull request naming:

```text
feat: add DNS frequency rule
feat: add threat detail page
feat: add nDPI adapter
feat: add AI explanation endpoint
```

Avoid huge commits called:

```text
final-final
latest
hackathon
changes
```

---

# 59. COMMIT OWNERSHIP

## M1

```text
feat(dpi): add ndpi adapter
feat(dpi): normalize flow schema
```

## M2

```text
feat(detection): add dns frequency rule
feat(detection): add risk scoring
```

## M3

```text
feat(api): add alert endpoints
feat(ai): add analysis provider
```

## M4

```text
feat(ui): add dashboard
feat(ui): add threat detail
```

---

# 60. DEFINITION OF DONE FOR THE WHOLE PRODUCT

The product is considered hackathon-ready when:

1. A user can launch the application.
2. The Dashboard clearly explains what the product is.
3. The Demo Analysis button populates real frontend data through backend logic.
4. nDPI can be plugged into the adapter with the documented procedure.
5. Rules create explainable evidence.
6. Alerts receive risk scores.
7. A judge can click a threat and understand why it was flagged.
8. AI can explain the finding.
9. AI failure does not break detection.
10. No secrets are committed.
11. The team can explain every major component.
12. No feature is presented as more capable than it actually is.

---

# 61. JUDGE Q&A PACK

## Q1. Why use nDPI?

> It provides a mature DPI/protocol classification layer, letting us focus our engineering effort on explainable detection and AI-assisted triage.

## Q2. What did you build yourselves?

> The application layer around DPI: flow normalization, behavioural rules, risk scoring, evidence presentation, AI orchestration, and the analyst dashboard.

## Q3. Does AI detect attacks?

> Not by itself. Detection starts with network telemetry and deterministic indicators. AI explains, contextualizes and prioritizes those findings.

## Q4. Why not send the PCAP directly to an LLM?

> Privacy, cost, prompt size, and reliability. We minimize the data and send structured evidence instead of raw packets.

## Q5. Can DNS tunneling really be detected this way?

> We detect indicators consistent with abnormal DNS behaviour. We do not claim that a small set of behavioural heuristics proves tunneling on its own.

## Q6. What happens if the AI hallucinates?

> The underlying detection evidence remains independent of the AI. The UI explicitly presents observations separately from AI inference.

## Q7. Why no custom ML model?

> The hackathon value is the integrated workflow and explainability. A custom model would add complexity without improving the core demo enough to justify the engineering and evaluation burden.

## Q8. Can this replace an IDS?

> No. It's a traffic-intelligence and analyst-assistance layer that can complement existing security controls.

## Q9. What is novel?

> We combine DPI telemetry with transparent behavioural evidence and an AI explanation layer designed around analyst triage rather than generic chatbot output.

## Q10. How do you handle false positives?

> Every alert exposes the underlying indicators, risk composition and caveats. Analysts can inspect the flow and treat the alert as an investigation lead rather than an automatic verdict.

---

# 62. FINAL PRODUCT POSITIONING

Use this exact one-liner in the pitch:

> **NetSentinel AI turns network traffic into explainable security intelligence using DPI, transparent behavioural detection, and AI-assisted investigation.**

Use this exact differentiation line:

> **We don't ask an LLM to blindly inspect packets; we locally extract security-relevant telemetry, detect indicators transparently, and use AI to explain what the analyst should investigate next.**

Use this exact limitation line:

> **The product is designed for triage and investigation assistance, not as a universal or autonomous attack detector.**

---

# 63. FINAL SCREEN MAP

```text
NetSentinel AI
│
├── Dashboard
│   ├── KPI cards
│   ├── Protocol distribution
│   ├── Risk distribution
│   ├── Recent threats
│   └── Demo / Upload / Live actions
│
├── Traffic Analysis
│   ├── Upload area
│   ├── Selected file
│   ├── Analysis pipeline
│   ├── Result summary
│   └── Failure states
│
├── Threats
│   ├── Filters
│   ├── Search
│   ├── Alert table
│   └── Threat Detail
│
├── Network Flows
│   ├── Search
│   ├── Filters
│   ├── Flow table
│   └── Flow Detail
│
├── AI Investigation
│   ├── Selected alert
│   ├── Risk/evidence
│   ├── AI summary
│   ├── Recommendations
│   ├── Caveats
│   └── Ask AI
│
├── Reports
│   ├── Report list
│   ├── View report
│   ├── Export JSON
│   └── Export PDF (stretch)
│
└── Settings
    ├── AI provider
    ├── Thresholds
    ├── Privacy
    └── Save / Reset
```

---

# 64. IMPLEMENTATION CHECKLIST

## Architecture

- [ ] nDPI adapter exists
- [ ] internal Flow schema frozen
- [ ] detection schema frozen
- [ ] AI response schema frozen

## DPI

- [ ] nDPI built
- [ ] PCAP reader works
- [ ] protocol extraction works
- [ ] flow extraction works
- [ ] risk extraction works where available

## Detection

- [ ] DNS frequency
- [ ] long DNS query
- [ ] legacy port
- [ ] repeated destination
- [ ] high outbound volume
- [ ] nDPI risk bridge
- [ ] scoring

## Backend

- [ ] health endpoint
- [ ] dashboard endpoint
- [ ] flows endpoint
- [ ] alerts endpoint
- [ ] alert detail endpoint
- [ ] AI endpoint
- [ ] demo endpoint

## Frontend

- [ ] dashboard
- [ ] traffic analysis
- [ ] threats
- [ ] flow table
- [ ] AI investigation
- [ ] reports
- [ ] settings
- [ ] error states
- [ ] empty states

## Demo

- [ ] deterministic fixture
- [ ] clean startup
- [ ] backup demo flow
- [ ] no secrets in repo
- [ ] screenshots
- [ ] final pitch

---

# 65. CODEBASE MAP INCLUDED WITH THIS PRD

The starter repository accompanying this document contains:

```text
netsentinel_ai/
├── README.md
├── PRD.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── core/config.py
│       ├── schemas/api.py
│       └── services/
│           ├── analysis.py
│           ├── ai_service.py
│           └── store.py
├── detection/
│   ├── scoring.py
│   └── rules/basic.py
├── dpi/
│   └── ndpi_adapter.py
├── ai/
├── samples/
│   └── demo_flows.json
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/main.jsx
└── scripts/
```

The starter code intentionally uses a **mock AI response and fixture-based DPI adapter** so the team can run the interface and detection path immediately. Replace only the adapter/provider internals as the real nDPI and chosen AI provider are integrated.

---

# 66. IMPORTANT LEGAL / ETHICAL BOUNDARY

Only capture or inspect traffic for which the team has authorization.

nDPI's own project documentation carries a reminder to respect privacy and authorization when listening to/capturing/inspecting network traffic. [nDPI GitHub](https://github.com/ntop/nDPI/)

The hackathon demo should therefore use:

- synthetic lab traffic,
- public datasets permitted for analysis,
- or traffic captured on systems the team controls/has permission to monitor.

---

# 67. FINAL BUILD PRIORITY

When time becomes short, do the following in this exact order:

```text
1. Demo fixture + dashboard
2. Detection rules
3. Threat detail
4. AI explanation
5. nDPI runtime integration
6. Flow table
7. polished interactions
8. report export
9. live monitoring
10. extra integrations
```

Never sacrifice the complete golden path to add another feature.

---

# 68. THE SIMPLEST WAY TO THINK ABOUT THE ENTIRE SYSTEM

```text
             WHAT IS HAPPENING?
                     │
                     ▼
                    nDPI
                     │
                     ▼
              WHAT LOOKS ODD?
                     │
                     ▼
               Rule Engine
                     │
                     ▼
              HOW SERIOUS IS IT?
                     │
                     ▼
                Risk Score
                     │
                     ▼
              WHY DOES IT MATTER?
                     │
                     ▼
                     AI
                     │
                     ▼
            WHAT DO I CHECK NEXT?
                     │
                     ▼
                 Dashboard
```

That is the whole product.

Do not let the codebase become larger than the problem you are solving.

