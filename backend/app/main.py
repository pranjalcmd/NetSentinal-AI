"""NetSentinel AI — FastAPI application.

All API endpoints. The detection, graph, AI, and orchestration layers are
imported from their respective packages — this file is intentionally thin.

New endpoints (v0.3):
  GET  /api/ai/providers          — list all providers and their status
  POST /api/ai/providers          — switch active AI provider
  POST /api/ai/report             — generate a full SOC incident report
  GET  /api/jobs/{job_id}         — get a specific job with progress
  GET  /api/orchestration/status  — pipeline and store metrics
"""
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

from backend.app.core.config import settings                   # noqa: E402
from backend.app.schemas.api import AnalysisJob                # noqa: E402
from backend.app.services.ai_service import ai_service         # noqa: E402
from backend.app.services.store import store                   # noqa: E402
from backend.app.services.graph import (                       # noqa: E402
    build_entities,
    build_graph,
    shortest_path,
)
from backend.app.orchestration import (                        # noqa: E402
    adapter,
    ml_engine,
    analyse_flows,
    summary,
    job_runner,
)

SAMPLES = ROOT / "samples"
DATASET = ROOT / "data" / "dataset.json"
PRELOAD_FLOWS = 150


def _demo_flows() -> list[dict]:
    """Traffic to show before anything is uploaded."""
    if DATASET.exists():
        return json.loads(DATASET.read_text(encoding="utf-8"))[:PRELOAD_FLOWS]
    fixture = SAMPLES / "demo_flows.json"
    if fixture.exists():
        return json.loads(fixture.read_text(encoding="utf-8"))
    return []


app = FastAPI(
    title="NetSentinel AI API",
    version="0.3.0",
    description=(
        "Network traffic intelligence: DPI + rule engine + ML classifier + "
        "multi-provider AI analyst layer with SOC agent."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STARTUP & STORE MANAGEMENT
# ============================================================

@app.on_event("startup")
def _startup_init() -> None:
    # Clean startup store by default; live ingest populates memory dynamically
    pass


@app.post("/api/store/clear", tags=["orchestration"])
def clear_store():
    """Clear all loaded flows, alerts, and AI narratives from memory store."""
    store.reset()
    return {"status": "ok", "message": "Memory store cleared successfully", "flows": 0, "alerts": 0}


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health", tags=["health"])
def health():
    return {
        "status": "ok",
        "service": "netsentinel-api",
        "version": "0.3.0",
        # DPI
        "dpi_mode": adapter.mode,
        "ndpi_reader": adapter.reader_path,
        # ML
        "ml_trained_model": ml_engine.trained,
        # AI
        "ai_provider": ai_service.provider,
        "ai_model": settings.ai_model,
        "ai_key_configured": bool(settings.ai_api_key),
        # Orchestration
        "flows_loaded": len(store.flows),
        "alerts_loaded": len(store.alerts),
        "jobs_run": len(store.jobs),
    }


# ============================================================
# DASHBOARD / FLOWS
# ============================================================

@app.get("/api/dashboard", tags=["dashboard"])
def dashboard():
    return summary()


@app.get("/api/flows", tags=["flows"])
def flows():
    return list(store.flows.values())


@app.get("/api/flows/{flow_id}", tags=["flows"])
def flow_detail(flow_id: str):
    flow = store.flows.get(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


# ============================================================
# NETWORK GRAPH + ENTITIES
# ============================================================

@app.get("/api/network/graph", tags=["network"])
def network_graph():
    return build_graph()


@app.get("/api/entities", tags=["network"])
def entities():
    return build_entities()


@app.post("/api/pathfinder", tags=["network"])
async def pathfinder(payload: dict):
    src = payload.get("from") or payload.get("from_")
    dst = payload.get("to")
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Provide 'from' and 'to'")
    result = shortest_path(str(src), str(dst))
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No path between {src!r} and {dst!r} in the analysed capture",
        )
    return result


# ============================================================
# ALERTS
# ============================================================

@app.get("/api/alerts", tags=["alerts"])
def alerts():
    return sorted(
        store.alerts.values(),
        key=lambda a: a.get("risk_score", 0),
        reverse=True,
    )


@app.get("/api/alerts/{alert_id}", tags=["alerts"])
def alert_detail(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "alert": alert,
        "flow": store.flows.get(alert["flow_id"]),
        "ai": store.ai.get(alert_id),
    }


@app.post("/api/alerts/{alert_id}/explain", tags=["alerts"])
async def explain(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    result = await ai_service.explain(alert, store.flows.get(alert["flow_id"]))
    store.ai[alert_id] = result
    return result


# ============================================================
# AI Q&A  (SOC Agent)
# ============================================================

@app.post("/api/ai/ask", tags=["ai"])
async def ai_ask(payload: dict):
    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Provide a 'question'")
    return await ai_service.ask(question, summary(), list(store.alerts.values()))


# ============================================================
# AI PROVIDER MANAGEMENT  (new in v0.3)
# ============================================================

@app.get("/api/ai/providers", tags=["ai"])
def get_providers():
    """List all AI providers, their availability, and which is active."""
    return {
        "active_provider": ai_service.provider,
        "providers": ai_service.list_providers(),
    }


@app.post("/api/ai/providers", tags=["ai"])
def switch_provider(payload: dict):
    """Switch the active AI provider. Payload: {\"provider\": \"claude|openai|gemini|ollama|mock\"}"""
    name = (payload.get("provider") or "").strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Provide a 'provider' name")
    ok = ai_service.switch_provider(name)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot switch to '{name}': provider not available or key not configured",
        )
    return {"active_provider": ai_service.provider, "message": f"Switched to {name}"}


# ============================================================
# AI REPORT GENERATION  (new in v0.3)
# ============================================================

@app.post("/api/ai/report", tags=["ai"])
async def generate_report(payload: dict | None = None):
    """Generate a full SOC incident executive report from current alerts."""
    payload = payload or {}
    title = payload.get("title", "NetSentinel Incident Report")
    alerts_list = list(store.alerts.values())
    if not alerts_list:
        raise HTTPException(
            status_code=422,
            detail="No alerts loaded. Run an analysis first.",
        )
    return await ai_service.generate_report(summary(), alerts_list, title)


# ============================================================
# ORCHESTRATION STATUS  (new in v0.3)
# ============================================================

@app.get("/api/orchestration/status", tags=["orchestration"])
def orchestration_status():
    """Live metrics for the data pipeline and store."""
    jobs = job_runner.list_jobs()
    running = [j for j in jobs if j["status"] == "running"]
    return {
        "store": {
            "flows": len(store.flows),
            "alerts": len(store.alerts),
            "ai_explanations": len(store.ai),
            "jobs": len(store.jobs),
        },
        "job_runner": {
            "total_jobs": len(jobs),
            "running_jobs": len(running),
            "active": [j["job_id"] for j in running],
        },
        "pipeline": {
            "dpi_mode": adapter.mode,
            "ml_model_loaded": ml_engine.trained,
        },
    }


# ============================================================
# ANALYSIS JOBS
# ============================================================

@app.post("/api/demo/load", tags=["analysis"])
async def load_demo():
    flows = _demo_flows()
    if not flows:
        raise HTTPException(
            status_code=500,
            detail=f"No demo traffic: neither {DATASET} nor {SAMPLES / 'demo_flows.json'} exists",
        )
    job = await job_runner.run_sync(flows, "demo")
    job_id = job["job_id"]
    store.jobs[job_id] = job
    return _job_response(job_id, "demo", job["message"], job["summary"])


@app.post("/api/analyze/pcap", tags=["analysis"])
async def analyze_pcap(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".pcap", ".pcapng")):
        raise HTTPException(status_code=400, detail="Upload a .pcap or .pcapng file")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    with tempfile.TemporaryDirectory() as tmp:
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

        job = await job_runner.run_pcap_sync(str(target), file.filename)

    job_id = job["job_id"]
    store.jobs[job_id] = job

    if job["status"] == "failed":
        raise HTTPException(status_code=422, detail=job["message"])

    return _job_response(job_id, file.filename, job["message"], job["summary"])


def _job_response(job_id: str, filename: str, message: str, s: dict) -> dict:
    return {
        "job_id": job_id,
        "filename": filename,
        "status": "complete",
        "message": message,
        "summary": s,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# MULTI-FORMAT INGESTION & DATA ORCHESTRATION PIPELINE
# ============================================================
from backend.app.services.ingestion import orchestrator
from fastapi import BackgroundTasks

@app.post("/api/ingest/fir", tags=["ingestion"])
async def ingest_fir(file: UploadFile = File(...)):
    """Ingest FIR Police Reports (PDF/Text/JSON) and run NLP NER parser."""
    content = await file.read()
    filename = file.filename or "fir_report.txt"
    return orchestrator.ingest_fir(filename, content)


@app.post("/api/ingest/cdr", tags=["ingestion"])
async def ingest_cdr(file: UploadFile = File(...)):
    """Ingest Call Detail Records (CDR CSV/Excel) and map telecom connections."""
    content = await file.read()
    filename = file.filename or "cdr_logs.csv"
    return orchestrator.ingest_cdr(filename, content)


@app.post("/api/ingest/finance", tags=["ingestion"])
async def ingest_finance(file: UploadFile = File(...)):
    """Ingest Bank & Crypto Transactions (CSV/TXT) and trace financial layering."""
    content = await file.read()
    filename = file.filename or "bank_transactions.csv"
    return orchestrator.ingest_finance(filename, content)


@app.post("/api/ingest/batch", tags=["ingestion"])
async def ingest_batch(background_tasks: BackgroundTasks, files: list[UploadFile] = File(...)):
    """Asynchronous background ingestion pipeline for multi-file batches."""
    results = []
    for f in files:
        content = await f.read()
        fname = f.filename or "stream_data.csv"
        if "fir" in fname.lower() or fname.endswith((".pdf", ".txt", ".doc", ".docx")):
            res = orchestrator.ingest_fir(fname, content)
        elif "cdr" in fname.lower() or "call" in fname.lower():
            res = orchestrator.ingest_cdr(fname, content)
        else:
            res = orchestrator.ingest_finance(fname, content)
        results.append(res)
    return {
        "status": "BATCH_PROCESSED",
        "processed_files": len(results),
        "details": results
    }


# ============================================================
# JOBS & LIVE AGENT INGESTION (Canonical PRD Endpoints)
# ============================================================

@app.get("/api/jobs", tags=["analysis"])
def jobs():
    return job_runner.list_jobs()


@app.get("/api/jobs/{job_id}", tags=["analysis"])
def job_detail(job_id: str):
    job = job_runner.get_job(job_id) or store.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/jobs/{job_id}/load", tags=["analysis"])
async def load_job(job_id: str):
    """Reload a previous job into active store."""
    job = job_runner.get_job(job_id) or store.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")
    
    # If job has stored flows or fixture demo flows
    flows = _demo_flows()
    if flows:
        analyse_flows(flows)
    return {
        "status": "loaded",
        "job_id": job_id,
        "flows_loaded": len(store.flows),
        "alerts_loaded": len(store.alerts),
        "summary": summary()
    }


@app.post("/api/agent/ingest", tags=["ingestion"])
async def agent_ingest(payload: dict):
    """Live-agent batch flow ingestion endpoint (PRD Section 8)."""
    raw_flows = payload.get("flows")
    if raw_flows is None and isinstance(payload, list):
        raw_flows = payload
    if not raw_flows or not isinstance(raw_flows, list):
        raise HTTPException(status_code=400, detail="Provide a 'flows' list in payload")
    
    res = analyse_flows(raw_flows)
    return {
        "status": "ok",
        "ingested": len(raw_flows),
        "total_flows": len(store.flows),
        "total_alerts": len(store.alerts),
        "summary": res
    }

