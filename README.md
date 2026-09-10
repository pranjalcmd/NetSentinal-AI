# NetSentinel AI

AI-assisted network traffic intelligence platform for a hackathon.

## What it does

1. Accepts a `.pcap`/`.pcapng` capture.
2. Passes packet/flow data through an nDPI integration layer.
3. Normalizes protocol and flow metadata into a stable internal schema.
4. Runs transparent rule-based suspicious-behaviour detection.
5. Aggregates evidence into a risk score and severity.
6. Optionally sends only minimized structured telemetry to an AI API for explanation.
7. Serves the results through FastAPI to a SOC-style frontend.

## MVP boundary

This is an analyst-assistance and traffic-intelligence product, not a replacement for a commercial IDS/IPS. Detection is based on nDPI risk indicators plus explicit rules; AI explains and prioritizes evidence rather than being the sole detector.

## Team ownership

- Member 1: `dpi/` + nDPI adapter + packet/flow ingestion.
- Member 2: `detection/` + rules + scoring.
- Member 3: `backend/` + `ai/` + data orchestration.
- Member 4: `frontend/` + dashboard + demo flow.

## Quick start

### Backend

From the repository root:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The starter frontend currently uses mocked API data until the backend is connected.

## nDPI integration

The codebase deliberately keeps nDPI behind `dpi/ndpi_adapter.py`. This lets the team first stabilize the product using fixture flows and then wire in the local nDPI build without rewriting the backend or UI.

## Safety / privacy

Run captures only on traffic you are authorized to inspect. Do not send raw packet payloads, credentials, cookies, authorization headers, or other sensitive content to an external AI provider.
