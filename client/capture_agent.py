"""NetSentinel capture agent — drop-in network analytics for any website.

Stdlib only (urllib, threading, socket) so it can be vendored into any Python
web app — Django, Flask, FastAPI, plain WSGI — with zero installs:

    from capture_agent import configure, observe, flush

    configure(server="http://localhost:8000", client_id="shop-frontend")
    # call once per outbound request (your HTTP client wrapper is the one
    # place every request already routes through):
    observe("8.8.8.8", dport=53, app="DNS", packets=2, nbytes=240)

Events are merged into bidirectional-per-bucket flows
(`src>dport>dst>app` — the fields every detector in detection/ reads) and
POSTed to the server's /api/agent/ingest endpoint, which runs the same
analyse_flows pipeline as a pcap upload. flush() forces a send (call it from
your request-teardown hook for near-live analytics).

ponytail: no per-host background threads, no retry queue, no batch confirm.
A dropped POST is logged and its bucket kept for the next flush. Add a
retry/dedup queue when a lost batch matters; the server's analyse_flows
already overwrites the working set per batch, so replays are safe.
"""
from __future__ import annotations

import json
import logging
import socket
import threading
import time
import urllib.request
import uuid

log = logging.getLogger("netsentinel.agent")

_settings = {
    "server": "http://localhost:8000",  # where to POST
    "client_id": "website-agent",        # tag on every batch
    "api_key": "",                       # shared secret, or skip the check
    "flush_interval": 10.0,               # seconds between automatic sends
    "network": "",                       # "" = autodetect the local egress IP
    "hostname": "",                      # "" = socket.gethostname()
}
_local_ip: str | None = None
_lock = threading.Lock()
_buckets: dict[str, dict] = {}
_last_flush = 0.0
_last_error: str | None = None


def configure(**overrides) -> None:
    """Update any setting (server, client_id, api_key, flush_interval, ...)."""
    with _lock:
        _settings.update(overrides)
        if "network" in overrides:
            global _local_ip
            _local_ip = None


def local_ip() -> str:
    """The source IP stamped on every flow. Cache it; the socket dance is slow."""
    global _local_ip
    if _local_ip is None:
        try:
            # ponytail: UDP connect never sends a packet; it just makes the OS
            # pick a route. Fails on hosts with no route at all — fall back to
            # the hostname, which detection treats as external (fine).
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(("8.8.8.8", 80))
                _local_ip = s.getsockname()[0]
            finally:
                s.close()
        except OSError:
            _local_ip = _settings["hostname"] or socket.gethostname()
    return _local_ip


def observe(
    dest_ip: str,
    dport: int,
    app: str = "UNKNOWN",
    *,
    packets: int = 1,
    nbytes: int = 0,
    duration_seconds: float = 0.0,
    ndpi_risks: list[str] | None = None,
    metadata: dict | None = None,
    src_ip: str | None = None,
) -> None:
    """Record one outbound event. Thread-safe; call it from your request path.

    `app` is what the port says (HTTPS, DNS, ...) — the same fallback pcap
    flows without payload use. `ndpi_risks` is where you feed your own signal
    (bad-IP hit, cert anomaly) if you have one.
    """
    key = f"{dport}>{dest_ip}>{app}"
    with _lock:
        bucket = _buckets.get(key)
        if bucket is None:
            bucket = _buckets[key] = {
                "flow_id": f"{key}>{uuid.uuid4().hex[:8]}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source_ip": src_ip or local_ip(),
                "destination_ip": dest_ip,
                "source_port": 0,          # client side of the 5-tuple varies; not read by detection
                "destination_port": dport,
                "transport": "UDP" if dport == 53 else "TCP",
                "application": app,
                "packets": 0,
                "bytes": 0,
                "duration_seconds": 0.0,
                "ndpi_risks": ndpi_risks or [],
                "metadata": metadata or {},
            }
        bucket["packets"] += packets
        bucket["bytes"] += nbytes
        bucket["duration_seconds"] += max(duration_seconds, 0.0)
        if ndpi_risks:
            seen = set(bucket["ndpi_risks"])
            bucket["ndpi_risks"] += [r for r in ndpi_risks if r not in seen]
        if metadata:
            bucket["metadata"].update(metadata)


def flush(timeout: float = 5.0) -> dict | None:
    """POST all recorded flows to the server. Returns its JSON reply or None.

    One batch holds the whole working set on the server side (that is how the
    pcap path works too — analyse_flows replaces the store per capture), so
    the bucket list is drained only on a confirmed send.
    """
    global _last_flush, _last_error
    with _lock:
        flows = list(_buckets.values())
        if not flows:
            return None
        # Stamped before the attempt, not after a success: a server that is
        # down must not turn maybe_autoflush() into a retry every call.
        _last_flush = time.time()
        url = _settings["server"].rstrip("/") + "/api/agent/ingest"
        headers = {"Content-Type": "application/json"}
        if _settings["api_key"]:
            headers["X-API-Key"] = _settings["api_key"]
        body = json.dumps({
            "client_id": _settings["client_id"],
            "api_key": _settings["api_key"],
            "flows": flows,
        }).encode()
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read().decode())
        except Exception as exc:  # noqa: BLE001
            _last_error = str(exc)
            log.warning("netsentinel: batch of %d flows not delivered (%s); kept for retry",
                        len(flows), exc)
            return None
        for f in flows:
            _buckets.pop(f"{f['destination_port']}>{f['destination_ip']}>{f['application']}", None)
        _last_error = None
        return result


def maybe_autoflush() -> None:
    """Flush if the interval elapsed. Call from any periodic hook you have."""
    if time.time() - _last_flush >= _settings["flush_interval"]:
        flush()


def status() -> dict:
    """Queue depth, last flush and last error — the health surface of PRD §8."""
    with _lock:
        return {
            "queued": len(_buckets),
            "last_flush": _last_flush or None,
            "last_error": _last_error,
            "server": _settings["server"],
            "client_id": _settings["client_id"],
        }
