import json
from pathlib import Path

from detection.rules.basic import evaluate_flow, build_alert

DEMO_FLOWS_PATH = Path(__file__).resolve().parents[2] / "samples" / "demo_flows.json"


def _load_demo_flows():
    return json.loads(DEMO_FLOWS_PATH.read_text(encoding="utf-8"))


def _analyze(flows):
    alerts = {}
    for flow in flows:
        findings = evaluate_flow(flow)
        alert = build_alert(flow, findings)
        if alert:
            alerts[flow["flow_id"]] = alert
    return alerts


# 17. the existing samples/demo_flows.json can be analyzed
def test_demo_flows_can_be_analyzed_without_crashing():
    flows = _load_demo_flows()
    assert len(flows) > 0
    alerts = _analyze(flows)
    assert isinstance(alerts, dict)


def test_demo_flows_produce_expected_alerts():
    flows = _load_demo_flows()
    alerts = _analyze(flows)

    # F-001: high-frequency DNS + long query + repeated destination
    assert "F-001" in alerts
    assert alerts["F-001"]["risk_score"] == 60
    assert alerts["F-001"]["severity"] == "MEDIUM"
    assert set(alerts["F-001"]["rule_ids"]) == {
        "DNS_HIGH_FREQUENCY", "DNS_LONG_QUERY", "REPEATED_DESTINATION",
    }

    # F-002: normal DNS, below thresholds
    assert "F-002" not in alerts

    # F-003: normal HTTPS
    assert "F-003" not in alerts

    # F-004: legacy port + repeated destination
    assert "F-004" in alerts
    assert alerts["F-004"]["risk_score"] == 30
    assert alerts["F-004"]["severity"] == "LOW"
    assert set(alerts["F-004"]["rule_ids"]) == {"UNUSUAL_LEGACY_PORT", "REPEATED_DESTINATION"}

    # F-005: high outbound volume + nDPI risk
    assert "F-005" in alerts
    assert alerts["F-005"]["risk_score"] == 40
    assert alerts["F-005"]["severity"] == "MEDIUM"
    assert set(alerts["F-005"]["rule_ids"]) == {"HIGH_OUTBOUND_VOLUME", "NDPI_RISK"}


# 18. build_alert() returns all fields expected by the backend
def test_build_alert_returns_backend_compatible_fields():
    flows = _load_demo_flows()
    flow = next(f for f in flows if f["flow_id"] == "F-001")
    findings = evaluate_flow(flow)
    alert = build_alert(flow, findings)

    expected_fields = {"flow_id", "rule_ids", "title", "severity", "risk_score", "evidence"}
    assert set(alert.keys()) == expected_fields

    # backend adds these itself; detection must not pre-populate them
    assert "alert_id" not in alert
    assert "created_at" not in alert

    assert alert["flow_id"] == "F-001"
    assert isinstance(alert["rule_ids"], list)
    assert isinstance(alert["title"], str)
    assert alert["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert 0 <= alert["risk_score"] <= 100
    assert isinstance(alert["evidence"], list)
    assert len(alert["evidence"]) == len(alert["rule_ids"])
