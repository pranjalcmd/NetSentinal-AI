from detection.rules.basic import evaluate_flow, build_alert


def _flow(**overrides):
    base = {
        "flow_id": "F-TEST",
        "application": "HTTPS",
        "destination_port": 443,
        "packets": 10,
        "duration_seconds": 10,
        "metadata": {"avg_query_length": 0, "repeated_destination": False, "high_outbound_ratio": False},
        "ndpi_risks": [],
    }
    base.update(overrides)
    return base


def _rule_ids(findings):
    return {f.rule_id for f in findings}


# 1. normal HTTPS produces no alert
def test_normal_https_no_alert():
    flow = _flow(application="HTTPS", destination_port=443, packets=72, duration_seconds=15)
    findings = evaluate_flow(flow)
    assert findings == []
    assert build_alert(flow, findings) is None


# 2. normal DNS produces no alert
def test_normal_dns_no_alert():
    flow = _flow(
        application="DNS", destination_port=53, packets=20, duration_seconds=60,
        metadata={"avg_query_length": 28, "repeated_destination": False, "high_outbound_ratio": False},
    )
    findings = evaluate_flow(flow)
    assert findings == []
    assert build_alert(flow, findings) is None


# 3. fast DNS triggers DNS_HIGH_FREQUENCY
def test_fast_dns_triggers_high_frequency():
    flow = _flow(
        application="DNS", destination_port=53, packets=380, duration_seconds=60,
        metadata={"avg_query_length": 0, "repeated_destination": False, "high_outbound_ratio": False},
    )
    findings = evaluate_flow(flow)
    assert "DNS_HIGH_FREQUENCY" in _rule_ids(findings)
    finding = next(f for f in findings if f.rule_id == "DNS_HIGH_FREQUENCY")
    assert "packets/sec" in finding.evidence
    assert "threshold" in finding.evidence


# 4. long DNS query triggers DNS_LONG_QUERY
def test_long_dns_query_triggers_long_query():
    flow = _flow(
        application="DNS", destination_port=53, packets=100, duration_seconds=60,
        metadata={"avg_query_length": 72, "repeated_destination": False, "high_outbound_ratio": False},
    )
    findings = evaluate_flow(flow)
    assert "DNS_LONG_QUERY" in _rule_ids(findings)
    assert "DNS_HIGH_FREQUENCY" not in _rule_ids(findings)
    finding = next(f for f in findings if f.rule_id == "DNS_LONG_QUERY")
    assert "threshold" in finding.evidence


# 5. port 23 triggers UNUSUAL_LEGACY_PORT
def test_port_23_triggers_legacy_port():
    flow = _flow(application="UNKNOWN", destination_port=23, packets=5, duration_seconds=10)
    findings = evaluate_flow(flow)
    assert "UNUSUAL_LEGACY_PORT" in _rule_ids(findings)


# 6. port 2323 triggers UNUSUAL_LEGACY_PORT
def test_port_2323_triggers_legacy_port():
    flow = _flow(application="UNKNOWN", destination_port=2323, packets=5, duration_seconds=10)
    findings = evaluate_flow(flow)
    assert "UNUSUAL_LEGACY_PORT" in _rule_ids(findings)


# 7. repeated_destination=true triggers REPEATED_DESTINATION
def test_repeated_destination_triggers_rule():
    flow = _flow(
        application="HTTPS", destination_port=443, packets=10, duration_seconds=10,
        metadata={"avg_query_length": 0, "repeated_destination": True, "high_outbound_ratio": False},
    )
    findings = evaluate_flow(flow)
    assert "REPEATED_DESTINATION" in _rule_ids(findings)


# 8. high_outbound_ratio=true triggers HIGH_OUTBOUND_VOLUME
def test_high_outbound_ratio_triggers_rule():
    flow = _flow(
        application="HTTPS", destination_port=443, packets=10, duration_seconds=10,
        metadata={"avg_query_length": 0, "repeated_destination": False, "high_outbound_ratio": True},
    )
    findings = evaluate_flow(flow)
    assert "HIGH_OUTBOUND_VOLUME" in _rule_ids(findings)


# 9. an nDPI risk triggers NDPI_RISK
def test_ndpi_risk_triggers_rule():
    flow = _flow(application="HTTPS", destination_port=443, ndpi_risks=["Risky domain"])
    findings = evaluate_flow(flow)
    assert "NDPI_RISK" in _rule_ids(findings)
    finding = next(f for f in findings if f.rule_id == "NDPI_RISK")
    assert "Risky domain" in finding.evidence


# 10. duplicate findings do not duplicate the score
def test_duplicate_ndpi_risks_do_not_double_score():
    flow = _flow(application="HTTPS", destination_port=443, ndpi_risks=["Risky domain", "Risky domain"])
    findings = evaluate_flow(flow)
    assert len(findings) == 2  # both raw findings exist
    alert = build_alert(flow, findings)
    assert alert["risk_score"] == 25  # deduped to a single NDPI_RISK contribution
    assert alert["rule_ids"] == ["NDPI_RISK"]
    assert alert["evidence"] == [findings[0].evidence]


# 13. missing metadata does not crash
def test_missing_metadata_does_not_crash():
    flow = {"flow_id": "F-13", "application": "DNS", "destination_port": 53, "packets": 5, "duration_seconds": 10}
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# 14. metadata=None does not crash
def test_metadata_none_does_not_crash():
    flow = _flow(metadata=None)
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# 15. ndpi_risks=None does not crash
def test_ndpi_risks_none_does_not_crash():
    flow = _flow(ndpi_risks=None)
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# 16. zero duration does not cause division by zero
def test_zero_duration_does_not_crash():
    flow = _flow(application="DNS", destination_port=53, packets=10, duration_seconds=0)
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# extra: packets missing does not crash
def test_missing_packets_does_not_crash():
    flow = {"flow_id": "F-16b", "application": "DNS", "destination_port": 53, "duration_seconds": 10}
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# extra: destination_port missing does not crash
def test_missing_destination_port_does_not_crash():
    flow = {"flow_id": "F-16c", "application": "HTTPS", "packets": 10, "duration_seconds": 10}
    findings = evaluate_flow(flow)
    assert isinstance(findings, list)


# extra: numeric strings for optional values are handled
def test_numeric_strings_are_handled():
    flow = _flow(
        application="DNS", destination_port="23", packets="380", duration_seconds="60",
        metadata={"avg_query_length": "72", "repeated_destination": False, "high_outbound_ratio": False},
    )
    findings = evaluate_flow(flow)
    rule_ids = _rule_ids(findings)
    assert "UNUSUAL_LEGACY_PORT" in rule_ids
    assert "DNS_HIGH_FREQUENCY" in rule_ids
    assert "DNS_LONG_QUERY" in rule_ids
