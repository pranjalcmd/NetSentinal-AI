from pathlib import Path
import sys
import json
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.services.store import store
from app.services.analysis import analyse_fixture, summary
from app.services.ai_service import ai_service
from app.schemas.api import AnalysisJob


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

SAMPLES = ROOT / "samples"


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="NetSentinel AI API",
    version="0.1.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "netsentinel-api"
    }


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard():
    return summary()


# ============================================================
# FLOWS
# ============================================================

@app.get("/api/flows")
def flows():
    print(
        "DEBUG: number of flows in store =",
        len(store.flows)
    )

    print(
        "DEBUG: flow IDs =",
        list(store.flows.keys())
    )

    return list(store.flows.values())


# ============================================================
# NETWORK GRAPH
# ============================================================

@app.get("/api/network/graph")
def network_graph():
    nodes = {}
    links = []

    for flow in store.flows.values():

        # IMPORTANT:
        # The actual flow data uses source_ip
        # and destination_ip.
        source = flow.get("source_ip")
        target = flow.get("destination_ip")

        # ----------------------------------------------------
        # SOURCE NODE
        # ----------------------------------------------------

        if source and source not in nodes:
            nodes[source] = {
                "id": source,
                "label": source,
                "type": "ip",
                "risk": 0
            }

        # ----------------------------------------------------
        # TARGET NODE
        # ----------------------------------------------------

        if target and target not in nodes:
            nodes[target] = {
                "id": target,
                "label": target,
                "type": "ip",
                "risk": 0
            }

        # ----------------------------------------------------
        # CONNECTION
        # ----------------------------------------------------

        if source and target:
            links.append({
                "source": source,
                "target": target
            })

    return {
        "nodes": list(nodes.values()),
        "links": links
    }


# ============================================================
# ALERTS
# ============================================================

@app.get("/api/alerts")
def alerts():
    return list(store.alerts.values())


# ============================================================
# ALERT DETAIL
# ============================================================

@app.get("/api/alerts/{alert_id}")
def alert_detail(alert_id: str):

    alert = store.alerts.get(alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    return {
        "alert": alert,
        "flow": store.flows.get(alert["flow_id"])
    }


# ============================================================
# AI ALERT EXPLANATION
# ============================================================

@app.post("/api/alerts/{alert_id}/explain")
async def explain(alert_id: str):

    alert = store.alerts.get(alert_id)

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    flow = store.flows.get(
        alert["flow_id"]
    )

    result = await ai_service.explain(
        alert,
        flow
    )

    store.ai[alert_id] = result

    return result


# ============================================================
# LOAD DEMO DATA
# ============================================================

@app.post(
    "/api/demo/load",
    response_model=AnalysisJob
)
def load_demo():

    fixture = SAMPLES / "demo_flows.json"

    if not fixture.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Demo fixture missing at {fixture}"
        )

    flows = json.loads(
        fixture.read_text(
            encoding="utf-8"
        )
    )

    # Analyse the demo flows
    s = analyse_fixture(flows)

    # Create a job ID
    job_id = str(uuid4())

    # Create job record
    job = {
        "job_id": job_id,
        "filename": fixture.name,
        "status": "complete",
        "message": "Demo traffic analysed",
        "summary": s
    }

    # Store job
    store.jobs[job_id] = job

    return job


# ============================================================
# PCAP ANALYSIS
# ============================================================

@app.post(
    "/api/analyze/pcap",
    response_model=AnalysisJob
)
async def analyze_pcap(
    file: UploadFile = File(...)
):

    # Check filename
    if (
        not file.filename
        or not file.filename.lower().endswith(
            (".pcap", ".pcapng")
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="Upload a .pcap or .pcapng file"
        )

    # PCAP runtime integration is not connected yet.
    raise HTTPException(
        status_code=501,
        detail=(
            "PCAP runtime integration is pending. "
            "Use /api/demo/load while wiring nDPI."
        )
    )