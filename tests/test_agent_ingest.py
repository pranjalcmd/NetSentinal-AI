"""Live agent ingest: /api/agent/ingest + client/capture_agent.py contract."""
import json
import urllib.request

from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app

FLOWS = [
    {"flow_id": "A-1", "timestamp": "2026-09-20T10:00:00Z", "source_ip": "192.168.1.20",
     "destination_ip": "8.8.8.8", "source_port": 53001, "destination_port": 53,
     "transport": "UDP", "application": "DNS", "packets": 380, "bytes": 42000,
     "duration_seconds": 60, "ndpi_risks": [], "metadata": {}},
    {"flow_id": "A-2", "timestamp": "2026-09-20T10:01:00Z", "source_ip": "192.168.1.50",
     "destination_ip": "198.51.100.25", "source_port": 55000, "destination_port": 443,
     "transport": "TCP", "application": "HTTPS", "packets": 1200, "bytes": 9000000,
     "duration_seconds": 45, "ndpi_risks": ["Risky domain"],
     "metadata": {"high_outbound_ratio": True}},
]


def test_ingest_rejects_bad_payloads():
    with TestClient(app) as c:
        assert c.post("/api/agent/ingest", json={"flows": []}).status_code == 400
        assert c.post("/api/agent/ingest", json={"flows": "nope"}).status_code == 400


def test_ingest_requires_key_when_configured():
    settings.agent_api_key = "k1"
    try:
        with TestClient(app) as c:
            r = c.post("/api/agent/ingest", json={"client_id": "x", "flows": FLOWS})
            assert r.status_code == 401
            r = c.post("/api/agent/ingest",
                       json={"client_id": "shop", "api_key": "k1", "flows": FLOWS})
            assert r.status_code == 200
            job = r.json()
            assert job["status"] == "complete"
            assert job["summary"]["total_flows"] == 2
    finally:
        settings.agent_api_key = ""


def test_first_flush_replaces_then_later_ones_accumulate():
    """A live agent flush is seconds of traffic, so batches must add up.

    The first batch still clears the preloaded demo capture: merging live
    traffic into demo traffic would misreport both.
    """
    with TestClient(app) as c:
        first = c.post("/api/agent/ingest",
                       json={"client_id": "shop", "flows": FLOWS})
        assert first.status_code == 200
        assert first.json()["summary"]["total_flows"] == 2

        more = [{**FLOWS[0], "flow_id": "A-3"}, {**FLOWS[1], "flow_id": "A-4"}]
        second = c.post("/api/agent/ingest",
                        json={"client_id": "shop", "flows": more})
        assert second.json()["summary"]["total_flows"] == 4

        # Same flow_id again updates in place rather than duplicating, so a
        # replayed batch is safe.
        replay = c.post("/api/agent/ingest",
                        json={"client_id": "shop", "flows": more})
        assert replay.json()["summary"]["total_flows"] == 4

        # One job row per agent, not one per flush.
        assert replay.json()["job_id"] == "AGENT-shop"
        assert [j for j in c.get("/api/jobs").json()
                if j["job_id"] == "AGENT-shop"]


def test_browser_beacon_body_is_accepted_and_source_stamped():
    """navigator.sendBeacon posts text/plain and the page cannot know its IP."""
    beacon = {"client_id": "web", "flows": [{**FLOWS[0], "source_ip": ""}]}
    with TestClient(app) as c:
        r = c.post("/api/agent/ingest", content=json.dumps(beacon),
                   headers={"Content-Type": "text/plain;charset=UTF-8"})
        assert r.status_code == 200
        flow = c.get("/api/flows/A-1").json()
        assert flow["source_ip"], "server must stamp the peer address"

        assert c.post("/api/agent/ingest", content=b"not json",
                      headers={"Content-Type": "text/plain"}).status_code == 400


def test_ingest_accepts_key_from_header():
    """The Python agent sends X-API-Key; sendBeacon can only use the body."""
    settings.agent_api_key = "k2"
    try:
        with TestClient(app) as c:
            assert c.post("/api/agent/ingest", json={"flows": FLOWS},
                          headers={"X-API-Key": "k2"}).status_code == 200
            assert c.post("/api/agent/ingest", json={"flows": FLOWS},
                          headers={"X-API-Key": "wrong"}).status_code == 401
    finally:
        settings.agent_api_key = ""


def test_agent_sends_expected_shape():
    """The agent's POST is exactly what the endpoint reads: one URL, one body."""
    captured = []

    class FakeResponse:
        def read(self):
            return b'{"ok": true}'

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    def fake_open(req, timeout=None):
        captured.append((req.full_url, json.loads(req.data.decode())))
        return FakeResponse()

    original, urllib.request.urlopen = urllib.request.urlopen, fake_open
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "capture_agent", "client/capture_agent.py")
        ca = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ca)

        ca.configure(server="http://srv.test", client_id="site", api_key="secret")
        ca.observe("8.8.8.8", 53, "DNS", packets=2, nbytes=240)
        ca.observe("8.8.8.8", 53, "DNS", packets=1, nbytes=80)  # merges into one bucket
        assert ca.flush() == {"ok": True}

        url, body = captured[0]
        assert url == "http://srv.test/api/agent/ingest"
        assert body["client_id"] == "site" and body["api_key"] == "secret"
        flow = body["flows"][0]
        assert flow["packets"] == 3 and flow["bytes"] == 320
        assert all(flow[f] for f in ("flow_id", "source_ip", "destination_ip",
                                     "destination_port", "timestamp"))
        assert ca.flush() is None  # buckets drained on confirmed send

        # flush() must record the send against the module global, not a local:
        # when it did not, maybe_autoflush() saw 0.0 forever and sent on every
        # single call instead of once per interval.
        assert ca.status()["last_flush"], "flush did not record _last_flush"
        ca.observe("1.1.1.1", 443, "HTTPS", nbytes=10)
        ca.configure(flush_interval=3600)
        ca.maybe_autoflush()
        assert len(captured) == 1, "autoflush ignored the interval"
        assert ca.status()["queued"] == 1
    finally:
        urllib.request.urlopen = original
