from datetime import datetime, timezone

from detection.rules.basic import evaluate_flow, build_alert
from dpi.ndpi_adapter import NDPIAdapter
from app.services.store import store


adapter = NDPIAdapter()


def analyse_fixture(flows: list[dict]) -> dict:
    # Clear old data before loading a new analysis
    store.reset()

    # Load every flow into the shared backend store
    for flow in flows:
        flow_id = flow.get("flow_id")

        if not flow_id:
            continue

        store.flows[flow_id] = flow

        # Run the detection rules created by Member 2
        result = evaluate_flow(flow)

        # Convert a detection result into an alert
        alert = build_alert(flow, result)

        if alert:
            alert["alert_id"] = f"A-{flow_id}"
            alert["created_at"] = datetime.now(timezone.utc).isoformat()

            store.alerts[alert["alert_id"]] = alert

    return summary()


def summary() -> dict:
    flows = list(store.flows.values())
    alerts = list(store.alerts.values())

    # Count applications/protocols
    protocols = {}

    for flow in flows:
        application = flow.get("application", "UNKNOWN")
        protocols[application] = protocols.get(application, 0) + 1

    # Count alerts by severity
    risks = {
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 0,
        "CRITICAL": 0,
    }

    for alert in alerts:
        severity = alert.get("severity", "LOW")

        if severity in risks:
            risks[severity] += 1

    return {
        "total_flows": len(flows),
        "suspicious_flows": len(alerts),
        "high_risk": sum(
            1
            for alert in alerts
            if alert.get("severity") in {"HIGH", "CRITICAL"}
        ),
        "protocols": len(protocols),
        "risk_distribution": risks,
        "protocol_distribution": protocols,
        "recent_alerts": sorted(
            alerts,
            key=lambda alert: alert["created_at"],
            reverse=True,
        )[:10],
    }