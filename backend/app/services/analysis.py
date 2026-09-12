"""Orchestration: nDPI flows -> transparent rules + ML -> fused alerts.

Both detection layers run on every flow. Rules stay explainable; the ML
engine adds behavioural findings the rules do not cover. The fused alert
keeps evidence from both so an analyst can see why it fired.
"""
from datetime import datetime, timezone

from detection.rules.basic import build_alert, evaluate_flow
from dpi.ndpi_adapter import NDPIAdapter
from ml.detection_engine import DetectionEngine

from backend.app.core.config import settings
from backend.app.services.store import store

adapter = NDPIAdapter()
ml_engine = DetectionEngine(settings.model_path)

# ML label -> label shown in the ByteGuard alert table.
THREAT_LABELS = {
    "DNS_TUNNELING": "DNS Tunneling",
    "PORT_SCAN": "Port Scan",
    "DOS": "Denial of Service",
    "BOTNET": "Botnet C2",
    "BRUTE_FORCE": "Brute Force",
    "DATA_EXFILTRATION": "Data Exfiltration",
    "SUSPICIOUS_LEGACY_SERVICE": "Legacy Service",
    "SUSPICIOUS_TRAFFIC": "Suspicious Traffic",
    "BENIGN": "Benign",
}


def analyse_flows(flows: list[dict]) -> dict:
    """Analyse a batch of normalized flows and replace the store contents."""
    store.reset()

    for flow in flows:
        flow_id = flow.get("flow_id")
        if not flow_id:
            continue

        store.flows[flow_id] = flow

        findings = evaluate_flow(flow)
        ml_result = ml_engine.predict(flow)
        flow["ml_detection"] = ml_result

        alert = _fuse(flow, build_alert(flow, findings), ml_result)
        if alert:
            store.alerts[alert["alert_id"]] = alert

    return summary()


# Backwards-compatible name used by the original scaffold.
analyse_fixture = analyse_flows


def _fuse(flow: dict, alert: dict | None, ml: dict) -> dict | None:
    """Merge the rule alert and the ML verdict into one alert, or None."""
    ml_fired = ml["threat_category"] != "BENIGN"

    if alert is None:
        if not ml_fired:
            return None
        alert = {
            "flow_id": flow["flow_id"],
            "rule_ids": ["ML_DETECTION"],
            "title": THREAT_LABELS.get(ml["threat_category"], ml["threat_category"]),
            "severity": ml["severity"],
            "risk_score": ml["risk_score"],
            "evidence": list(ml["evidence"]),
        }
    else:
        # Take the higher of the two scores, and the severity that goes with it.
        if int(ml["risk_score"]) >= int(alert["risk_score"]):
            alert["risk_score"] = int(ml["risk_score"])
            alert["severity"] = ml["severity"]
        alert["evidence"] = list(dict.fromkeys(alert["evidence"] + ml["evidence"]))
        if ml_fired:
            alert["rule_ids"] = list(dict.fromkeys(alert["rule_ids"] + ["ML_DETECTION"]))

    alert["alert_id"] = f"A-{flow['flow_id']}"
    alert["created_at"] = datetime.now(timezone.utc).isoformat()
    alert["ml"] = ml

    # Field aliases the ByteGuard frontend reads directly.
    alert["id"] = alert["alert_id"]
    alert["entity"] = flow.get("source_ip", "unknown")
    alert["type"] = THREAT_LABELS.get(ml["threat_category"], "Suspicious Traffic")
    alert["risk"] = alert["risk_score"]
    alert["level"] = alert["severity"].title()
    alert["status"] = "Open"
    alert["time"] = _relative(flow.get("timestamp"))
    return alert


def _relative(timestamp: str | None) -> str:
    if not timestamp:
        return "just now"
    try:
        then = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    except ValueError:
        return "just now"
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)

    seconds = (datetime.now(timezone.utc) - then).total_seconds()
    for unit, size in (("d", 86400), ("h", 3600), ("m", 60)):
        if seconds >= size:
            return f"{int(seconds // size)}{unit} ago"
    return "just now"


def summary() -> dict:
    flows = list(store.flows.values())
    alerts = list(store.alerts.values())

    protocols: dict[str, int] = {}
    for flow in flows:
        application = flow.get("application", "UNKNOWN")
        protocols[application] = protocols.get(application, 0) + 1

    risks = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for alert in alerts:
        severity = alert.get("severity", "LOW")
        if severity in risks:
            risks[severity] += 1

    return {
        "total_flows": len(flows),
        "suspicious_flows": len(alerts),
        "high_risk": sum(1 for a in alerts if a.get("severity") in {"HIGH", "CRITICAL"}),
        "protocols": len(protocols),
        "risk_distribution": risks,
        "protocol_distribution": protocols,
        "recent_alerts": sorted(
            alerts, key=lambda a: a["created_at"], reverse=True
        )[:10],
    }
