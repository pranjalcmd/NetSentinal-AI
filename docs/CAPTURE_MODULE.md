# Capture module

How network telemetry gets into the system, and what each route can honestly
see. Three sources feed one pipeline:

```
  PCAP / PCAPNG file  ─┐
  Browser agent (JS)  ─┼─►  normalized Flow  ─►  DPI ─► rules ─► ML ─► correlation
  Backend agent (Py)  ─┘
```

Everything below produces the same `Flow` record. Nothing downstream knows or
cares which route a flow arrived by, except that browser-sourced flows are
tagged so their weaker fields are not mistaken for packet capture.

---

## 1. The flow record

Every source must emit this shape. Fields with no honest value are omitted or
zero — never filled with a plausible-looking default.

```jsonc
{
  "flow_id": "443>example.com>HTTPS>a1b2c3d4",  // stable within a batch
  "timestamp": "2026-09-20T18:04:11Z",
  "source_ip": "192.168.1.20",
  "destination_ip": "93.184.16.204",
  "source_port": 0,
  "destination_port": 443,
  "transport": "TCP",
  "application": "HTTPS",
  "packets": 12,
  "bytes": 48213,
  "duration_seconds": 3.5,
  "ndpi_risks": [],
  "metadata": {}
}
```

`flow_id` is the merge key. Re-sending a flow with the same id updates it
rather than duplicating it, so a retried batch is safe.

---

## 2. Route A — PCAP upload

The richest source: real packets, so protocol identification, payload-derived
hostnames and timing are all genuine.

```
POST /api/analyze/pcap
Content-Type: multipart/form-data
file=<capture.pcap|.pcapng>
```

- Size limit is `MAX_UPLOAD_MB` (default 100).
- Rejected with `400` if the extension is not `.pcap`/`.pcapng`, `422` if the
  reader cannot parse it, `413` if it is too large.
- The upload **replaces** the working set — a capture is a complete picture.
- If the reader understood only part of the file, the response message says what
  fraction was read and why. Findings then cover that portion only.

The file is written to a private temp directory under its basename only, so a
crafted filename cannot escape it, and it is deleted when analysis finishes.

---

## 3. Route B — Browser agent (any website)

`client/netsentinel.js`. One script tag, no build step, no dependency, and it
does not care what language the site's backend is written in.

```html
<script src="/netsentinel.js"
        data-server="https://your-api.example.com"
        data-client-id="shop-frontend"
        data-key="YOUR_AGENT_KEY"></script>
```

Or configure it by hand:

```js
NetSentinel.start({ server: 'https://your-api.example.com', clientId: 'shop', apiKey: '…' });
NetSentinel.status();   // { running, queued, lastFlush, lastError, server, clientId }
NetSentinel.flush();    // force a send now
NetSentinel.stop();
```

### What it actually measures

A web page cannot read packets. This agent reports what the browser genuinely
exposes — `PerformanceObserver` entries of type `resource`, i.e. every fetch,
XHR, image, script and stylesheet the page requests.

| Field | Source | Trustworthy? |
|---|---|---|
| `destination_ip` | the request URL's **hostname** | yes (a name, not an address) |
| `destination_port` | from the URL scheme/port | yes |
| `bytes` | `transferSize` | **0 for cross-origin responses** unless that server sends `Timing-Allow-Origin` |
| `packets` | count of observed requests | it is a request count, not a packet count |
| `duration_seconds` | `entry.duration` | yes |
| `source_ip` | left empty; the **server** stamps the peer address | yes |

Every flow carries `metadata.source = "browser-rum"` so nothing downstream reads
it as packet capture.

### Why it installs anywhere

The batch is sent with `navigator.sendBeacon` as `text/plain`. That is a
CORS-safelisted content type, so the request is *simple*: no preflight, and no
`Access-Control-Allow-Origin` needed on the API for the send to succeed. It also
survives the page being closed mid-flush.

### Privacy

Only the destination **hostname** leaves the page. A URL is reduced to its
hostname before it is ever stored, so paths and query strings — where tokens and
identifiers live — are never read. Headers, cookies and bodies are never touched.

### Known limits

- The agent never observes its own flush; without that guard each batch creates
  the entry that causes the next one.
- `sendBeacon` refuses oversized bodies. The batch is kept and retried on the
  next flush rather than dropped, and a flush is forced early past 200 buckets.
- No durable retry queue: an undelivered batch lives in memory until the next
  flush succeeds or the tab closes.

---

## 4. Route C — Backend agent (any Python service)

`client/capture_agent.py`. Standard library only — `urllib`, `threading`,
`socket` — so it can be vendored into Django, Flask, FastAPI or plain WSGI with
nothing to install.

```python
from capture_agent import configure, observe, flush, status

configure(server="http://localhost:8000", client_id="shop-backend", api_key="…")

# call once per outbound request, from whatever wrapper every request routes through
observe("8.8.8.8", dport=53, app="DNS", packets=2, nbytes=240)

flush()             # force a send (e.g. from a request-teardown hook)
maybe_autoflush()   # send only if flush_interval elapsed
status()            # {'queued', 'last_flush', 'last_error', 'server', 'client_id'}
```

Events are merged into buckets keyed `dport>dest_ip>app` and flushed as one
batch. `source_ip` is the host's egress address, discovered once by opening a
UDP socket toward a public address — which sends no packet, it only makes the OS
pick a route.

Settings: `server`, `client_id`, `api_key`, `flush_interval` (default 10s),
`network`, `hostname`.

### Known limits

- `observe()` must be called by you; there is no automatic instrumentation.
- A failed POST is logged and its bucket kept for the next flush. There is no
  durable queue, so a process restart loses the pending batch.

---

## 5. The ingest endpoint

```
POST /api/agent/ingest
Content-Type: application/json   (or text/plain, for sendBeacon)

{ "client_id": "shop-frontend", "api_key": "…", "flows": [ … ] }
```

**Authentication.** If `AGENT_API_KEY` is set, the key must match — supplied in
the body, or as an `X-API-Key` header. `sendBeacon` cannot set headers, which is
why the body carries it. Leaving `AGENT_API_KEY` empty leaves the endpoint open;
do that only on a trusted network.

**Merge semantics.** Unlike a PCAP upload, a batch is *merged* into the working
set — one flush is a few seconds of traffic, and replacing on every flush would
leave the dashboard showing only the last interval. The exception is an agent's
**first** flush, which clears whatever was there (preloaded demo traffic, or
another capture) so live and sample data are never mixed.

**Windowing.** Live flows accumulate up to `MAX_LIVE_FLOWS` (default 5000),
newest kept.

**Job history.** All of one agent's flushes share a single job row,
`AGENT-<client_id>`. A new row per flush would rotate real captures out of the
50-row history within minutes.

**Limits.** `400` on a missing or empty `flows` list or an unparseable body,
`401` on a bad key, `413` past 10 000 flows in one batch.

---

## 6. Verifying it works

```bash
curl -s http://127.0.0.1:8000/api/health
```

`flows_loaded` should rise after a flush. Then:

```bash
curl -s http://127.0.0.1:8000/api/jobs
```

The newest row should be `AGENT-<your client_id>` with a message naming how many
flows were merged and how many are in the working set.

If nothing arrives:

| Symptom | Likely cause |
|---|---|
| `401` | `AGENT_API_KEY` is set and the agent's key does not match |
| Browser agent silent, `status().lastError` set | check `data-server` is reachable from the page's origin |
| Flows arrive with `bytes: 0` | cross-origin responses without `Timing-Allow-Origin` — expected, not a fault |
| Counts reset each flush | an older build; merging was added with the first-flush-replaces rule |

Automated coverage lives in `tests/test_agent_ingest.py` — payload rejection,
key enforcement from body and header, first-flush-replaces-then-accumulates,
replay safety, the browser beacon's `text/plain` path, and peer-address stamping.
