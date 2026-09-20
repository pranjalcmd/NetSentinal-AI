# NetSentinel AI

AI-assisted network traffic intelligence. Takes a packet capture, identifies
the application behind every flow with deep packet inspection, scores each flow
with a transparent rule engine **and** a DPI-aware ML classifier, and serves the
result to a SOC-style React frontend.

## What it does

1. Accepts a `.pcap` capture (or the bundled synthetic traffic).
2. Extracts flows through `dpi/ndpi_adapter.py` — real nDPI when available,
   otherwise a pure-Python reader plus `dpi/l7.py`, the ported Packet_analyzer
   inspection engine (TLS SNI / HTTP Host / DNS query names).
3. Normalizes protocol and flow metadata into one internal Flow schema.
4. Scores each flow twice: explicit rules (`detection/`) and an ML classifier
   (`ml/detection_engine.py`), then fuses the two into one alert.
5. Projects the flow table onto an entity graph for the network explorer and
   the pathfinder.
6. Explains alerts in plain language — mock text by default, Gemini (or any
   configured provider) when you supply a key.

## MVP boundary

An analyst-assistance and traffic-intelligence product, not a replacement for a
commercial IDS/IPS. Detection is DPI indicators plus explicit rules plus
a supervised classifier; the AI layer explains and prioritizes evidence rather
than being the detector.

---

## Where to put the API key

**`netsentinel/.env`** — copy `.env.example` and fill in one line:

```
AI_API_KEY=sk-ant-...
```

That is the only change needed. Nothing else reads the key, and nothing else
has to be edited.

`AI_API_KEY` also accepts a **comma-separated pool**:

```
AI_API_KEY=key-one,key-two,key-three
```

The Gemini free tier caps requests per key per day, which a single demo run
exceeds. On a `429` the service moves to the next key; on a transient `5xx` it
retries the same one after a short pause. Only when the pool is exhausted does
it fall back to the mock analyst, and `/api/health` reports the last provider
error verbatim (with every key redacted) so a spent key never looks like
"no key set".

- Empty or missing → `/api/alerts/{id}/explain`, `/api/ai/ask` and
  `/api/ai/report` return the mock analyst text. Everything else works
  identically.
- Set → the same endpoints call a real model, with structured JSON output.
  Verdict, severity, confidence and evidence still come from the detection
  engines; the model only writes the narrative.
- Which provider: `AI_MODEL=gemini-3.6-flash` (default) uses Google's native
  `generateContent`; `claude-*` uses the Anthropic Messages API; anything else
  uses the OpenAI-compatible shape. `AI_PROVIDER` overrides the inference.
  Model names are not interchangeable between them — `gemini-2.5-flash` and
  older are retired for new keys and will 400/404.
- Confirm which one is live: `GET /api/health` → `"ai_provider"`.
- A live call that fails degrades to the mock instead of 500-ing the UI, and
  `GET /api/health` reports why in `"ai_last_error"` (status, host, and the
  provider's own message, with the key redacted). Without it a rejected key and
  a wrong model name look identical.
- No provider SDK is needed — the calls are plain `httpx`, already a dependency.

### Two guarantees the model cannot override

Both are enforced in `backend/app/services/ai_service.py` after the response
comes back, because a prompt is a request and a filter is a guarantee. Both were
added after watching Gemini violate them in a live test.

- **§46 — what leaves the process.** Only normalized telemetry goes out:
  protocol, flow statistics, selected metadata, rule findings and nDPI risk
  names. `minimize()` is an allowlist, so it fails closed — a new field added
  upstream is never silently sent. Raw payloads, passwords, cookies, bearer
  tokens and authorization headers cannot reach a provider even if a future
  caller passes them in.
- **§12 / §66 — what comes back.** Certainty language is reworded ("DNS
  tunneling **confirmed**" → "consistent with", "the host **is compromised**" →
  "may be"), and recommendations to block, isolate, quarantine or remediate are
  dropped rather than reworded, since this product investigates and does not act.

`tests/test_ai_layer.py` covers the wire protocol, the minimization, and both
filters — offline, with no key, by intercepting HTTP.

`backend/.env` works too and takes priority if both files exist.

---

## Quick start

```bash
# from netsentinel/
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r backend/requirements.txt

python scripts/generate_dataset.py     # synthetic labelled flows + a real .pcap
python scripts/train.py                # -> models/ndpi_detector.joblib
uvicorn backend.app.main:app --reload  # http://localhost:8000
```

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

The frontend calls the API directly at `NEXT_PUBLIC_API_URL`, which defaults to
`http://localhost:8000`. Set it in `frontend/.env.local` to point elsewhere:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

Run the backend first. With it down every page still renders, falling back to
the bundled sample capture, and the shell says so in a banner across the top —
so a demo never silently shows fixtures as if they were live.

The backend preloads 150 flows from `data/dataset.json` at startup, so every
view has real data before you upload anything. No dataset → it falls back to
`samples/demo_flows.json`.

### Verify everything

```bash
python -m pytest -q                  # 268 tests: rules, scoring, graph, DPI, L7, AI, persistence, ingest
python scripts/smoke_api.py          # every endpoint, in-process, no server needed
python scripts/benchmark.py          # accuracy / F1 / throughput report
python -m dpi.l7                     # L7 parser self-check, no deps
python -m backend.app.services.db    # schema + round-trip self-check, temp file
python scripts/live_ai_check.py      # the only one that hits the network (needs a key)
```

Everything above is offline. `live_ai_check.py` is the exception: it calls the
configured provider for real on `explain`, `ask` and `report`, and **fails if
the call fell back to mock** — so a rejected key or a retired model name cannot
pass as green. It checks the returned body, not the status code, and re-runs the
§12/§66 filters over genuine model output rather than a fixture.

---

## API

| Endpoint | Method | Used by |
|---|---|---|
| `/api/health` | GET | DPI mode, ML artifact, AI provider, flows loaded |
| `/api/dashboard` | GET | Dashboard stat cards + charts |
| `/api/network/graph` | GET | Dashboard graph, Network Explorer |
| `/api/entities` | GET | Entity list (risk-sorted, with degree) |
| `/api/alerts` | GET | Alerts table |
| `/api/alerts/{id}` | GET | Alert + its flow + any cached AI explanation |
| `/api/alerts/{id}/explain` | POST | AI explanation for one alert |
| `/api/ai/ask` | POST | AI Investigation tab — `{question}` → `{answer, evidence[]}` |
| `/api/ai/report` | POST | Capture-level AI briefing — summary, priorities, caveats |
| `/api/pathfinder` | POST | Pathfinder tab — `{from, to}` → `{path[], hops, suspicious}` |
| `/api/flows`, `/api/flows/{id}` | GET | Raw normalized flows |
| `/api/demo/load` | POST | Re-analyse the demo traffic |
| `/api/analyze/pcap` | POST | Upload a capture (multipart `file`) |
| `/api/jobs` | GET | Analysis job history (from SQLite, survives restart) |
| `/api/jobs/{id}/load` | POST | Reopen a stored capture into the live views |

The frontend was not modified. Two consequences worth knowing:

- Alert objects are a **superset** — they carry both `id/entity/type/risk/level/status/time`
  (what the table renders) and `alert_id/flow_id/rule_ids/severity/risk_score/evidence`
  (the documented API schema).
- `/api/pathfinder` returns **404** when either endpoint is not in the analysed
  capture. That is deliberate: the frontend then renders its own bundled example
  and flips its badge to "Demo data", which is the honest signal.

---

## Persistence

SQLite at `DATABASE_PATH` (default `./netsentinel.db`), stdlib `sqlite3`, schema
from PRD §32. Created on first boot; nothing to install or migrate.

The split is the part worth knowing:

- **`MemoryStore` is the working set** — whatever capture is on screen. Every
  read endpoint still goes through it, so nothing queries SQL on the hot path.
- **SQLite is the record** — written once when a capture finishes analysing.

So a restart no longer loses the analysis: `GET /api/jobs` lists stored
captures newest-first, and `POST /api/jobs/{id}/load` puts one back into the
live views. Alerts, findings, incidents, the graph and the pathfinder all serve
a restored capture with no special case, because each row stores the object the
store held, not just §32's queryable columns — otherwise ML output, confidence
factors and alternative explanations would vanish on the round trip.

Two things the schema does that §32 does not spell out:

- **Composite primary keys.** `flow_id` is `F-0001` in *every* capture (the
  reader numbers per file), so `alert_id` is `A-F-0001` in every capture too.
  Keyed on those alone, a second upload silently overwrites the first.
- **Retention.** `MAX_STORED_JOBS` (default 50) captures are kept; older ones
  are deleted with their flows, alerts, findings and incidents via
  `ON DELETE CASCADE`. Unbounded history is a slow disk leak.

A failed database write logs and is swallowed — the analysis is already done
and in the store, so a full disk must not turn a successful capture into a 500.

`tests/test_persistence.py` covers the round trip, the id collision, retention
and the §47 filename rule; `python -m backend.app.services.db` self-checks the
schema against a temp file.

---

## Deep packet inspection

Everything DPI-specific lives in `dpi/ndpi_adapter.py`, which tries three
modes in order:

1. **`ndpiReader`** — real nDPI. Found via `NDPI_READER`, `PATH`, or
   `NDPI_ROOT/example/ndpiReader`. Run as
   `ndpiReader -i cap.pcap -k out.json -K json -q`, then the JSONL is mapped
   onto the Flow schema, including `flow_risk` → `ndpi_risks`.
2. **Sidecar fixture** — `cap.pcap` next to `cap.json` uses the JSON directly.
3. **`dpi/pcap_flows.py` + `dpi/l7.py`** — pure-Python libpcap reader (all four
   magics, Ethernet/IPv4, TCP/UDP/ICMP) with **real L7 inspection**, ported from
   the Packet_analyzer C++ engine. No IPv6, no VLAN, no pcapng, and no nDPI risk
   flags — `ndpi_risks` stays empty in this mode.

Mode 3 is what runs out of the box on a machine with no C toolchain, and it is
what `/api/health` reports as `"dpi_mode": "python-l7"`.

### `dpi/l7.py` — the ported engine

The Packet_analyzer binary in the drop is a **Mach-O ARM64 (macOS) build**, and
it prints an aggregate ASCII report plus an SNI list to stdout rather than
per-flow records — so it can neither run here nor populate the Flow schema. Its
detection logic can, so that is what was ported, function by function:

| Upstream (C++) | Port |
|---|---|
| `sni_extractor.cpp` `SNIExtractor::isTLSClientHello` / `::extract` | `is_tls_client_hello`, `extract_sni` |
| `sni_extractor.cpp` `HTTPHostExtractor::extract` | `extract_http_host` |
| `sni_extractor.cpp` `DNSExtractor::extractQuery` | `extract_dns_query` |
| `types.cpp` `sniToAppType` / `appTypeToString` | `classify_hostname` (17 brands, upstream order) |

The SNI in a TLS Client Hello is plaintext even for HTTPS, which is what makes
brand identification possible without decryption. Match **order** is preserved
deliberately — upstream tests `ggpht` in the Google branch before the YouTube
branch, so `yt3.ggpht.com` classifies as Google.

**Two upstream bugs found and fixed.** `types.cpp` uses a bare substring search
for every needle, and Twitter/X is tested before Netflix and Microsoft, so:

- `"x.com"` substring-matches netfli**x.com** → `www.netflix.com` became Twitter/X
- `"t.co"` matches microsof**t.co**m → `www.microsoft.com` became Twitter/X

Both reproduced against upstream's own `test_dpi.pcap`. `_matches()` now
requires a dotted needle to align to DNS label boundaries (dot-padding both
sides), while bare words keep substring behaviour so `"google"` still catches
`googleapis.com`. `x.com` and `t.co` themselves still classify correctly.

### What lands on the Flow

`application` deliberately stays a **protocol** (`DNS` / `HTTPS` / `HTTP`),
because `detection/rules/basic.py` and `ml/detection_engine.py` both branch on
it. Brand identity is **additive metadata**, so nothing downstream changed:

| field | example |
|---|---|
| `metadata.l7_app` | `"YouTube"`, `"Microsoft"`, `"DNS"`, `"Unknown"` |
| `metadata.sni` | `"www.youtube.com"` |
| `metadata.hostname` | SNI or HTTP `Host:` |
| `metadata.dns_query` / `dns_query_count` | `"api.example.com"` / `3` |

DPI wins over the port table when it finds something — a flow on a
non-standard port is exactly what port-guessing gets wrong. A flow with no
identifying payload (already-established TLS, no Client Hello in the capture
window) still falls back to the well-known port.

Porting the DNS name extractor also fixed a **train/serve skew bug**:
`dns_query_entropy` was measuring the entropy of the *list of query lengths*
(`"[45, 52]"`), while the training set defines it as the entropy of the query
*name characters*. It is now the mean entropy of the individual names — not of
every name concatenated, which measures variety *across* lookups instead of
randomness *within* one and climbs with flow size (three ordinary hostnames
scored 3.65 against a 3.5 threshold). Both ends now measure one name at a time.

To get nDPI protocol IDs and risk flags on top of this, build nDPI
(https://github.com/ntop/nDPI) and point `NDPI_READER` at the binary — no other
code changes. `tests/test_ndpi_adapter.py` pins that path against nDPI's own
JSON serializer so it works first try.

---

## Synthetic dataset

`scripts/generate_dataset.py` writes two artifacts from one generator, so the
ML benchmark and the DPI path see the same traffic:

- `data/dataset.json` — 4000 labelled flows across `BENIGN`, `DNS_TUNNELING`,
  `PORT_SCAN`, `DOS`, `BOTNET`, `BRUTE_FORCE`, `DATA_EXFILTRATION`,
  `SUSPICIOUS_LEGACY_SERVICE`.
- `data/synthetic.pcap` — a real classic libpcap file with valid IPv4/TCP/UDP/ICMP
  checksums and genuine DNS question records. Packet counts are capped per flow
  and each flow's duration is scaled by the same factor, so every *rate* feature
  survives the downsampling unchanged.

~18% of flows are **boundary cases**: a benign activity and a specific attack
drawn from the *identical* distribution with all metadata reset — a nightly
backup vs. a throttled exfil, an asset scanner vs. slow recon, a busy resolver
vs. a low-rate DNS tunnel. Without them every class sits in its own region of
feature space and the model scores a meaningless 1.000.

Note: the scan classes expand to real fan-out in the pcap, so the capture is
scan-heavy and `/api/analyze/pcap` flags most of it. A host that scans really
does show high fan-out on all its other flows — the feature is per-source-IP by
design.

---

## Benchmark

800 held-out flows, 30 features, single process. Reproduce with
`python scripts/benchmark.py` (full report also written to `data/benchmark.json`).

**Binary — is this flow malicious?**

| detector | accuracy | precision | recall | F1 | FPR | flows/s |
|---|---|---|---|---|---|---|
| rules only | 0.849 | 0.864 | 0.813 | 0.838 | 0.118 | 575k |
| ML heuristic (no artifact) | 0.863 | 0.901 | 0.802 | 0.849 | 0.082 | 104k |
| ML trained | 0.919 | 0.858 | 0.995 | 0.922 | 0.151 | 480 |
| **fused (what the API returns)** | **0.921** | **0.859** | **1.000** | **0.924** | 0.151 | 480 |

**Multi-class — which threat is it?**

| engine | accuracy | macro F1 |
|---|---|---|
| ML heuristic | 0.728 | 0.521 |
| ML trained | 0.919 | 0.919 |

Per-class F1 (trained): BENIGN 0.92, BOTNET 0.94, BRUTE_FORCE 0.94,
DATA_EXFILTRATION 0.88, DNS_TUNNELING 0.93, DOS 0.90, PORT_SCAN 0.93,
SUSPICIOUS_LEGACY_SERVICE 0.91.

The heuristic scores 0.00 on BOTNET, BRUTE_FORCE and DOS — it has no rule for
them, and TCP floods land in its PORT_SCAN branch. That gap is what the trained
model buys.

Every remaining error is a boundary case: all 63 false positives are ambiguous
benign flows, and the fused pipeline misses nothing (recall 1.000) at the cost
of a 15% false-positive rate on benign traffic. `class_weight="balanced_subsample"`
chooses that trade deliberately.

**Capture throughput** (`data/synthetic.pcap`, 1.16 MB, 3869 packets → 593 flows):

| stage | rate |
|---|---|
| pcap parse + flow aggregation (with L7 inspection) | 181k packets/s (54 MB/s) |
| parse + rules + ML end-to-end | 427 flows/s (1.4 s for the whole capture) |

Payload inspection costs ~23% of raw parse throughput (was 234k packets/s
port-guessing only) and is invisible end-to-end — the ML model is still the
bottleneck at ~2 ms/flow: sklearn's per-call overhead on single-row `predict` +
`predict_proba`, not tree traversal. Two things already applied: the artifact is
saved with `n_jobs=1` (a forest fitted with `n_jobs=-1` pays a joblib dispatch
*per row* — that alone was 27 flows/s), and the forest is 60 shallow trees
instead of 200 unbounded ones, which is both more accurate here and 3× faster.
Next step if it ever matters: batch the flows through one `predict` call.

**Real-world captures** — 439 files (nDPI's `tests/pcap` corpus + the two
Packet_analyzer ships):

| metric | result |
|---|---|
| captures parsed | 360 / 439 (79 skipped: all pcapng, with a clear error) |
| flows | 7,733 in 0.43 s (17.9k flows/s) |
| L7-identified | 1,709 (22.1%), incl. 187 named-brand flows |
| unique hostnames recovered from payload | 424 |

Top brands: Microsoft 46, Google 37, Netflix 30, Apple 25, Instagram 16,
WhatsApp 5, Cloudflare 5, Facebook 4, GitHub 3, Amazon 3, Zoom 3, Twitter/X 2.
The 78% unidentified is expected and honest — that corpus is deliberately full
of obscure protocols, mid-stream captures with no Client Hello, and IPv6, which
mode 3 does not read.

On Packet_analyzer's own `test_dpi.pcap`: 22 of 27 flows identified (16 TLS
brands, 2 HTTP, 4 DNS). Their `output.pcap` is the post-blocking result of the
same capture, and it is missing exactly YouTube and Facebook — their engine's
blocked set — which independently reproduces their result through the port.

---

## Layout

```
backend/app/main.py              all endpoints
backend/app/core/config.py       settings + .env loading (API key lives here)
backend/app/services/analysis.py rules + ML fusion, store population
backend/app/services/graph.py    flows -> entity graph, BFS pathfinder
backend/app/services/db.py       sqlite persistence (§32), job save / restore
backend/app/services/ai_service.py  mock / Gemini / OpenAI / Anthropic analyst layer
detection/                       rules + scoring (transparent, weighted)
dpi/ndpi_adapter.py              DPI boundary (3 modes)
dpi/pcap_flows.py                pure-Python pcap reader + flow aggregation
dpi/l7.py                        TLS SNI / HTTP Host / DNS DPI (Packet_analyzer port)
ml/detection_engine.py           feature extraction + heuristic + classifier
scripts/                         generate_dataset, train, benchmark, smoke_api, live_ai_check
client/netsentinel.js            browser capture agent — one script tag, any site
client/capture_agent.py          backend capture agent — stdlib only, any Python service
frontend/                        Next.js dashboard (App Router, Tailwind)
frontend/lib/api.ts              the single typed client; every backend call goes through it
frontend/lib/graph-adapter.ts    backend graph -> validated render nodes/edges
docs/CAPTURE_MODULE.md           how telemetry gets in, and what each route can see
```

## Capture module

Three ways in — PCAP upload, a browser agent that installs on any site with one
script tag, and a stdlib-only Python agent for a service backend. All three
produce the same normalized flow and enter the same pipeline.

Full contract, privacy guarantees and troubleshooting: **[docs/CAPTURE_MODULE.md](docs/CAPTURE_MODULE.md)**.

## Team ownership

- Member 1: `dpi/` + nDPI adapter + packet/flow ingestion.
- Member 2: `detection/` + rules + scoring.
- Member 3: `backend/` + `ai/` + data orchestration.
- Member 4: `frontend/` + dashboard + demo flow.

## Safety / privacy

Run captures only on traffic you are authorized to inspect. The AI layer is
sent flow metadata and alert evidence only — never raw packet payloads,
credentials, cookies, or authorization headers.
