from datetime import datetime, timezone
from detection.rules.basic import evaluate_flow, build_alert
from dpi.ndpi_adapter import NDPIAdapter
from backend.app.services.store import store

adapter = NDPIAdapter()

def analyse_fixture(flows: list[dict]) -> dict:
    store.reset()
    for f in flows:
        store.flows[f["flow_id"]] = f
        alert = build_alert(f, evaluate_flow(f))
        if alert:
            alert["alert_id"] = f"A-{f['flow_id']}"
            alert["created_at"] = datetime.now(timezone.utc).isoformat()
            store.alerts[alert["alert_id"]] = alert
    return summary()

def summary() -> dict:
    flows = list(store.flows.values())
    alerts = list(store.alerts.values())
    proto = {}
    for f in flows: proto[f["application"]] = proto.get(f["application"], 0) + 1
    risks = {k: 0 for k in ("LOW", "MEDIUM", "HIGH", "CRITICAL")}
    for a in alerts: risks[a["severity"]] += 1
    return {
        "total_flows": len(flows),
        "suspicious_flows": len(alerts),
        "high_risk": sum(1 for a in alerts if a["severity"] in {"HIGH", "CRITICAL"}),
        "protocols": len(proto),
        "risk_distribution": risks,
        "protocol_distribution": proto,
        "recent_alerts": sorted(alerts, key=lambda x: x["created_at"], reverse=True)[:10],
    }
