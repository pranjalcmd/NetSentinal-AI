"""Orchestration: nDPI flows -> detection engine -> alerts + incidents.

Thin on purpose. The pipeline lives in `detection.engine`; this module only
feeds it a capture and projects the result into the alert shape the ByteGuard
API and frontend already read.

One important change from the original scaffold: the engine is called once with
the *whole* capture, not once per flow. Cross-flow detectors (port scan,
lateral fan-out, many-sources floods, destination novelty) need the capture as
context, and correlation needs every finding before it can group them.
"""
from datetime import datetime, timezone

from detection.engine import run_detection
from detection.scoring import SEVERITY_ORDER
from dpi.ndpi_adapter import NDPIAdapter
from ml.detection_engine import DetectionEngine

from backend.app.core.config import settings
from backend.app.services.store import store

adapter = NDPIAdapter()
ml_engine = DetectionEngine(settings.model_path)

# Alerts are a *queue*, findings are the *record*. Every finding is stored and
# drillable; only findings at or above this severity raise an alert. Measured by
# `python scripts/benchmark.py --all` on data/dataset.json (4000 labelled flows,
# 52% benign), which prints this table directly:
#
#     threshold   precision  recall     F1     FPR   alerts  false alarms
#     INFO            0.821   1.000   0.902   0.201    2339           419
#     LOW             0.839   1.000   0.912   0.177    2289           369
#     MEDIUM          0.888   0.933   0.910   0.108    2017           225     <- default
#     HIGH            0.990   0.156   0.270   0.001     303             3
#     CRITICAL        0.000   0.000   0.000   0.000       0             0
#
# LOW edges MEDIUM on F1 by 0.002 while producing 64% more false alarms, so the
# cut is not made on F1: MEDIUM is the lowest false-positive rate that still
# keeps recall above 0.9. HIGH trades away 78% of recall for a near-zero false
# alarm rate, which is why it is the escalation band and not the alert cut.
# CRITICAL needs all five fusion sources agreeing; nothing in this dataset gets
# there. tests/detection/test_engine.py pins all of this, so a rule change that
# moves it fails the suite instead of silently outdating this comment.
ALERT_MIN_SEVERITY = "MEDIUM"

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

# Finding category -> the same table's label, for findings no ML label covers.
CATEGORY_LABELS = {
    "COMMAND_AND_CONTROL": "Botnet C2",
    "DNS_ANOMALY": "DNS Tunneling",
    "RECONNAISSANCE": "Port Scan",
    "LATERAL_MOVEMENT": "Lateral Movement",
    "EXFILTRATION": "Data Exfiltration",
    "DENIAL_OF_SERVICE": "Denial of Service",
    "UNEXPECTED_SERVICE": "Legacy Service",
    "CREDENTIAL_ACCESS": "Brute Force",
    "POLICY_VIOLATION": "Policy Violation",
    "TRAFFIC_ANOMALY": "Suspicious Traffic",
    "UNKNOWN_SUSPICIOUS_BEHAVIOR": "Suspicious Traffic",
}


def analyse_flows(flows: list[dict], capture_id: str | None = None) -> dict:
    """Analyse a batch of normalized flows and replace the store contents."""
    store.reset()

    flows = [flow for flow in flows if flow.get("flow_id")]
    for flow in flows:
        store.flows[flow["flow_id"]] = flow

    result = run_detection(flows, ml_engine, capture_id=capture_id)

    for flow_id, ml_result in result.ml_by_flow.items():
        if flow_id in store.flows:
            store.flows[flow_id]["ml_detection"] = ml_result

    for finding in result.findings:
        store.findings[finding.finding_id] = finding.to_dict()
    for incident in result.incidents:
        store.incidents[incident.incident_id] = incident.to_dict()

    # One alert per flow, carrying every finding raised on it.
    by_flow: dict[str, list] = {}
    for finding in result.findings:
        for flow_id in finding.related_flows:
            by_flow.setdefault(flow_id, []).append(finding)

    for flow_id, findings in by_flow.items():
        findings.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, -1), f.risk), reverse=True)
        if SEVERITY_ORDER.get(findings[0].severity, -1) < SEVERITY_ORDER[ALERT_MIN_SEVERITY]:
            continue    # kept as findings in the store, just not queued as an alert
        alert = _alert(store.flows[flow_id], findings, result.ml_by_flow.get(flow_id))
        store.alerts[alert["alert_id"]] = alert

    return summary()


# Backwards-compatible name used by the original scaffold.
analyse_fixture = analyse_flows


def _alert(flow: dict, findings: list, ml: dict | None) -> dict:
    """Project a flow's findings into the existing alert contract.

    The alert is a *view*; the findings and incidents in the store are the real
    detection output. The top finding (highest risk) drives the headline so the
    table shows the strongest behaviour rather than an averaged blur.
    """
    top = findings[0]
    ml = ml or {}
    label = THREAT_LABELS.get(ml.get("threat_category")) if ml.get(
        "threat_category") not in (None, "BENIGN") else None

    return {
        "alert_id": f"A-{flow['flow_id']}",
        "flow_id": flow["flow_id"],
        "rule_ids": list(dict.fromkeys(rid for f in findings for rid in f.rule_ids)) or ["ML_DETECTION"],
        "title": top.summary,
        "severity": top.severity,
        "risk_score": top.risk,
        "confidence": top.confidence,
        "evidence": list(dict.fromkeys(fact for f in findings for fact in f.observed_facts)),
        # Detection-engine output the UI can drill into (PRD §23/§24/§25).
        "category": top.category,
        "behavior_family": top.behavior_family,
        "attribution": top.attribution,
        "confidence_factors": top.confidence_factors,
        "missing_evidence": top.missing_evidence,
        "alternative_explanations": top.alternative_explanations,
        "recommended_next_steps": top.recommended_next_steps,
        "finding_ids": [f.finding_id for f in findings],
        "incident_id": top.incident_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ml": ml,
        # Field aliases the ByteGuard frontend reads directly.
        "id": f"A-{flow['flow_id']}",
        "entity": flow.get("source_ip", "unknown"),
        "type": label or CATEGORY_LABELS.get(top.category, "Suspicious Traffic"),
        "risk": top.risk,
        "level": top.severity.title(),
        "status": "Open",
        "time": _relative(flow.get("timestamp")),
    }


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

    risks = {"INFO": 0, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for alert in alerts:
        severity = alert.get("severity", "LOW")
        if severity in risks:
            risks[severity] += 1

    return {
        "total_flows": len(flows),
        "suspicious_flows": len(alerts),
        "high_risk": sum(1 for a in alerts if a.get("severity") in {"HIGH", "CRITICAL"}),
        "protocols": len(protocols),
        "incidents": len(store.incidents),
        "risk_distribution": risks,
        "protocol_distribution": protocols,
        "recent_alerts": sorted(
            alerts, key=lambda a: a["created_at"], reverse=True
        )[:10],
        "top_incidents": sorted(
            store.incidents.values(), key=lambda i: i["risk"], reverse=True
        )[:5],
    }
