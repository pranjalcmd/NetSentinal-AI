from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import json
import shutil
import sys
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.core.config import settings            # noqa: E402
from backend.app.schemas.api import AnalysisJob          # noqa: E402
from backend.app.services import db                      # noqa: E402
from backend.app.services.ai_service import ai_service   # noqa: E402
from backend.app.services.analysis import (              # noqa: E402
    adapter,
    analyse_flows,
    ml_engine,
    summary,
)
from backend.app.services.graph import (                 # noqa: E402
    build_entities,
    build_graph,
    shortest_path,
)
from backend.app.services.store import store             # noqa: E402

SAMPLES = ROOT / "samples"
DATASET = ROOT / "data" / "dataset.json"
PRELOAD_FLOWS = 150


def _demo_flows() -> list[dict]:
    """Traffic to show before anything is uploaded.

    Prefers the generated dataset (real variety, a graph worth looking at) and
    falls back to the 5-flow fixture that ships with the repo.
    """
    if DATASET.exists():
        return json.loads(DATASET.read_text(encoding="utf-8"))[:PRELOAD_FLOWS]
    fixture = SAMPLES / "demo_flows.json"
    if fixture.exists():
        return json.loads(fixture.read_text(encoding="utf-8"))
    return []

app = FastAPI(title="NetSentinel AI API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    # The ByteGuard vite dev server picks 3000 or 5173 depending on the port.
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STARTUP — load the demo fixture so the UI is live immediately
# ============================================================

@app.on_event("startup")
def _preload_demo() -> None:
    db.init()
    flows = _demo_flows()
    if flows:
        analyse_flows(flows)


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "netsentinel-api",
        "dpi_mode": adapter.mode,
        "ndpi_reader": adapter.reader_path,
        "ml_trained_model": ml_engine.trained,
        "ai_provider": ai_service.provider,
        "ai_model": settings.ai_model,
        "ai_key_configured": bool(settings.ai_api_key),
        # Why the last live call fell back to mock, if it did. Without this a
        # wrong model name or a rejected key looks identical to "no key set".
        "ai_last_error": ai_service.last_error,
        "flows_loaded": len(store.flows),
    }


# ============================================================
# DASHBOARD / FLOWS
# ============================================================

@app.get("/api/dashboard")
def dashboard():
    return summary()


@app.get("/api/flows")
def flows():
    return list(store.flows.values())


@app.get("/api/flows/{flow_id}")
def flow_detail(flow_id: str):
    flow = store.flows.get(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


# ============================================================
# NETWORK GRAPH + ENTITIES  (consumed by the ByteGuard frontend)
# ============================================================

@app.get("/api/network/graph")
def network_graph():
    return build_graph()


@app.get("/api/entities")
def entities():
    return build_entities()


@app.post("/api/pathfinder")
async def pathfinder(payload: dict):
    src = payload.get("from") or payload.get("from_")
    dst = payload.get("to")
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Provide 'from' and 'to'")

    result = shortest_path(str(src), str(dst))
    if result is None:
        # The frontend falls back to its bundled demo path on a non-2xx and
        # flips its badge to "Demo data" — which is the honest signal here.
        raise HTTPException(
            status_code=404,
            detail=f"No path between {src!r} and {dst!r} in the analysed capture",
        )
    return result


# ============================================================
# ALERTS
# ============================================================

@app.get("/api/alerts")
def alerts():
    return sorted(
        store.alerts.values(),
        key=lambda a: a.get("risk_score", 0),
        reverse=True,
    )


@app.get("/api/alerts/{alert_id}")
def alert_detail(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "alert": alert,
        "flow": store.flows.get(alert["flow_id"]),
        "ai": store.ai.get(alert_id),
        # The alert is a view; these are the detection record behind it.
        "findings": [store.findings[f] for f in alert.get("finding_ids", [])
                     if f in store.findings],
        "incident": store.incidents.get(alert.get("incident_id")),
    }


# ============================================================
# FINDINGS / INCIDENTS — the detection record the alerts summarise
# ============================================================

@app.get("/api/findings")
def findings():
    return sorted(store.findings.values(), key=lambda f: f.get("risk", 0), reverse=True)


@app.get("/api/incidents")
def incidents():
    return sorted(store.incidents.values(), key=lambda i: i.get("risk", 0), reverse=True)


@app.get("/api/incidents/{incident_id}")
def incident_detail(incident_id: str):
    incident = store.incidents.get(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {
        "incident": incident,
        "findings": [store.findings[f] for f in incident.get("finding_ids", [])
                     if f in store.findings],
    }


@app.post("/api/alerts/{alert_id}/explain")
async def explain(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    result = await ai_service.explain(alert, store.flows.get(alert["flow_id"]))
    store.ai[alert_id] = result
    db.save_ai(alert_id, result, job_id=store.current_job_id)
    return result


# ============================================================
# AI Q&A  (ByteGuard "AI Investigation" tab)
# ============================================================

@app.post("/api/ai/ask")
async def ai_ask(payload: dict):
    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Provide a 'question'")
    return await ai_service.ask(question, summary(), list(store.alerts.values()))


@app.post("/api/ai/report")
async def ai_report():
    """One AI pass over the whole capture, not a single alert (PRD §16/§45).

    Incidents lead: an incident is already the grouped story of one host, which
    is what an analyst triages. Alerts come along as the supporting detail.
    """
    if not store.flows:
        raise HTTPException(status_code=409, detail="Analyse a capture first")
    return await ai_service.report(summary(), list(store.alerts.values()),
                                   list(store.incidents.values()))


# ============================================================
# ANALYSIS JOBS
# ============================================================

@app.post("/api/demo/load", response_model=AnalysisJob)
def load_demo():
    flows = _demo_flows()
    if not flows:
        raise HTTPException(
            status_code=500,
            detail=f"No demo traffic: neither {DATASET} nor {SAMPLES / 'demo_flows.json'} exists",
        )
    s = analyse_flows(flows, capture_id="demo")
    return _job("demo", f"Demo traffic analysed ({len(flows)} flows)", s)


@app.post("/api/analyze/pcap", response_model=AnalysisJob)
async def analyze_pcap(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".pcap", ".pcapng")):
        raise HTTPException(status_code=400, detail="Upload a .pcap or .pcapng file")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    with tempfile.TemporaryDirectory() as tmp:
        # Only the basename, and only inside a private temp dir — an uploaded
        # path component must never escape it (PRD §47 uploads).
        target = Path(tmp) / Path(file.filename).name
        written = 0
        with target.open("wb") as sink:
            while chunk := await file.read(1 << 20):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds MAX_UPLOAD_MB={settings.max_upload_mb}",
                    )
                sink.write(chunk)

        try:
            flows, capture = adapter.analyze_capture(str(target))
        except Exception as exc:
            # PRD §30 invalid-PCAP wording; the reader's reason follows it.
            raise HTTPException(
                status_code=422,
                detail=f"This file could not be processed as a supported network capture: {exc}",
            ) from exc

    if not flows:
        raise HTTPException(
            status_code=422,
            detail="Capture contains no analyzable flows." + _coverage_hint(capture),
        )

    capture_id = f"CAP-{uuid4().hex[:8]}"
    s = analyse_flows(flows, capture_id=capture_id)
    s["capture"] = {**capture, "capture_id": capture_id, "dpi_mode": adapter.mode}
    # A clean capture is a result, not a blank screen — §30 gives it its own
    # wording, and it must not read like the analysis failed.
    headline = ("No suspicious behaviour was flagged in this capture."
                if not s["suspicious_flows"]
                else f"Analysed {len(flows)} flows via {adapter.mode}")
    return _job(file.filename, headline + _coverage_hint(capture), s)


def _coverage_hint(capture: dict) -> str:
    """Say so when the reader understood only part of the capture (PRD §1.2 E)."""
    coverage = capture.get("coverage")
    if coverage is None or coverage >= 0.99:
        return ""
    reasons = ", ".join(sorted(capture.get("packets_skipped") or {})) or "unreadable packets"
    return (f" — {coverage:.0%} of {capture.get('packets_read', 0)} packets were read"
            f" ({reasons}); findings cover that portion only")


def _job(filename: str, message: str, s: dict) -> dict:
    job = {
        "job_id": str(uuid4()),
        # Basename only — the same rule the upload path applies to the temp
        # file (§47). It matters more here now that job history is durable and
        # rendered by the UI: an unsanitized name used to die with the process.
        "filename": Path(filename).name or "capture",
        "status": "complete",
        "message": message,
        "summary": s,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.jobs[job["job_id"]] = job
    store.current_job_id = job["job_id"]
    # Every capture finishes here, so this is the only place persistence needs
    # to hook in. A failed write must not fail the analysis the user just ran —
    # the result is already in the store and on its way to the response.
    try:
        db.save_job(job, store)
    except Exception as exc:  # noqa: BLE001
        print(f"[db] could not persist job {job['job_id']}: {exc}")
    return job


@app.get("/api/jobs")
def jobs():
    """Job history, newest first — from the database, so it survives a restart.

    Falls back to this process's in-memory jobs if the database is unreadable,
    because a broken history file should not empty a running UI.
    """
    try:
        return db.list_jobs()
    except Exception as exc:  # noqa: BLE001
        print(f"[db] history unavailable, serving this process only: {exc}")
        return sorted(store.jobs.values(), key=lambda j: j["created_at"], reverse=True)


@app.post("/api/jobs/{job_id}/load")
def load_job(job_id: str):
    """Reopen a stored capture. Every other endpoint then serves it unchanged."""
    if not db.load_job(job_id, store):
        raise HTTPException(status_code=404, detail=f"No stored capture {job_id!r}")
    store.current_job_id = job_id
    return {"job_id": job_id, "loaded": True, "summary": summary()}
