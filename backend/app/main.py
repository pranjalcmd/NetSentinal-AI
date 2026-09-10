from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.app.services.store import store
from backend.app.services.analysis import analyse_fixture, summary
from backend.app.services.ai_service import ai_service
from backend.app.schemas.api import AnalysisJob
from datetime import datetime, timezone
import json

app = FastAPI(title="NetSentinel AI API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

ROOT = Path(__file__).resolve().parents[3]
SAMPLES = ROOT / "samples"

@app.get("/api/health")
def health(): return {"status": "ok", "service": "netsentinel-api"}

@app.get("/api/dashboard")
def dashboard(): return summary()

@app.get("/api/flows")
def flows(): return list(store.flows.values())

@app.get("/api/alerts")
def alerts(): return list(store.alerts.values())

@app.get("/api/alerts/{alert_id}")
def alert_detail(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert: raise HTTPException(404, "Alert not found")
    return {"alert": alert, "flow": store.flows.get(alert["flow_id"])}

@app.post("/api/alerts/{alert_id}/explain")
async def explain(alert_id: str):
    alert = store.alerts.get(alert_id)
    if not alert: raise HTTPException(404, "Alert not found")
    flow = store.flows.get(alert["flow_id"])
    result = await ai_service.explain(alert, flow)
    store.ai[alert_id] = result
    return result

@app.post("/api/demo/load", response_model=AnalysisJob)
def load_demo():
    fixture = SAMPLES / "demo_flows.json"
    if not fixture.exists(): raise HTTPException(500, "Demo fixture missing")
    flows = json.loads(fixture.read_text(encoding="utf-8"))
    s = analyse_fixture(flows)
    job_id = str(uuid4())
    job = {"job_id": job_id, "filename": fixture.name, "status": "complete", "message": "Demo traffic analysed", "summary": s}
    store.jobs[job_id] = job
    return job

@app.post("/api/analyze/pcap", response_model=AnalysisJob)
async def analyze_pcap(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".pcap", ".pcapng")):
        raise HTTPException(400, "Upload a .pcap or .pcapng file")
    # This starter does not execute the external nDPI binary. Persisting uploads
    # and wiring the adapter is intentionally kept as a separate integration step.
    raise HTTPException(501, "PCAP runtime integration is pending. Use /api/demo/load while wiring nDPI.")
