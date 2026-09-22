"""Persistence — PRD §32, through the real API.

The store is the working set and SQLite is the record, so the thing worth
testing is the seam between them: a capture analysed through HTTP must come
back after the store is wiped, unchanged and complete.

Two bugs these exist to catch, both found by writing them:

* `flow_id` is `F-0001` in *every* capture (`dpi/pcap_flows.py` numbers per
  file), so a job-less primary key silently overwrites the previous upload.
* §32 lists the queryable columns only. Restoring from those alone would drop
  ML output, confidence factors and alternative explanations — the alert would
  survive but the drilldown behind it would not.

The database is redirected to a temp file by `conftest.py`, so this never
touches the real `./netsentinel.db`.

Run: python -m pytest tests/test_persistence.py -q
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from backend.app.services import db
from backend.app.services.store import store
from test_api import attack_capture
from test_capture import BASE_TIME, dns_query, eth, ipv4, pcap_bytes, udp


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def capture(host: str) -> bytes:
    """A small DNS capture. `host` is what tells two captures apart later."""
    frames = [eth(ipv4(udp(dns_query(f"lookup{n}.example.com")),
                       src=host, dst="10.0.0.53"))
              for n in range(4)]
    return pcap_bytes(frames, times=[BASE_TIME + n for n in range(len(frames))])


def upload(client, data: bytes, name: str = "cap.pcap"):
    return client.post("/api/analyze/pcap",
                       files={"file": (name, data, "application/vnd.tcpdump.pcap")})


def test_an_analysed_capture_survives_the_store_being_wiped(client):
    """The point of the database: a restart must not lose the analysis."""
    job = upload(client, capture("10.0.0.7")).json()
    flows_before = client.get("/api/flows").json()
    assert flows_before

    store.reset()                                   # simulate the process restarting
    assert client.get("/api/flows").json() == []

    assert client.post(f"/api/jobs/{job['job_id']}/load").status_code == 200
    assert client.get("/api/flows").json() == flows_before


def test_two_captures_sharing_flow_ids_do_not_overwrite_each_other(client):
    """`F-0001` exists in every capture — the job id is what separates them."""
    first = upload(client, capture("10.0.0.11")).json()["job_id"]
    second = upload(client, capture("10.0.0.22")).json()["job_id"]
    assert first != second

    client.post(f"/api/jobs/{first}/load")
    assert {f["source_ip"] for f in client.get("/api/flows").json()} == {"10.0.0.11"}

    client.post(f"/api/jobs/{second}/load")
    assert {f["source_ip"] for f in client.get("/api/flows").json()} == {"10.0.0.22"}


def test_a_restored_capture_keeps_the_fields_section_32_does_not_list(client):
    """§32's columns are for querying; the drilldown needs the whole object."""
    job = upload(client, capture("10.0.0.33")).json()["job_id"]
    before = client.get("/api/flows").json()[0]
    assert "ml_detection" in before, "precondition: the pipeline attaches ML output"

    store.reset()
    client.post(f"/api/jobs/{job}/load")
    after = client.get("/api/flows").json()[0]
    assert after == before
    assert after["ml_detection"] == before["ml_detection"]


def test_job_history_is_served_from_the_database_newest_first(client):
    upload(client, capture("10.0.0.44"))
    history = client.get("/api/jobs").json()
    assert len(history) >= 2
    assert [j["created_at"] for j in history] == sorted(
        (j["created_at"] for j in history), reverse=True)
    assert {"job_id", "filename", "status", "summary"} <= set(history[0])


def test_loading_an_unknown_job_is_a_404(client):
    assert client.post("/api/jobs/not-a-job/load").status_code == 404


def test_an_uploaded_filename_is_stored_as_a_basename(client):
    """§47: the traversal string must not reach durable storage or the UI."""
    upload(client, capture("10.0.0.55"), name="../../pwned.pcap")
    names = [j["filename"] for j in client.get("/api/jobs").json()]
    assert "pwned.pcap" in names
    assert not any("/" in n or "\\" in n or ".." in n for n in names), names


def test_retention_keeps_the_newest_captures_and_drops_the_rest(client):
    """Unbounded history is a disk leak on a service that runs for months."""
    original = settings.max_stored_jobs
    settings.max_stored_jobs = 2
    try:
        newest = [upload(client, capture(f"10.0.1.{n}")).json()["job_id"]
                  for n in range(3)][-2:]
        assert [j["job_id"] for j in client.get("/api/jobs").json()] == newest[::-1]
    finally:
        settings.max_stored_jobs = original


def test_an_ai_explanation_is_recorded_against_its_capture(client):
    """§32 `ai_analysis`: which provider said what, and when.

    Uses the attack capture, not the benign one — a capture with no alerts has
    nothing to explain, and a skipped test proves nothing.
    """
    upload(client, attack_capture())
    alerts = client.get("/api/alerts").json()
    assert alerts, "precondition: the attack capture must raise alerts"

    alert_id = alerts[0]["alert_id"]
    result = client.post(f"/api/alerts/{alert_id}/explain").json()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM ai_analysis WHERE alert_id=?"
                           " ORDER BY id DESC LIMIT 1", (alert_id,)).fetchone()
    assert row is not None, "the explanation was not persisted"
    assert row["provider"] == result["provider"]
    assert row["job_id"] == store.current_job_id


def test_a_database_failure_does_not_fail_the_analysis(client, monkeypatch):
    """The analysis is already done and in the store — a write error must not
    turn a successful capture into a 500 for the user."""
    def boom(*args, **kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(db, "save_job", boom)
    response = upload(client, capture("10.0.0.77"))
    assert response.status_code == 200
    assert response.json()["summary"]["total_flows"] > 0
