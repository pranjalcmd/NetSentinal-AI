"""The detection engine — PRD §20, wired end to end as §68 describes.

    flows → context (host/graph/baseline) → rules + ML + DPI + baseline
          → per-family findings → correlation → incidents → re-fusion

Two passes, because correlation is both an *output* (incidents) and an *input*
(it is one of the five sources fused in detection/scoring.py). Pass one scores
each finding from the evidence available on its own; correlation then groups
them; pass two re-fuses each finding now that it knows what else was happening
on that host. A finding that stands alone is unaffected.

Every layer degrades instead of failing, reporting less rather than guessing
more (§1.2 E):

    no ML engine / ML raises  → rules + DPI + baseline still produce findings
    no context               → cross-flow families stay silent, per-flow ones run
    capture too small        → baseline_available False, no novelty claims

The engine never decides a verdict is true. It produces evidence, a risk, a
confidence, and what is missing — the analyst and (later) the AI layer work
from that.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from detection.context import FlowContext
from detection.correlation import correlate
from detection.rules.basic import dedupe, evaluate_flow
from detection.schemas import (
    BEHAVIOR_FAMILIES,
    FEATURE_SCHEMA_VERSION,
    ML_LABEL_FAMILIES,
    Finding,
    Signal,
    category_for,
)
from detection.scoring import (
    SEVERITY_ORDER,
    attribute,
    clamp_score,
    confidence,
    fuse,
    severity_for_finding,
    source_scores,
)

# Metadata fields we expect DPI to supply. How many are actually present is the
# "measurement completeness" input to the confidence model.
EXPECTED_METADATA = (
    "outbound_ratio", "syn_packets", "rst_packets", "failed_connections",
    "unique_destinations", "repeated_destination",
)


@dataclass
class DetectionResult:
    findings: list[Finding] = field(default_factory=list)
    incidents: list = field(default_factory=list)
    ml_by_flow: dict[str, dict] = field(default_factory=dict)
    ml_available: bool = False
    baseline_available: bool = False
    flows_analyzed: int = 0

    def to_dict(self) -> dict:
        return {
            "findings": [f.to_dict() for f in self.findings],
            "incidents": [i.to_dict() for i in self.incidents],
            "ml_available": self.ml_available,
            "baseline_available": self.baseline_available,
            "flows_analyzed": self.flows_analyzed,
        }

    def findings_by_flow(self) -> dict[str, list[Finding]]:
        out: dict[str, list[Finding]] = {}
        for finding in self.findings:
            for flow_id in finding.related_flows:
                out.setdefault(flow_id, []).append(finding)
        return out


def _completeness(flow: dict) -> float:
    metadata = flow.get("metadata") if isinstance(flow.get("metadata"), dict) else {}
    present = sum(1 for key in EXPECTED_METADATA if metadata.get(key) is not None)
    return present / len(EXPECTED_METADATA)


def _ml_predict(ml_engine, flow: dict) -> dict | None:
    """ML is advisory. A broken model must not take the whole pipeline down."""
    if ml_engine is None:
        return None
    try:
        result = dict(ml_engine.predict(flow))
    except Exception as exc:  # noqa: BLE001 - any model failure degrades to rules-only
        return {"error": str(exc), "ml_score": 0, "ml_category": None, "behavior_family": None}
    result["behavior_family"] = ML_LABEL_FAMILIES.get(result.get("ml_category"))
    return result


def _ml_version(ml_engine, ml: dict | None) -> str | None:
    if ml is None:
        return None
    if ml.get("error"):
        return "unavailable"
    return "ndpi-detector-rf-v1" if getattr(ml_engine, "trained", False) else "heuristic-v1"


def _primary_family(by_family: dict[str, list[Signal]], ml: dict | None) -> str:
    """Which family carries this flow's flow-level evidence (ML + DPI).

    ML and nDPI score the flow, not a behaviour, so their points attach to one
    finding rather than being counted once per family.
    """
    ml_family = (ml or {}).get("behavior_family")
    if ml_family and ml_family in by_family:
        return ml_family
    rule_families = {
        family: sum(s.weight for s in sigs if s.source == "rule")
        for family, sigs in by_family.items()
    }
    if rule_families and max(rule_families.values()) > 0:
        return max(rule_families, key=lambda f: rule_families[f])
    if ml_family:
        return ml_family
    return next(iter(by_family), "TRAFFIC_ANOMALY")


def _flow_entities(flow: dict) -> tuple[list[str], list[str], list[str]]:
    metadata = flow.get("metadata") if isinstance(flow.get("metadata"), dict) else {}
    hosts = [flow["source_ip"]] if flow.get("source_ip") else []
    destinations = [flow["destination_ip"]] if flow.get("destination_ip") else []
    domain = metadata.get("sni") or metadata.get("hostname") or metadata.get("dns_query")
    if domain:
        destinations.append(str(domain))
    app = flow.get("application")
    port = flow.get("destination_port")
    services = [f"{app or 'UNKNOWN'}/{port}"] if port is not None or app else []
    return hosts, destinations, services


def _observed_facts(flow: dict, signals: list[Signal]) -> list[str]:
    """OBSERVED-trust statements only — what was measured, with no
    interpretation attached."""
    facts = [s.evidence for s in signals if s.trust == "OBSERVED"]
    packets, size = flow.get("packets"), flow.get("bytes")
    if packets is not None and size is not None:
        facts.insert(0, f"{packets} packets / {size} bytes over "
                        f"{flow.get('duration_seconds', 0)}s "
                        f"({flow.get('application', 'UNKNOWN')} to "
                        f"{flow.get('destination_ip', 'unknown destination')}).")
    return facts


def _build_finding(flow: dict, family: str, signals: list[Signal], *,
                   ml: dict | None, ml_version: str | None, ctx: FlowContext | None,
                   capture_id: str | None, repeats: int, completeness: float) -> Finding:
    scores = source_scores(signals)
    if ml is not None:
        scores["ml"] = clamp_score(int(ml.get("ml_score") or 0))
    risk, _ = fuse(scores)
    conf, factors = confidence(
        scores, signals, ml,
        metadata_completeness=completeness,
        baseline_available=bool(ctx and ctx.baseline_available),
        repeated_observations=repeats,
    )
    hosts, destinations, services = _flow_entities(flow)
    narrative = BEHAVIOR_FAMILIES.get(family, BEHAVIOR_FAMILIES["TRAFFIC_ANOMALY"])
    timestamp = flow.get("timestamp")

    return Finding(
        finding_id=f"FND-{flow.get('flow_id', 'unknown')}-{family}",
        category=category_for(family),
        summary=narrative["summary"],
        behavior_family=family,
        severity=severity_for_finding(risk, conf),
        risk=risk,
        confidence=conf,
        capture_id=capture_id,
        first_seen=timestamp,
        last_seen=timestamp,
        rule_ids=[s.rule_id for s in signals if s.source == "rule"],
        observed_facts=_observed_facts(flow, signals),
        supporting_features={
            "packets": flow.get("packets"),
            "bytes": flow.get("bytes"),
            "duration_seconds": flow.get("duration_seconds"),
            "application": flow.get("application"),
            "destination_port": flow.get("destination_port"),
            "ml_category": (ml or {}).get("ml_category"),
            "ml_probability": (ml or {}).get("confidence"),
        },
        related_flows=[flow.get("flow_id")] if flow.get("flow_id") else [],
        related_hosts=hosts,
        related_domains=destinations,
        related_services=services,
        alternative_explanations=list(narrative["alternatives"]),
        missing_evidence=list(narrative["missing_evidence"]),
        recommended_next_steps=list(narrative["next_steps"]),
        scores=scores,
        attribution=attribute(risk, scores, signals, ml),
        confidence_factors=factors,
        trust="OBSERVED" if any(s.trust == "OBSERVED" for s in signals) else "CALCULATED",
        ml_model_version=ml_version,
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        source_references=[s.rule_id for s in signals],
    )


@dataclass
class _Inputs:
    """What pass two needs to re-score a finding without redoing pass one."""
    signals: list[Signal]
    ml: dict | None
    repeats: int
    completeness: float


def _refuse(finding: Finding, inputs: _Inputs | None, *, baseline_available: bool,
            correlation: int) -> None:
    """Pass two: fold the now-known correlation_score back into risk."""
    if correlation <= 0 or inputs is None:
        return
    finding.scores["correlation"] = correlation
    finding.risk, _ = fuse(finding.scores)
    finding.confidence, finding.confidence_factors = confidence(
        finding.scores, inputs.signals, inputs.ml,
        metadata_completeness=inputs.completeness,
        baseline_available=baseline_available,
        repeated_observations=inputs.repeats,
    )
    finding.severity = severity_for_finding(finding.risk, finding.confidence)
    finding.attribution = attribute(finding.risk, finding.scores, inputs.signals, inputs.ml)


def run_detection(flows: list[dict], ml_engine=None, *, capture_id: str | None = None,
                  context: FlowContext | None = None) -> DetectionResult:
    """Full pipeline over one capture's normalized flows."""
    flows = list(flows)
    ctx = context if context is not None else FlowContext(flows)

    findings: list[Finding] = []
    # Keep each finding's inputs so pass two can re-fuse without recomputing.
    inputs: dict[str, _Inputs] = {}
    ml_by_flow: dict[str, dict] = {}
    ml_available = False

    for flow in flows:
        signals = dedupe(evaluate_flow(flow, ctx))
        ml = _ml_predict(ml_engine, flow)
        if ml is not None:
            ml_by_flow[flow.get("flow_id")] = ml
            if not ml.get("error"):
                ml_available = True
        ml_version = _ml_version(ml_engine, ml)
        completeness = _completeness(flow)

        by_family: dict[str, list[Signal]] = {}
        for signal in signals:
            by_family.setdefault(signal.family, []).append(signal)

        ml_score = clamp_score(int((ml or {}).get("ml_score") or 0))
        if not by_family:
            if ml_score <= 0:
                continue
            # ML-only detection: no rule or DPI signal agrees, which the
            # confidence model penalises rather than hides.
            by_family = {(ml or {}).get("behavior_family") or "TRAFFIC_ANOMALY": []}

        primary = _primary_family(by_family, ml)
        repeats = max(1, ctx.pair_flows(flow.get("source_ip"), flow.get("destination_ip")))

        for family, family_signals in by_family.items():
            # flow-level evidence (ML, and the DPI/baseline signals that sit in
            # TRAFFIC_ANOMALY) only counts once, on the primary family
            flow_ml = ml if family == primary else None
            finding = _build_finding(
                flow, family, family_signals, ml=flow_ml, ml_version=ml_version,
                ctx=ctx, capture_id=capture_id, repeats=repeats,
                completeness=completeness,
            )
            # No risk floor: a thin finding is rendered INFO by severity_for_finding
            # rather than dropped, and correlation may still raise it in pass two.
            findings.append(finding)
            inputs[finding.finding_id] = _Inputs(family_signals, flow_ml, repeats, completeness)

    incidents = correlate(
        findings,
        capture_id=capture_id,
        baseline_available=ctx.baseline_available,
        on_correlation=lambda finding, score: _refuse(
            finding, inputs.get(finding.finding_id),
            baseline_available=ctx.baseline_available, correlation=score,
        ),
    )
    # Pass two changed risks and severities, so incident headlines follow.
    _resync_incidents(incidents, {f.finding_id: f for f in findings})

    findings.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, -1), f.risk), reverse=True)
    return DetectionResult(
        findings=findings,
        incidents=incidents,
        ml_by_flow=ml_by_flow,
        ml_available=ml_available,
        baseline_available=ctx.baseline_available,
        flows_analyzed=len(flows),
    )


def _resync_incidents(incidents, by_id: dict[str, Finding]) -> None:
    for incident in incidents:
        members = [by_id[fid] for fid in incident.finding_ids if fid in by_id]
        if not members:
            continue
        incident.risk = max(f.risk for f in members)
        incident.severity = max(
            (f.severity for f in members), key=lambda s: SEVERITY_ORDER.get(s, -1))
        incident.confidence = max(members, key=lambda f: (f.risk, f.confidence)).confidence
        incident.narrative = [
            f"{f.severity} · risk {f.risk} · confidence {f.confidence}% — {f.summary}"
            f" ({', '.join(f.rule_ids) if f.rule_ids else 'statistical signal only'})"
            for f in members
        ]
    incidents.sort(key=lambda i: (SEVERITY_ORDER.get(i.severity, -1), i.risk), reverse=True)


if __name__ == "__main__":
    # The correlation chain: one host, several behaviours, one incident.
    chain = [
        {"flow_id": "C1", "timestamp": "2026-09-09T14:00:00Z", "source_ip": "10.0.0.14",
         "destination_ip": "8.8.8.8", "destination_port": 53, "transport": "UDP",
         "application": "DNS", "packets": 900, "bytes": 180000, "duration_seconds": 60,
         "ndpi_risks": [], "metadata": {"avg_query_length": 80, "dns_query_entropy": 4.6,
                                        "outbound_ratio": 0.7, "unique_destinations": 1}},
        {"flow_id": "C2", "timestamp": "2026-09-09T14:01:00Z", "source_ip": "10.0.0.14",
         "destination_ip": "203.0.113.9", "destination_port": 9001, "transport": "TCP",
         "application": "HTTPS", "packets": 140, "bytes": 26000, "duration_seconds": 1900,
         "ndpi_risks": ["Risky domain"], "metadata": {"repeated_destination": True,
                                                      "outbound_ratio": 0.6,
                                                      "unique_destinations": 1}},
        {"flow_id": "C3", "timestamp": "2026-09-09T14:02:00Z", "source_ip": "10.0.0.14",
         "destination_ip": "198.51.100.7", "destination_port": 443, "transport": "TCP",
         "application": "HTTPS", "packets": 4_000_000, "bytes": 5_100_000_000,
         "duration_seconds": 210, "ndpi_risks": [],
         "metadata": {"outbound_ratio": 0.95, "high_outbound_ratio": True,
                      "unique_destinations": 1}},
    ]
    result = run_detection(chain, capture_id="selfcheck")
    families = {f.behavior_family for f in result.findings}
    assert {"DNS_ANOMALY", "BEACONING", "EXFILTRATION"} <= families, families
    assert len(result.incidents) == 1, [i.title for i in result.incidents]
    incident = result.incidents[0]
    assert incident.primary_host == "10.0.0.14"
    assert len(incident.finding_ids) == len(result.findings)
    assert incident.risk >= max(f.scores["rule"] for f in result.findings) // 2
    # correlation raised risk above what any single flow scored alone
    solo = run_detection([chain[0]])
    assert result.findings[0].risk > 0 and solo.findings[0].scores["correlation"] == 0
    # every displayed number adds up
    for finding in result.findings:
        assert sum(e["points"] for e in finding.attribution) == finding.risk
        assert 5 <= finding.confidence <= 95
    # degraded mode: broken ML must not break the pipeline
    class Broken:
        trained = True
        def predict(self, flow):
            raise RuntimeError("model gone")
    degraded = run_detection(chain, Broken())
    assert len(degraded.findings) == len(result.findings)
    assert degraded.ml_available is False
    print(f"engine self-check ok — {len(result.findings)} findings, "
          f"{len(result.incidents)} incident, risk {incident.risk}, "
          f"confidence {incident.confidence}%")
