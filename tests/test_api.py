"""API wiring tests — the PRD §29 contract over the real pipeline.

Nothing is mocked. Each upload is a capture built byte by byte (the builders
live in test_capture.py) and goes through the actual chain:

    multipart -> temp file -> NDPIAdapter -> capture engine -> DPI/L7
              -> detection engine -> findings/incidents/alerts -> JSON

So these tests fail if any link in the wiring breaks, including the quiet ways:
a response model that strips the detection engine's fields on the way out, a
partial capture presented as a whole one, an upload path that escapes its
directory.

Run: python -m pytest tests/test_api.py -q
"""
from __future__ import annotations

import random
import string
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from test_capture import (
    BASE_TIME,
    dns_query,
    eth,
    ipv4,
    pcap_bytes,
    tcp,
    udp,
)

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def client():
    # `with` runs the startup hook, so the preloaded demo traffic is real too.
    with TestClient(app) as test_client:
        yield test_client


def attack_capture() -> bytes:
    """One capture carrying three behaviours the rules are supposed to catch."""
    rng = random.Random(11)
    alphabet = string.ascii_lowercase + string.digits
    frames, times = [], []

    # DNS tunneling: 60 long high-entropy queries inside one second.
    for _ in range(60):
        label = "".join(rng.choice(alphabet) for _ in range(52))
        frames.append(eth(ipv4(udp(dns_query(f"{label}.tun.example.com")),
                               src="10.0.0.5", dst="10.0.0.53")))
        times.append(BASE_TIME)

    # Port sweep: one host, 20 destinations, 20 ports, SYN only.
    for i in range(20):
        frames.append(eth(ipv4(tcp(sport=40000 + i, dport=20 + i, flags=0x02), proto=6,
                               src="10.0.0.9", dst=f"10.0.2.{i + 1}")))
        times.append(BASE_TIME + 1)

    # Lateral movement: internal -> internal SMB fan-out.
    for i in range(8):
        frames.append(eth(ipv4(tcp(b"x" * 200, sport=50000 + i, dport=445, flags=0x18), proto=6,
                               src="10.0.0.9", dst=f"10.0.3.{i + 1}")))
        times.append(BASE_TIME + 2)

    return pcap_bytes(frames, times=times)


def upload(client, blob: bytes, filename: str = "attack.pcap"):
    return client.post("/api/analyze/pcap",
                       files={"file": (filename, blob, "application/octet-stream")})


# ===========================================================================
# health + demo
# ===========================================================================

def test_health_reports_the_modes_it_is_actually_running(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["service"] == "netsentinel-api"
    assert body["dpi_mode"] in {"ndpiReader", "python-l7"}
    assert isinstance(body["ml_trained_model"], bool)
    # A key is never echoed back, only whether one is configured (PRD §47).
    assert body["ai_key_configured"] in (True, False)
    assert "ai_api_key" not in body and "AI_API_KEY" not in str(body)
    assert body["flows_loaded"] >= 0



def test_demo_load_is_deterministic(client):
    first = client.post("/api/demo/load").json()
    second = client.post("/api/demo/load").json()
    assert first["status"] == "complete"
    assert first["summary"]["total_flows"] == second["summary"]["total_flows"]
    assert first["summary"]["risk_distribution"] == second["summary"]["risk_distribution"]


# ===========================================================================
# upload rejection paths (PRD §30 wording, §47 upload rules)
# ===========================================================================

def test_only_capture_extensions_are_accepted(client):
    response = upload(client, b"MZ\x90\x00", "payload.exe")
    assert response.status_code == 400
    assert "pcap" in response.json()["detail"]


def test_a_file_that_is_not_a_capture_is_refused_with_the_prd_wording(client):
    response = upload(client, b"not a capture at all" * 10, "junk.pcap")
    assert response.status_code == 422
    assert response.json()["detail"].startswith(
        "This file could not be processed as a supported network capture")


def test_a_capture_with_no_flows_says_so(client):
    """A readable file with nothing in it is a different failure from a broken
    one, and PRD §30 gives it its own sentence."""
    response = upload(client, pcap_bytes([]), "empty.pcap")
    assert response.status_code == 422
    assert response.json()["detail"].startswith("Capture contains no analyzable flows.")


def test_an_oversized_upload_is_cut_off_mid_stream(client, monkeypatch):
    """The limit is enforced while reading, not after — a 4 GB upload must not
    have to land on disk first."""
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    response = upload(client, b"\x00" * (2 * 1024 * 1024), "big.pcap")
    assert response.status_code == 413
    assert "MAX_UPLOAD_MB" in response.json()["detail"]


def test_a_filename_cannot_escape_the_upload_directory(client):
    """PRD §47: only the basename, and only inside a private temp dir."""
    escaped = Path(tempfile.gettempdir()).parent / "pwned.pcap"
    response = upload(client, attack_capture(), "../../pwned.pcap")
    assert response.status_code == 200
    assert not escaped.exists()
    assert not (ROOT / "pwned.pcap").exists()


# ===========================================================================
# the shipped sample captures (PRD §28 files, §51 acceptance path)
# ===========================================================================

SAMPLES = ROOT / "samples"

# What each §28 sample is for. `scripts/make_samples.py` checks this at build
# time; this checks the files actually on disk, through the API, because those
# are what a demo uploads — and nothing else notices when they rot.
#
# normal.pcap is the load-bearing one: a detector that flagged everything would
# pass all three positive cases, so the clean capture is the only test here that
# can fail from over-detection. It is the reason this file catches the DNS
# entropy false positive.
SAMPLE_EXPECTATIONS = {
    "normal.pcap": None,
    "suspicious_dns.pcap": "DNS_HIGH_FREQUENCY",
    "repeated_connections.pcap": "UNUSUAL_LEGACY_PORT",
    "high_outbound.pcap": "HIGH_OUTBOUND_VOLUME",
}


@pytest.mark.parametrize("name,expected_rule", sorted(SAMPLE_EXPECTATIONS.items()))
def test_each_shipped_sample_uploads_and_analyses(client, name, expected_rule):
    """§51: a valid capture is accepted, analysis runs, a result is shown."""
    path = SAMPLES / name
    if not path.exists():
        pytest.skip(f"{name} missing — run `python scripts/make_samples.py`")

    job = upload(client, path.read_bytes(), name).json()
    assert job["status"] == "complete"
    assert job["summary"]["total_flows"] > 0
    assert job["summary"]["capture"]["coverage"] == 1.0

    if expected_rule is None:
        # The clean capture. Zero *findings*, not merely zero alerts: a LOW
        # finding on ordinary browsing is still a false positive, it is just one
        # the MEDIUM alert cut would hide. §30 gives this its own wording, so an
        # empty result reads as a result and not as a failure.
        assert client.get("/api/findings").json() == []
        assert job["summary"]["suspicious_flows"] == 0
        assert job["message"] == "No suspicious behaviour was flagged in this capture."
    else:
        # Findings, not alerts: findings are the record, and the alert queue
        # deliberately drops anything below MEDIUM. high_outbound.pcap is one
        # flow carrying one 25-point rule, so it is a real LOW finding and
        # correctly never reaches the queue.
        rules = {r for f in client.get("/api/findings").json() for r in f["rule_ids"]}
        assert expected_rule in rules, sorted(rules)


# ===========================================================================
# the analysis path
# ===========================================================================

def test_pcap_upload_runs_the_whole_pipeline(client):
    job = upload(client, attack_capture()).json()
    assert job["status"] == "complete"
    assert job["filename"] == "attack.pcap"

    summary = job["summary"]
    assert summary["total_flows"] == 29          # 1 DNS + 20 scan + 8 SMB
    assert summary["suspicious_flows"] == 29     # every one of them is flagged
    assert summary["incidents"] >= 1

    capture = summary["capture"]
    assert capture["container"] == "pcap"
    assert capture["coverage"] == 1.0
    assert capture["packets_read"] == 88
    assert capture["capture_id"].startswith("CAP-")
    assert capture["dpi_mode"] in {"ndpiReader", "python-l7"}


def test_rules_alone_do_not_reach_high(client):
    """Not a gap — the design. fusion-v1 caps the `rule` source at 55 of 100
    points, so three agreeing DNS-tunneling rules land at MEDIUM and HIGH stays
    reserved for findings a second evidence source corroborates. That cap is
    what holds HIGH at ~0.99 precision on the labelled set (see
    backend/app/services/analysis.py). Change it only with new numbers."""
    summary = upload(client, attack_capture()).json()["summary"]
    assert summary["risk_distribution"]["MEDIUM"] == 29
    assert summary["high_risk"] == 0


def test_detection_fields_survive_the_response_model(client):
    """Regression: DashboardSummary/DetectionAlert used to validate the frozen
    §19 keys and silently drop everything the detection engine adds."""
    summary = upload(client, attack_capture()).json()["summary"]
    alert = summary["recent_alerts"][0]
    for key in ("confidence", "behavior_family", "attribution", "finding_ids",
                "incident_id", "alternative_explanations", "recommended_next_steps"):
        assert key in alert, sorted(alert)
    assert summary["top_incidents"]


def test_partial_coverage_is_reported_not_smoothed_over(client):
    """PRD §1.2 Principle E — an analysis of half a capture must say so."""
    readable = eth(ipv4(udp(dns_query("www.example.com")), src="10.0.0.5", dst="10.0.0.53"))
    unreadable = eth(b"\x00" * 40, 0x0806)          # ARP
    job = upload(client, pcap_bytes([readable, unreadable] * 5)).json()

    assert job["summary"]["capture"]["coverage"] == 0.5
    assert job["summary"]["capture"]["packets_skipped"] == {"non_ip": 5}
    assert "50% of 10 packets were read" in job["message"]
    assert "non_ip" in job["message"]


# ===========================================================================
# the detection record behind the alerts
# ===========================================================================

@pytest.fixture(scope="module")
def analysed(client):
    """One analysed capture the read endpoints below can all share."""
    upload(client, attack_capture())
    return client


def test_alerts_are_ordered_by_risk(analysed):
    alerts = analysed.get("/api/alerts").json()
    scores = [a["risk_score"] for a in alerts]
    assert alerts and scores == sorted(scores, reverse=True)


def test_alert_detail_carries_the_findings_behind_it(analysed):
    alert_id = analysed.get("/api/alerts").json()[0]["alert_id"]
    detail = analysed.get(f"/api/alerts/{alert_id}").json()

    assert detail["alert"]["alert_id"] == alert_id
    assert detail["flow"]["flow_id"] == detail["alert"]["flow_id"]
    assert detail["findings"], "an alert with no findings behind it is a claim with no evidence"
    assert {f["finding_id"] for f in detail["findings"]} == set(detail["alert"]["finding_ids"])
    if detail["alert"]["incident_id"]:
        assert detail["incident"]["incident_id"] == detail["alert"]["incident_id"]


def test_findings_outnumber_alerts(analysed):
    """Findings are the record, alerts are the queue: everything is kept and
    drillable, only MEDIUM+ is raised."""
    findings = analysed.get("/api/findings").json()
    alerts = analysed.get("/api/alerts").json()
    assert len(findings) >= len(alerts) > 0
    assert all("observed_facts" in f for f in findings)


def test_incident_detail_resolves_its_findings(analysed):
    incidents = analysed.get("/api/incidents").json()
    assert incidents
    incident_id = incidents[0]["incident_id"]
    detail = analysed.get(f"/api/incidents/{incident_id}").json()
    assert detail["incident"]["incident_id"] == incident_id
    assert {f["finding_id"] for f in detail["findings"]} == set(
        detail["incident"]["finding_ids"])


def test_evidence_never_claims_confirmation(analysed):
    """PRD §12's wording rule. A detector says "possible"/"consistent with";
    only a human closes the loop."""
    banned = ("confirmed", "definitely", "proven", "guaranteed")
    for alert in analysed.get("/api/alerts").json():
        text = " ".join(alert["evidence"]).lower()
        assert not any(word in text for word in banned), alert["evidence"]


@pytest.mark.parametrize("path", [
    "/api/flows/F-9999", "/api/alerts/A-nope", "/api/incidents/INC-nope",
])
def test_unknown_ids_are_404(analysed, path):
    assert analysed.get(path).status_code == 404


def test_pathfinder_needs_both_endpoints(analysed):
    assert analysed.post("/api/pathfinder", json={"from": "10.0.0.5"}).status_code == 400
    missing = analysed.post("/api/pathfinder", json={"from": "1.1.1.1", "to": "2.2.2.2"})
    assert missing.status_code == 404


# ===========================================================================
# PRD conformance
# ===========================================================================

def test_every_prd_citation_points_at_a_real_section():
    """PRD §1.2 Principle E, applied to our own comments.

    A `§N` in a docstring is a claim that the PRD says something. Comments drift
    while section numbers get renumbered, and an invented citation reads exactly
    like a real one — so check them rather than trust them. Behaviour we added
    beyond the PRD carries no number at all, which is the honest alternative.
    """
    import re

    sections = set(re.findall(r"^#+ (\d+(?:\.\d+)?)\.? ",
                              (ROOT / "PRD.md").read_text(encoding="utf-8"), re.M))
    assert "26.2" in sections and "89" not in sections, "citation index looks wrong"

    invalid: list[str] = []
    for path in ROOT.rglob("*.py"):
        if {"node_modules", ".venv", "venv", "__pycache__"} & set(path.parts):
            continue
        for number, line in enumerate(
                path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            invalid += [f"{path.relative_to(ROOT)}:{number} §{cited}"
                        for cited in re.findall(r"§(\d+(?:\.\d+)?)", line)
                        if cited not in sections]
    assert not invalid, "citations to PRD sections that do not exist: " + "; ".join(invalid)
