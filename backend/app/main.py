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
    }


@app.post("/api/alerts/{alert_id}/explain")
async def explain(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    result = await ai_service.explain(alert, store.flows.get(alert["flow_id"]))
    store.ai[alert_id] = result
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
    s = analyse_flows(flows)
    return _job("demo", f"Demo traffic analysed ({len(flows)} flows)", s)


@app.post("/api/analyze/pcap", response_model=AnalysisJob)
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

        try:
            flows = adapter.analyze_pcap(str(target))
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Capture parse failed: {exc}") from exc

    if not flows:
        raise HTTPException(status_code=422, detail="No IPv4 TCP/UDP/ICMP flows found in capture")

    s = analyse_flows(flows)
    return _job(file.filename, f"Analysed {len(flows)} flows via {adapter.mode}", s)


def _job(filename: str, message: str, s: dict) -> dict:
    job = {
        "job_id": str(uuid4()),
        "filename": filename,
        "status": "complete",
        "message": message,
        "summary": s,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.jobs[job["job_id"]] = job
    return job


@app.get("/api/jobs")
def jobs():
    return list(store.jobs.values())
