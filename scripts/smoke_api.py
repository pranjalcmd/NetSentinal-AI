"""Hit every endpoint the frontend (and the docs) reference, in-process.

    python scripts/smoke_api.py

Uses FastAPI's TestClient, so no server, no ports, no network. Exits non-zero
if any endpoint returns an unexpected status or drops a field the ByteGuard
frontend reads. That last part is the important one: the frontend must not be
changed, so the backend is what has to match.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.main import app  # noqa: E402

FAILURES: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if condition else 'FAIL'} {name}{'  ' + detail if detail else ''}")
    if not condition:
        FAILURES.append(f"{name} {detail}")


def main() -> None:
    with TestClient(app) as client:
        print("GET /api/health")
        health = client.get("/api/health")
        check("200", health.status_code == 200)
        body = health.json()
        print(f"       {json.dumps(body)}")
        check("flows preloaded", body["flows_loaded"] > 0, f"{body['flows_loaded']} flows")

        print("GET /api/dashboard")
        dash = client.get("/api/dashboard").json()
        check("summary fields", {"total_flows", "suspicious_flows", "high_risk", "protocols",
                                 "risk_distribution", "protocol_distribution",
                                 "recent_alerts"} <= set(dash))
        print(f"       {dash['total_flows']} flows, {dash['suspicious_flows']} suspicious, "
              f"{dash['high_risk']} high risk, {dash['protocols']} protocols")

        print("GET /api/network/graph   (Dashboard + Network Explorer)")
        graph = client.get("/api/network/graph").json()
        check("nodes + links", bool(graph["nodes"]) and bool(graph["links"]),
              f"{len(graph['nodes'])} nodes / {len(graph['links'])} links")
        node = graph["nodes"][0]
        # TYPE_META in main.jsx keys off `type`; the node label comes from `name`.
        check("node has id/name/type/risk", {"id", "name", "type", "risk"} <= set(node))
        check("type is a TYPE_META key",
              all(n["type"] in {"person", "phone", "vehicle", "location", "organization", "account"}
                  for n in graph["nodes"]))
        check("some node is central", any(n["central"] for n in graph["nodes"]))
        check("link has source/target/suspicious",
              {"source", "target", "suspicious"} <= set(graph["links"][0]))

        print("GET /api/entities")
        entities = client.get("/api/entities").json()
        check("list, risk-sorted", isinstance(entities, list) and len(entities) > 0,
              f"{len(entities)} entities, top risk {entities[0]['risk']}")

        print("GET /api/alerts   (Alerts table)")
        alerts = client.get("/api/alerts").json()
        check("non-empty", bool(alerts), f"{len(alerts)} alerts")
        alert = alerts[0]
        # The ByteGuard table reads exactly these keys.
        for field in ("id", "entity", "type", "risk", "level", "status", "time"):
            check(f"alert.{field}", field in alert, repr(alert.get(field)))
        check("alert.risk_score (API schema)", "risk_score" in alert)

        print("GET /api/alerts/{id}")
        detail = client.get(f"/api/alerts/{alert['id']}")
        check("200", detail.status_code == 200)
        check("alert + flow", {"alert", "flow", "ai"} <= set(detail.json()))
        check("404 on unknown", client.get("/api/alerts/nope").status_code == 404)

        print("POST /api/alerts/{id}/explain")
        explained = client.post(f"/api/alerts/{alert['id']}/explain")
        check("200", explained.status_code == 200)
        payload = explained.json()
        check("explain schema", {"threat_category", "severity", "confidence", "summary",
                                 "observed_evidence", "recommendations", "caveats"} <= set(payload))
        check("provider reported", payload["provider"] in {"mock", "claude"}, payload["provider"])

        print("POST /api/ai/ask   (AI Investigation tab)")
        asked = client.post("/api/ai/ask", json={"question": "which host is the biggest risk?"})
        check("200", asked.status_code == 200)
        answer = asked.json()
        # main.jsx renders res.data.answer and maps over res.data.evidence.
        check("answer is a string", isinstance(answer.get("answer"), str) and bool(answer["answer"]))
        check("evidence is a list", isinstance(answer.get("evidence"), list))
        print(f"       provider={answer['provider']}  {answer['answer'][:110]}...")
        check("400 without a question", client.post("/api/ai/ask", json={}).status_code == 400)

        print("POST /api/pathfinder   (Pathfinder tab)")
        link = graph["links"][0]
        found = client.post("/api/pathfinder", json={"from": link["source"], "to": link["target"]})
        check("200 for a known pair", found.status_code == 200)
        path = found.json()
        # main.jsx renders path[].name / path[].type, plus hops and suspicious.
        check("path/hops/suspicious", {"path", "hops", "suspicious"} <= set(path))
        check("path steps have name+type", all({"name", "type"} <= set(s) for s in path["path"]))
        print(f"       {' -> '.join(s['name'] for s in path['path'])} "
              f"({path['hops']} hops, {path['suspicious']} suspicious)")
        check("404 for an unknown pair — frontend shows its own demo path",
              client.post("/api/pathfinder", json={"from": "1.2.3.4", "to": "5.6.7.8"}).status_code == 404)
        check("400 without from/to", client.post("/api/pathfinder", json={}).status_code == 400)

        print("GET /api/flows and /api/flows/{id}")
        flows = client.get("/api/flows").json()
        check("non-empty", bool(flows), f"{len(flows)} flows")
        check("flow detail 200", client.get(f"/api/flows/{flows[0]['flow_id']}").status_code == 200)
        check("flow detail 404", client.get("/api/flows/nope").status_code == 404)
        check("ml_detection attached", "ml_detection" in flows[0])

        print("POST /api/demo/load")
        demo = client.post("/api/demo/load")
        check("200", demo.status_code == 200)
        check("job schema", {"job_id", "filename", "status", "summary"} <= set(demo.json()))

        print("POST /api/analyze/pcap")
        pcap = ROOT / "data" / "synthetic.pcap"
        if pcap.exists():
            with pcap.open("rb") as handle:
                uploaded = client.post(
                    "/api/analyze/pcap",
                    files={"file": ("synthetic.pcap", handle, "application/vnd.tcpdump.pcap")},
                )
            check("200", uploaded.status_code == 200, uploaded.text[:120])
            job = uploaded.json()
            check("flows analysed", job["summary"]["total_flows"] > 0,
                  f"{job['summary']['total_flows']} flows, "
                  f"{job['summary']['suspicious_flows']} suspicious — {job['message']}")
        else:
            check("pcap present", False, f"{pcap} missing — run scripts/generate_dataset.py")

        check("rejects a non-pcap upload",
              client.post("/api/analyze/pcap",
                          files={"file": ("notes.txt", b"hello", "text/plain")}).status_code == 400)

        print("GET /api/jobs")
        jobs = client.get("/api/jobs").json()
        check("job history kept", len(jobs) >= 2, f"{len(jobs)} jobs")

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed:")
        for failure in FAILURES:
            print(f"  - {failure}")
        raise SystemExit(1)
    print("all endpoints connected")


if __name__ == "__main__":
    main()
