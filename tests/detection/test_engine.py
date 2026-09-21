"""The detection engine end to end: context -> fusion -> correlation -> engine.

test_rules.py covers the individual detectors and test_scoring.py the §26.2
bands. This file covers everything downstream of them, which until now only had
`__main__` self-checks: the cross-flow context, the fusion arithmetic, incident
grouping, the engine's two passes and its degraded modes — plus one measured
run of the fully wired pipeline (capture flows -> DPI metadata -> ML -> rules ->
correlation) against the 4000 labelled flows in data/dataset.json.

Run: python -m pytest tests/detection/test_engine.py -q
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from detection.context import MIN_FLOWS_FOR_BASELINE, FlowContext, is_internal
from detection.correlation import (
    CORRELATION_PER_EXTRA_FINDING,
    CORRELATION_PER_FAMILY,
    correlate,
    correlation_score,
    time_bucket,
)
from detection.engine import run_detection
from detection.schemas import Finding, Signal
from detection.scoring import (
    SEVERITY_ORDER,
    SOURCE_CAPS,
    attribute,
    confidence,
    fuse,
    severity_for,
    source_scores,
)

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "data" / "dataset.json"


def flow(flow_id="F-1", src="10.0.0.5", dst="8.8.8.8", **overrides):
    base = {
        "flow_id": flow_id, "source_ip": src, "destination_ip": dst,
        "destination_port": 443, "transport": "TCP", "application": "HTTPS",
        "packets": 10, "bytes": 1000, "duration_seconds": 10,
        "ndpi_risks": [], "metadata": {},
    }
    base.update(overrides)
    return base


def finding(fid, family, risk=50, host="10.0.0.14", ts="2026-09-09T14:00:00Z"):
    return Finding(
        finding_id=fid, category=family, summary=f"{family} on {host}",
        behavior_family=family, risk=risk, confidence=70, severity=severity_for(risk),
        first_seen=ts, last_seen=ts, related_hosts=[host], related_domains=["203.0.113.5"],
        rule_ids=[f"R_{family}"],
    )


# ===========================================================================
# FlowContext — the cross-flow features the per-flow rules cannot see
# ===========================================================================

def test_host_features_count_distinct_peers_and_ports():
    ctx = FlowContext([
        flow("a", dst="10.0.0.2", destination_port=445),
        flow("b", dst="10.0.0.3", destination_port=445),
        flow("c", dst="8.8.8.8", destination_port=53),
        flow("d", dst="8.8.8.8", destination_port=53),   # repeat: not a new peer
    ])
    assert ctx.host_unique_destinations("10.0.0.5") == 3
    assert ctx.host_unique_dest_ports("10.0.0.5") == 2
    assert ctx.pair_flows("10.0.0.5", "8.8.8.8") == 2
    assert ctx.dest_source_count("8.8.8.8") == 1


def test_internal_fanout_ignores_external_destinations():
    """Lateral movement is internal->internal. Counting external peers here
    would turn every browsing host into a lateral-movement suspect."""
    ctx = FlowContext([flow("a", dst="10.0.0.2"), flow("b", dst="192.168.9.9"),
                       flow("c", dst="8.8.8.8"), flow("d", dst="1.1.1.1")])
    assert ctx.host_unique_destinations("10.0.0.5") == 4
    assert ctx.host_internal_fanout("10.0.0.5") == 2
    assert is_internal("192.168.9.9") and not is_internal("1.1.1.1")


def test_unknown_host_is_zero_not_an_error():
    ctx = FlowContext([flow("a")])
    assert ctx.host_unique_destinations("10.9.9.9") == 0
    assert ctx.host_internal_fanout(None) == 0
    assert ctx.pair_flows("x", "y") == 0
    assert ctx.pair_span("x", "y") == 0.0


@pytest.mark.parametrize("count,available", [
    (MIN_FLOWS_FOR_BASELINE - 1, False),
    (MIN_FLOWS_FOR_BASELINE, True),
])
def test_baseline_needs_enough_flows_to_mean_anything(count, available):
    ctx = FlowContext([flow(f"f{i}") for i in range(count)])
    assert ctx.baseline_available is available
    # "rare port" is a claim about a baseline, so it stays False without one.
    assert ctx.port_is_rare(4444) is available


def test_port_rarity_needs_a_baseline_and_a_real_port():
    common = [flow(f"f{i}", destination_port=443) for i in range(20)]
    ctx = FlowContext(common + [flow("odd", destination_port=4444)])
    assert ctx.baseline_available
    assert ctx.port_is_rare(4444) is True
    assert ctx.port_is_rare(443) is False
    assert ctx.port_is_rare(None) is False
    assert ctx.port_is_rare("not-a-port") is False


def test_volume_ratio_is_relative_to_the_capture_median():
    ctx = FlowContext([flow("a", bytes=400), flow("b", bytes=400), flow("c", bytes=400)])
    assert ctx.volume_ratio_to_baseline(4000) == 10.0
    assert ctx.volume_ratio_to_baseline(0) == 0.0
    assert FlowContext([]).volume_ratio_to_baseline(4000) == 0.0


def test_size_variation_stays_silent_below_three_flows():
    """Two samples cannot establish "similar payload profile". Returning None
    keeps the beaconing detector quiet instead of letting it guess."""
    two = FlowContext([flow("a", bytes=1000), flow("b", bytes=1000)])
    assert two.pair_size_cv("10.0.0.5", "8.8.8.8") is None
    steady = FlowContext([flow(f"f{i}", bytes=1000) for i in range(4)])
    assert steady.pair_size_cv("10.0.0.5", "8.8.8.8") == 0.0
    jumpy = FlowContext([flow("a", bytes=10), flow("b", bytes=5000), flow("c", bytes=90000)])
    assert jumpy.pair_size_cv("10.0.0.5", "8.8.8.8") > 1.0


def test_garbage_numbers_do_not_crash_the_context():
    """Flow fields come from a parsed capture, so they are untrusted data."""
    ctx = FlowContext([
        flow("a", packets=None, bytes="abc", duration_seconds=float("nan")),
        flow("b", packets=float("inf"), bytes=float("-inf"), destination_port="53"),
        flow("c", source_ip=None, destination_ip=None, bytes=1000),
        {"flow_id": "d"},                     # nothing but an id
    ])
    assert ctx.flow_count == 4
    assert ctx.median_bytes >= 0
    assert ctx.port_flows[53] == 1            # the numeric string still counted


# ===========================================================================
# Fusion arithmetic (PRD §26.1 sums weights; the caps are ours)
# ===========================================================================

@pytest.mark.parametrize("source,cap", sorted(SOURCE_CAPS.items()))
def test_no_single_source_can_exceed_its_cap(source, cap):
    risk, _ = fuse({source: 100})
    assert risk == cap


def test_rules_alone_cannot_reach_high():
    """The design property the whole severity scale rests on: every rule in the
    library firing at once is still MEDIUM, so HIGH always means a second,
    independent source agreed. Measured consequence — HIGH runs at 0.99
    precision on the labelled set (see the metrics test below)."""
    risk, _ = fuse({"rule": 100})
    assert risk == 55
    assert severity_for(risk) == "MEDIUM"
    assert SEVERITY_ORDER[severity_for(risk)] < SEVERITY_ORDER["HIGH"]


def test_full_agreement_reaches_the_top_of_the_scale():
    risk, _ = fuse({source: 100 for source in SOURCE_CAPS})
    assert risk == 100
    assert fuse({})[0] == 0


def test_attribution_points_always_sum_to_the_displayed_risk():
    """PRD §26.3 shows the risk broken down per contribution. A breakdown that
    does not add up to the number beside it is worse than no breakdown."""
    signals = [
        Signal("A", "EXFILTRATION", "Large outbound transfer", 25, "e", trust="OBSERVED"),
        Signal("B", "EXFILTRATION", "High outbound volume", 15, "e"),
        Signal("C", "TRAFFIC_ANOMALY", "nDPI risk", 25, "e", source="dpi", trust="OBSERVED"),
    ]
    for ml_score in (0, 1, 37, 100):
        scores = {**source_scores(signals), "ml": ml_score}
        risk, _ = fuse(scores)
        breakdown = attribute(risk, scores, signals, ml={"ml_category": "DATA_EXFILTRATION"})
        assert sum(entry["points"] for entry in breakdown) == risk, breakdown
        assert [e["points"] for e in breakdown] == sorted(
            (e["points"] for e in breakdown), reverse=True)
    assert attribute(0, {}, []) == []


def test_confidence_never_reaches_certainty():
    """§12's wording rule applied to the number: traffic alone never confirms
    intent, so the scale stops short of 100 even with everything agreeing."""
    signals = [Signal(f"R{i}", "EXFILTRATION", "t", 20, "e", trust="OBSERVED") for i in range(6)]
    best, _ = confidence(
        {source: 100 for source in SOURCE_CAPS}, signals,
        {"ml_category": "DATA_EXFILTRATION", "behavior_family": "EXFILTRATION"},
        metadata_completeness=1.0, baseline_available=True, repeated_observations=10)
    worst, factors = confidence({}, [], None, metadata_completeness=0.0,
                                baseline_available=False)
    assert best == 95
    assert worst == 5
    assert factors["no_deterministic_signal"] == -15 and factors["no_baseline"] == -8


def test_ml_disagreeing_with_a_rule_costs_confidence():
    signals = [Signal("A", "DNS_ANOMALY", "t", 25, "e")]
    scores = source_scores(signals)
    agrees, _ = confidence(scores, signals, {"ml_category": "DNS_TUNNELING"},
                           metadata_completeness=1.0, baseline_available=True)
    disagrees, factors = confidence(scores, signals, {"ml_category": "BENIGN"},
                                    metadata_completeness=1.0, baseline_available=True)
    assert factors["ml_disagrees"] == -18
    assert disagrees == agrees - 18


# ===========================================================================
# Correlation — our extension; grouping findings into one story
# ===========================================================================

def test_one_host_in_one_window_is_one_incident():
    incidents = correlate([finding("F1", "DNS_ANOMALY"), finding("F2", "BEACONING"),
                           finding("F3", "EXFILTRATION", risk=80)])
    assert len(incidents) == 1
    assert incidents[0].primary_host == "10.0.0.14"
    assert incidents[0].risk == 80 and incidents[0].severity == "HIGH"


def test_different_hosts_stay_different_incidents():
    incidents = correlate([finding("F1", "DNS_ANOMALY"),
                           finding("F2", "BEACONING", host="10.0.0.99")])
    assert len(incidents) == 2
    assert {i.primary_host for i in incidents} == {"10.0.0.14", "10.0.0.99"}


def test_the_same_host_in_a_later_window_is_a_separate_incident():
    later = "2026-09-09T15:30:00Z"                 # well past TIME_BUCKET_SECONDS
    assert time_bucket("2026-09-09T14:00:00Z") != time_bucket(later)
    assert len(correlate([finding("F1", "DNS_ANOMALY"),
                          finding("F2", "BEACONING", ts=later)])) == 2


def test_findings_without_timestamps_share_one_bucket():
    """One incident per undated finding would be noise, not correlation."""
    assert time_bucket(None) == "unbucketed"
    assert time_bucket("not a timestamp") == "unbucketed"
    incidents = correlate([finding("F1", "DNS_ANOMALY", ts=None),
                           finding("F2", "BEACONING", ts=None)])
    assert len(incidents) == 1


def test_correlation_score_rewards_distinct_behaviours_most():
    assert correlation_score([finding("F1", "DNS_ANOMALY")]) == 0
    assert correlation_score([]) == 0
    two_families = [finding("F1", "DNS_ANOMALY"), finding("F2", "BEACONING")]
    two_of_one = [finding("F1", "DNS_ANOMALY"), finding("F2", "DNS_ANOMALY")]
    assert correlation_score(two_families) == CORRELATION_PER_FAMILY
    assert correlation_score(two_of_one) == CORRELATION_PER_EXTRA_FINDING
    assert correlation_score(two_families) > correlation_score(two_of_one)
    assert correlation_score([finding(f"F{i}", f) for i, f in enumerate(
        ["DNS_ANOMALY", "BEACONING", "EXFILTRATION", "RECONNAISSANCE",
         "LATERAL_MOVEMENT", "FLOOD"])]) == 100        # clamped


def test_the_story_is_told_in_intrusion_order_not_arrival_order():
    incidents = correlate([finding("F1", "EXFILTRATION"), finding("F2", "RECONNAISSANCE"),
                           finding("F3", "BEACONING")])
    assert incidents[0].behavior_families == ["RECONNAISSANCE", "BEACONING", "EXFILTRATION"]
    assert incidents[0].finding_ids == ["F2", "F3", "F1"]
    assert [line.rsplit("— ", 1)[1] for line in incidents[0].narrative] == [
        f"{family} on 10.0.0.14 (R_{family})"
        for family in ("RECONNAISSANCE", "BEACONING", "EXFILTRATION")]


def test_the_same_behaviour_twice_gets_the_same_fingerprint():
    """Dedup key across captures: same host, same families, same window."""
    first = correlate([finding("F1", "DNS_ANOMALY"), finding("F2", "BEACONING")])
    second = correlate([finding("F9", "DNS_ANOMALY"), finding("F8", "BEACONING")])
    other = correlate([finding("F1", "DNS_ANOMALY"), finding("F2", "EXFILTRATION")])
    assert first[0].fingerprint == second[0].fingerprint
    assert first[0].fingerprint != other[0].fingerprint


def test_correlate_stamps_the_incident_back_onto_its_findings():
    findings = [finding("F1", "DNS_ANOMALY"), finding("F2", "BEACONING")]
    incident = correlate(findings, capture_id="CAP-1")[0]
    assert {f.incident_id for f in findings} == {incident.incident_id}
    assert set(incident.finding_ids) == {"F1", "F2"}
    assert incident.capture_ids == ["CAP-1"]


def test_investigability_is_scored_separately_from_severity():
    thin = correlate([finding("F1", "DNS_ANOMALY")])[0]
    rich = correlate([finding("F1", "DNS_ANOMALY"), finding("F2", "BEACONING")],
                     baseline_available=True)[0]
    assert rich.evidence_coverage > thin.evidence_coverage
    assert thin.readiness in {"LIMITED", "PARTIAL"} and rich.readiness == "READY"


# ===========================================================================
# The engine: two passes, and what happens when a layer is missing
# ===========================================================================

def chain():
    """One host, three behaviours, three minutes — the case correlation exists for."""
    return [
        flow("C1", src="10.0.0.14", dst="8.8.8.8", destination_port=53, transport="UDP",
             application="DNS", packets=900, bytes=180000, duration_seconds=60,
             timestamp="2026-09-09T14:00:00Z",
             metadata={"avg_query_length": 80, "dns_query_entropy": 4.6,
                       "outbound_ratio": 0.7, "unique_destinations": 1}),
        flow("C2", src="10.0.0.14", dst="203.0.113.9", destination_port=9001,
             packets=140, bytes=26000, duration_seconds=1900,
             timestamp="2026-09-09T14:01:00Z", ndpi_risks=["Risky domain"],
             metadata={"repeated_destination": True, "outbound_ratio": 0.6,
                       "unique_destinations": 1}),
        flow("C3", src="10.0.0.14", dst="198.51.100.7", packets=4_000_000,
             bytes=5_100_000_000, duration_seconds=210,
             timestamp="2026-09-09T14:02:00Z",
             metadata={"outbound_ratio": 0.95, "high_outbound_ratio": True,
                       "unique_destinations": 1}),
    ]


def test_the_whole_chain_becomes_one_incident():
    result = run_detection(chain(), capture_id="CAP-CHAIN")
    assert {"DNS_ANOMALY", "BEACONING", "EXFILTRATION"} <= {
        f.behavior_family for f in result.findings}
    assert len(result.incidents) == 1
    assert result.incidents[0].primary_host == "10.0.0.14"
    assert len(result.incidents[0].finding_ids) == len(result.findings)
    assert result.flows_analyzed == 3
    assert result.ml_available is False


def test_pass_two_folds_correlation_back_into_risk():
    """Correlation is an input as well as an output: the same flow scores higher
    when the engine can see what else that host was doing."""
    solo = run_detection([chain()[0]])
    together = run_detection(chain())
    dns_solo = next(f for f in solo.findings if f.behavior_family == "DNS_ANOMALY")
    dns_group = next(f for f in together.findings if f.behavior_family == "DNS_ANOMALY")
    assert dns_solo.scores["correlation"] == 0
    assert dns_group.scores["correlation"] > 0
    assert dns_group.risk > dns_solo.risk


def test_every_finding_the_engine_emits_adds_up():
    for result in (run_detection(chain()), run_detection([chain()[0]])):
        for f in result.findings:
            assert sum(e["points"] for e in f.attribution) == f.risk, f.finding_id
            assert 5 <= f.confidence <= 95
            assert 0 <= f.risk <= 100
            assert f.severity in SEVERITY_ORDER


def test_findings_come_out_worst_first():
    findings = run_detection(chain()).findings
    keys = [(SEVERITY_ORDER[f.severity], f.risk) for f in findings]
    assert keys == sorted(keys, reverse=True)


def test_an_incident_headline_matches_its_worst_member():
    """Pass two changes risks, so the incident has to be resynced afterwards or
    it advertises a severity none of its findings still carry."""
    result = run_detection(chain())
    by_id = {f.finding_id: f for f in result.findings}
    for incident in result.incidents:
        members = [by_id[fid] for fid in incident.finding_ids]
        assert incident.risk == max(f.risk for f in members)
        assert SEVERITY_ORDER[incident.severity] == max(
            SEVERITY_ORDER[f.severity] for f in members)
        assert len(incident.narrative) == len(members)


def test_a_broken_model_degrades_to_rules_and_dpi():
    """ML is advisory. A model that raises must cost us the ML points, nothing
    else — the rules and DPI evidence is still real."""
    class Broken:
        trained = True

        def predict(self, flow):
            raise RuntimeError("model gone")

    baseline = run_detection(chain())
    degraded = run_detection(chain(), Broken())
    assert degraded.ml_available is False
    assert len(degraded.findings) == len(baseline.findings)
    assert all(f.ml_model_version == "unavailable" for f in degraded.findings)
    assert all(f.scores["ml"] == 0 for f in degraded.findings)


def test_a_model_that_only_flags_produces_ml_only_findings():
    """No rule agrees, so the finding still exists but is rendered as the thin
    evidence it is rather than dropped or dressed up."""
    class Alarmist:
        trained = False

        def predict(self, flow):
            return {"ml_score": 90, "ml_category": "BOTNET", "confidence": 0.9}

    quiet = flow("Q1", packets=8, bytes=800, duration_seconds=30)
    result = run_detection([quiet], Alarmist())
    assert result.ml_available is True
    assert len(result.findings) == 1
    found = result.findings[0]
    assert found.rule_ids == [] and found.scores["ml"] == 90
    assert found.confidence_factors["no_deterministic_signal"] == -15
    assert found.ml_model_version == "heuristic-v1"


def test_a_quiet_capture_produces_nothing_rather_than_something():
    assert run_detection([flow("Q1", packets=8, bytes=800, duration_seconds=30)]).findings == []
    empty = run_detection([])
    assert (empty.findings, empty.incidents, empty.flows_analyzed) == ([], [], 0)
    assert empty.to_dict()["baseline_available"] is False


def test_malformed_flows_do_not_take_the_pipeline_down():
    result = run_detection([
        {}, {"flow_id": "F-1"},
        flow("F-2", packets=None, bytes="lots", duration_seconds=None),
        flow("F-3", source_ip=None, destination_ip=None, ndpi_risks="not-a-list"),
        flow("F-4", metadata="not-a-dict"),
    ])
    assert result.flows_analyzed == 5
    for f in result.findings:
        assert sum(e["points"] for e in f.attribution) == f.risk


def test_the_same_capture_twice_gives_the_same_answer():
    first, second = run_detection(chain()), run_detection(chain())
    assert [(f.finding_id, f.risk, f.severity, f.confidence) for f in first.findings] == \
           [(f.finding_id, f.risk, f.severity, f.confidence) for f in second.findings]
    assert [i.fingerprint for i in first.incidents] == [i.fingerprint for i in second.incidents]


def test_findings_by_flow_indexes_every_related_flow():
    result = run_detection(chain())
    index = result.findings_by_flow()
    assert set(index) == {"C1", "C2", "C3"}
    assert sum(len(v) for v in index.values()) == len(result.findings)


# ===========================================================================
# The wired pipeline, measured (capture metadata -> DPI -> ML -> rules -> risk)
# ===========================================================================

@pytest.fixture(scope="module")
def measured():
    """One run of the full stack over 4000 labelled flows.

    This is the test behind the threshold table in
    backend/app/services/analysis.py. If the numbers below move, that comment is
    now a false claim about the implementation (§1.2 E) and has to move with them.
    """
    from backend.app.core.config import settings
    from ml.detection_engine import DetectionEngine

    flows = json.loads(DATASET.read_text(encoding="utf-8"))
    started = time.time()
    result = run_detection(flows, DetectionEngine(settings.model_path), capture_id="CAP-BENCH")
    elapsed = time.time() - started

    worst: dict[str, str] = {}
    for f in result.findings:
        for flow_id in f.related_flows:
            if SEVERITY_ORDER[f.severity] > SEVERITY_ORDER.get(worst.get(flow_id, ""), -2):
                worst[flow_id] = f.severity
    truth = {f["flow_id"]: f["label"] != "BENIGN" for f in flows}
    return {"result": result, "worst": worst, "truth": truth,
            "elapsed": elapsed, "flows": len(flows)}


def _at(measured, threshold: str) -> dict:
    flagged = {fid for fid, sev in measured["worst"].items()
               if SEVERITY_ORDER[sev] >= SEVERITY_ORDER[threshold]}
    truth = measured["truth"]
    tp = sum(1 for fid in flagged if truth.get(fid))
    fp, fn = len(flagged) - tp, sum(1 for fid, bad in truth.items() if bad and fid not in flagged)
    tn = len(truth) - tp - fp - fn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {"precision": precision, "recall": recall,
            "fpr": fp / (fp + tn) if fp + tn else 0.0,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0}


def test_the_dataset_is_the_one_the_numbers_were_measured_on(measured):
    assert measured["flows"] == 4000
    assert sum(measured["truth"].values()) == 1920      # 4000 - 2080 benign
    assert measured["result"].ml_available is True
    assert measured["result"].baseline_available is True


def test_the_default_alert_threshold_is_the_one_the_comment_claims(measured):
    """analysis.py cuts the alert queue at MEDIUM. The justification there is
    not "best F1" — LOW actually wins F1 by 0.002 — it is "lowest false-positive
    rate that still keeps recall above 0.9". Assert that rule, so a change that
    makes a different band the right cut fails here and moves the default."""
    from backend.app.services.analysis import ALERT_MIN_SEVERITY

    usable = {t: _at(measured, t) for t in ("INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL")}
    keeps_recall = {t: m for t, m in usable.items() if m["recall"] >= 0.90}
    assert min(keeps_recall, key=lambda t: keeps_recall[t]["fpr"]) == ALERT_MIN_SEVERITY, \
        {t: (round(m["recall"], 3), round(m["fpr"], 3)) for t, m in usable.items()}


@pytest.mark.parametrize("threshold,min_precision,min_recall,max_fpr", [
    # measured 2026-09-16 by `python scripts/benchmark.py --all`; the exact
    # figures live in the table in backend/app/services/analysis.py
    ("LOW",    0.80, 0.98, 0.20),   # actual 0.839 / 1.000 / 0.177
    ("MEDIUM", 0.85, 0.90, 0.13),   # actual 0.888 / 0.933 / 0.108
    ("HIGH",   0.95, 0.10, 0.01),   # actual 0.990 / 0.156 / 0.001
])
def test_measured_accuracy_holds(measured, threshold, min_precision, min_recall, max_fpr):
    m = _at(measured, threshold)
    assert m["precision"] >= min_precision, m
    assert m["recall"] >= min_recall, m
    assert m["fpr"] <= max_fpr, m


def test_high_severity_means_a_second_source_agreed(measured):
    """The other half of test_rules_alone_cannot_reach_high, at dataset scale:
    since rules cap at 55, nothing reaches HIGH on rule evidence alone."""
    high = [f for f in measured["result"].findings
            if SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER["HIGH"]]
    assert high, "no HIGH findings at all would make the band meaningless"
    for f in high:
        corroborating = [s for s, v in f.scores.items() if s != "rule" and v > 0]
        assert corroborating, f.finding_id


def test_the_engine_stays_within_its_time_budget(measured):
    """PRD §53 allows 10s for a capture. 4000 flows is far larger than any test
    capture, so this is a "has not become pathological" guard, not the §53 check
    itself — that one lives on the real upload path in tests/test_api.py."""
    per_flow_ms = 1000 * measured["elapsed"] / measured["flows"]
    assert per_flow_ms < 10, f"{per_flow_ms:.1f}ms per flow"
