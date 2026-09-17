"""Durable capture history — PRD §32, stdlib `sqlite3`.

Division of labour with `store.py`, which is the part worth understanding:

    MemoryStore   the *working set*: whatever capture is on screen right now.
                  Every read endpoint already goes through it, and it stays
                  exactly as it was.
    this module   the *record*: every analysed capture, surviving restart.

So nothing reads SQL on the hot path. A job is written once when it completes,
and read back only when someone asks for an old capture by id. That keeps the
diff to the two places a capture actually finishes, instead of rewriting every
endpoint into a query.

Two deliberate deviations from the §32 schema, both forced by real data:

* `alerts.job_id` — §32 omits it, but `flow_id` is `F-0001` *per capture*
  (`dpi/pcap_flows.py`), so `alert_id` is `A-F-0001` in every capture too.
  Without the job in the key the second upload overwrites the first. The
  primary keys here are composite for that reason.
* `raw_json` — §32's columns are the queryable ones, not the whole object. An
  alert also carries confidence factors, alternative explanations, ML output
  and finding ids. Storing the dict verbatim alongside the columns means a
  restored capture is byte-identical to a live one, so `load_job()` needs no
  mapping layer and no endpoint knows the difference.

No ORM on purpose: five flat tables, three inserts and two selects. sqlalchemy
is installed, and would be the right call the moment relationships or
migrations appear. Neither has.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from backend.app.core.config import settings

# Bump when a CREATE TABLE below changes. `CREATE TABLE IF NOT EXISTS` will not
# add a column to an existing file, so without this check a schema change reads
# as random KeyErrors months later instead of one clear message on boot.
SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS analysis_jobs (
    job_id      TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    status      TEXT NOT NULL,
    message     TEXT,
    total_flows INTEGER NOT NULL DEFAULT 0,
    alert_count INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT
);

CREATE TABLE IF NOT EXISTS flows (
    job_id           TEXT NOT NULL REFERENCES analysis_jobs(job_id) ON DELETE CASCADE,
    flow_id          TEXT NOT NULL,
    timestamp        TEXT,
    source_ip        TEXT,
    destination_ip   TEXT,
    source_port      INTEGER,
    destination_port INTEGER,
    transport        TEXT,
    application      TEXT,
    packets          INTEGER,
    bytes            INTEGER,
    duration_seconds REAL,
    metadata_json    TEXT,
    raw_json         TEXT NOT NULL,
    PRIMARY KEY (job_id, flow_id)
);

CREATE TABLE IF NOT EXISTS alerts (
    job_id        TEXT NOT NULL REFERENCES analysis_jobs(job_id) ON DELETE CASCADE,
    alert_id      TEXT NOT NULL,
    flow_id       TEXT,
    severity      TEXT,
    risk_score    INTEGER,
    title         TEXT,
    rules_json    TEXT,
    evidence_json TEXT,
    status        TEXT,
    created_at    TEXT,
    raw_json      TEXT NOT NULL,
    PRIMARY KEY (job_id, alert_id)
);

CREATE TABLE IF NOT EXISTS findings (
    job_id     TEXT NOT NULL REFERENCES analysis_jobs(job_id) ON DELETE CASCADE,
    finding_id TEXT NOT NULL,
    severity   TEXT,
    risk       INTEGER,
    raw_json   TEXT NOT NULL,
    PRIMARY KEY (job_id, finding_id)
);

CREATE TABLE IF NOT EXISTS incidents (
    job_id      TEXT NOT NULL REFERENCES analysis_jobs(job_id) ON DELETE CASCADE,
    incident_id TEXT NOT NULL,
    severity    TEXT,
    risk        INTEGER,
    raw_json    TEXT NOT NULL,
    PRIMARY KEY (job_id, incident_id)
);

CREATE TABLE IF NOT EXISTS ai_analysis (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id               TEXT,
    alert_id             TEXT NOT NULL,
    provider             TEXT,
    model                TEXT,
    confidence           REAL,
    threat_category      TEXT,
    summary              TEXT,
    recommendations_json TEXT,
    caveats_json         TEXT,
    created_at           TEXT NOT NULL,
    raw_json             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_flows_job      ON flows(job_id);
CREATE INDEX IF NOT EXISTS ix_alerts_job     ON alerts(job_id);
CREATE INDEX IF NOT EXISTS ix_alerts_sev     ON alerts(severity);
CREATE INDEX IF NOT EXISTS ix_findings_job   ON findings(job_id);
CREATE INDEX IF NOT EXISTS ix_incidents_job  ON incidents(job_id);
CREATE INDEX IF NOT EXISTS ix_ai_alert       ON ai_analysis(alert_id);
"""


def _j(value: Any) -> str:
    """JSON for a column. `default=str` so a datetime can never crash a write."""
    return json.dumps(value, default=str)


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """One connection per call, committed as one transaction.

    Per-call rather than a shared handle because FastAPI runs sync endpoints in
    a threadpool, and a sqlite3 connection belongs to the thread that made it.
    Opening a local file is microseconds; `check_same_thread=False` plus a
    shared lock would be more code and more ways to be wrong.
    """
    path = Path(settings.database_path)
    if path.parent and not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")    # readers don't block on a write
        conn.execute("PRAGMA foreign_keys=ON")     # per-connection in sqlite, so: here
        conn.execute("PRAGMA synchronous=NORMAL")
        with conn:                                 # commit on success, rollback on raise
            yield conn
    finally:
        conn.close()


def init() -> None:
    """Create the schema if it isn't there. Safe to call on every boot."""
    with connect() as conn:
        found = conn.execute("PRAGMA user_version").fetchone()[0]
        if found and found != SCHEMA_VERSION:
            raise RuntimeError(
                f"{settings.database_path} is schema v{found}, this build expects "
                f"v{SCHEMA_VERSION}. Delete the file to rebuild it (analysis "
                f"history will be lost) or migrate it.")
        conn.executescript(SCHEMA)
        conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")


def save_job(job: dict, memory) -> None:
    """Persist a completed job and the capture that produced it.

    `memory` is the MemoryStore holding the just-analysed capture. Passed in
    rather than imported so this module keeps no global state and the
    self-check below can hand it any object with the same five attributes.
    """
    job_id = job["job_id"]
    summary = job.get("summary") or {}
    flows = list(memory.flows.values())
    alerts = list(memory.alerts.values())

    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO analysis_jobs VALUES (?,?,?,?,?,?,?,?)",
            (job_id, job.get("filename", ""), job.get("created_at", ""),
             job.get("status", "complete"), job.get("message", ""),
             summary.get("total_flows", len(flows)),
             summary.get("suspicious_flows", len(alerts)), _j(summary)))

        conn.executemany(
            "INSERT OR REPLACE INTO flows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [(job_id, f["flow_id"], str(f.get("timestamp", "")), f.get("source_ip"),
              f.get("destination_ip"), f.get("source_port"), f.get("destination_port"),
              f.get("transport"), f.get("application"), f.get("packets"), f.get("bytes"),
              f.get("duration_seconds"), _j(f.get("metadata", {})), _j(f))
             for f in flows])

        conn.executemany(
            "INSERT OR REPLACE INTO alerts VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [(job_id, a["alert_id"], a.get("flow_id"), a.get("severity"),
              a.get("risk_score"), a.get("title"), _j(a.get("rule_ids", [])),
              _j(a.get("evidence", [])), a.get("status", "Open"),
              str(a.get("created_at", "")), _j(a))
             for a in alerts])

        conn.executemany(
            "INSERT OR REPLACE INTO findings VALUES (?,?,?,?,?)",
            [(job_id, f["finding_id"], f.get("severity"), f.get("risk"), _j(f))
             for f in memory.findings.values()])

        conn.executemany(
            "INSERT OR REPLACE INTO incidents VALUES (?,?,?,?,?)",
            [(job_id, i["incident_id"], i.get("severity"), i.get("risk"), _j(i))
             for i in memory.incidents.values()])

        # Keep the newest N captures. A 150-flow demo capture is ~1 MB of rows,
        # so an unbounded table is a slow disk leak on a long-running service.
        # ponytail: count-based, not age-based — swap the predicate for
        # `created_at < date('now','-30 days')` if retention ever needs a policy.
        conn.execute(
            "DELETE FROM analysis_jobs WHERE job_id NOT IN "
            "(SELECT job_id FROM analysis_jobs ORDER BY created_at DESC LIMIT ?)",
            (settings.max_stored_jobs,))


def save_ai(alert_id: str, result: dict, job_id: str | None = None) -> None:
    """Record one AI explanation (PRD §32 `ai_analysis`).

    Append-only: re-explaining an alert keeps both rows, because which provider
    said what, and when, is the point of storing it at all.
    """
    from datetime import datetime, timezone
    with connect() as conn:
        conn.execute(
            "INSERT INTO ai_analysis (job_id, alert_id, provider, model, confidence,"
            " threat_category, summary, recommendations_json, caveats_json, created_at,"
            " raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (job_id, alert_id, result.get("provider"), result.get("model"),
             result.get("confidence"), result.get("threat_category"),
             result.get("summary"), _j(result.get("recommendations", [])),
             _j(result.get("caveats", [])), datetime.now(timezone.utc).isoformat(),
             _j(result)))


def list_jobs() -> list[dict]:
    """Job history, newest first — what `/api/jobs` serves."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM analysis_jobs ORDER BY created_at DESC").fetchall()
    return [{"job_id": r["job_id"], "filename": r["filename"], "status": r["status"],
             "message": r["message"], "created_at": r["created_at"],
             "summary": json.loads(r["summary_json"] or "{}")} for r in rows]


def load_job(job_id: str, memory) -> bool:
    """Restore a stored capture into the working set. False if unknown.

    `raw_json` is the dict the store held at analysis time, so after this every
    existing endpoint — alerts, findings, graph, pathfinder — serves the old
    capture with no special case anywhere.
    """
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM analysis_jobs WHERE job_id=?",
                            (job_id,)).fetchone():
            return False
        tables = {name: conn.execute(
                      f"SELECT raw_json FROM {name} WHERE job_id=?", (job_id,)).fetchall()
                  for name in ("flows", "alerts", "findings", "incidents")}
        # Latest explanation per alert — re-explaining keeps every row, but the
        # store holds one, and `ORDER BY id` means the last write wins below.
        ai_rows = conn.execute(
            "SELECT alert_id, raw_json FROM ai_analysis WHERE job_id=? ORDER BY id",
            (job_id,)).fetchall()

    loaded = {name: [json.loads(r["raw_json"]) for r in rows]
              for name, rows in tables.items()}

    memory.reset()          # takes and releases the lock, so the fill below is safe
    with memory.lock:
        memory.flows.update({f["flow_id"]: f for f in loaded["flows"]})
        memory.alerts.update({a["alert_id"]: a for a in loaded["alerts"]})
        memory.findings.update({f["finding_id"]: f for f in loaded["findings"]})
        memory.incidents.update({i["incident_id"]: i for i in loaded["incidents"]})
        for row in ai_rows:
            memory.ai[row["alert_id"]] = json.loads(row["raw_json"])
    return True


def _has_raw(conn: sqlite3.Connection) -> bool:
    """ai_analysis stores §32's columns, not the whole response — so there is
    nothing to rehydrate an explanation from. Kept as a hook rather than a lie."""
    return False


if __name__ == "__main__":
    # Round-trip against a throwaway file: a capture written and read back must
    # come out identical, and two captures must not overwrite each other despite
    # sharing flow ids. That collision is the whole reason for the composite key.
    import tempfile
    from dataclasses import dataclass, field
    from threading import Lock

    @dataclass
    class FakeStore:
        flows: dict = field(default_factory=dict)
        alerts: dict = field(default_factory=dict)
        findings: dict = field(default_factory=dict)
        incidents: dict = field(default_factory=dict)
        ai: dict = field(default_factory=dict)
        jobs: dict = field(default_factory=dict)
        lock: Lock = field(default_factory=Lock)

        def reset(self):
            with self.lock:
                self.flows.clear(); self.alerts.clear(); self.ai.clear()
                self.findings.clear(); self.incidents.clear()

    def capture(tag: str) -> FakeStore:
        """Both captures use flow F-0001 on purpose — that is the collision."""
        s = FakeStore()
        s.flows["F-0001"] = {"flow_id": "F-0001", "source_ip": f"10.0.0.{tag}",
                             "application": "DNS", "packets": 4, "bytes": 900,
                             "metadata": {"l7_app": "DNS"}, "ml_detection": {"x": 1}}
        s.alerts["A-F-0001"] = {"alert_id": "A-F-0001", "flow_id": "F-0001",
                                "severity": "HIGH", "risk_score": 70,
                                "title": f"capture {tag}", "rule_ids": ["R1"],
                                "evidence": ["e"], "status": "Open",
                                "created_at": "2026-01-01T00:00:00Z",
                                "alternative_explanations": ["maybe benign"]}
        s.findings["FND-1"] = {"finding_id": "FND-1", "severity": "HIGH", "risk": 70}
        s.incidents["INC-1"] = {"incident_id": "INC-1", "severity": "HIGH", "risk": 70}
        return s

    with tempfile.TemporaryDirectory() as tmp:
        settings.database_path = str(Path(tmp) / "t.db")
        init()
        init()   # idempotent

        first, second = capture("1"), capture("2")
        save_job({"job_id": "J1", "filename": "a.pcap", "status": "complete",
                  "message": "m", "created_at": "2026-01-01T00:00:00Z",
                  "summary": {"total_flows": 1, "suspicious_flows": 1}}, first)
        save_job({"job_id": "J2", "filename": "b.pcap", "status": "complete",
                  "message": "m", "created_at": "2026-01-02T00:00:00Z",
                  "summary": {"total_flows": 1, "suspicious_flows": 1}}, second)

        jobs = list_jobs()
        assert [j["job_id"] for j in jobs] == ["J2", "J1"], jobs   # newest first
        assert jobs[0]["summary"]["total_flows"] == 1

        # The collision: same flow_id, same alert_id, two captures, no overwrite.
        back = FakeStore()
        assert load_job("J1", back)
        assert back.flows["F-0001"]["source_ip"] == "10.0.0.1"
        assert back.alerts["A-F-0001"]["title"] == "capture 1"
        assert load_job("J2", back)
        assert back.flows["F-0001"]["source_ip"] == "10.0.0.2"
        assert back.alerts["A-F-0001"]["title"] == "capture 2"

        # Restored objects are the originals, not a §32-column subset.
        assert back.flows["F-0001"]["ml_detection"] == {"x": 1}
        assert back.alerts["A-F-0001"]["alternative_explanations"] == ["maybe benign"]
        assert back.findings["FND-1"]["risk"] == 70 and back.incidents["INC-1"]
        assert load_job("nope", back) is False

        save_ai("A-F-0001", {"provider": "mock", "confidence": 0.5,
                             "threat_category": "DNS_TUNNELING", "summary": "s",
                             "recommendations": ["r"], "caveats": ["c"]}, job_id="J1")
        with connect() as c:
            rows = c.execute("SELECT * FROM ai_analysis").fetchall()
        assert len(rows) == 1 and rows[0]["threat_category"] == "DNS_TUNNELING"
        assert json.loads(rows[0]["recommendations_json"]) == ["r"]

        # Re-explaining appends, and the restored store carries the newest one.
        save_ai("A-F-0001", {"provider": "gemini", "summary": "newer"}, job_id="J1")
        assert load_job("J1", back)
        assert back.ai["A-F-0001"]["provider"] == "gemini", back.ai
        with connect() as c:
            assert c.execute("SELECT COUNT(*) FROM ai_analysis").fetchone()[0] == 2

        # A deleted job takes its capture with it (FK ON + CASCADE).
        with connect() as c:
            c.execute("DELETE FROM analysis_jobs WHERE job_id='J1'")
            assert c.execute("SELECT COUNT(*) FROM flows WHERE job_id='J1'"
                             ).fetchone()[0] == 0

        # Retention drops the oldest and cascades, rather than growing forever.
        settings.max_stored_jobs = 3
        for n in range(5):
            save_job({"job_id": f"K{n}", "filename": "f.pcap", "status": "complete",
                      "message": "m", "created_at": f"2026-02-0{n + 1}T00:00:00Z",
                      "summary": {}}, capture("9"))
        kept = [j["job_id"] for j in list_jobs()]
        assert kept == ["K4", "K3", "K2"], kept
        with connect() as c:
            assert c.execute("SELECT COUNT(*) FROM flows WHERE job_id='K0'"
                             ).fetchone()[0] == 0

    print("db self-check ok")
