"""Risk fusion (PRD §26) and a confidence axis (our extension).

Two separate axes, deliberately:

    risk       how bad this would be if the interpretation is right
    confidence how consistent the evidence behind that interpretation is

A finding can be risk 91 / confidence 54 ("looks bad, evidence is thin") or
risk 73 / confidence 93 ("moderate, but we are sure what we saw"). Collapsing
them into one number is the thing this module exists to avoid. Risk and its
severity bands come straight from §26.1/§26.2; the confidence axis is ours.

Fusion is additive with a per-source cap rather than a weighted average. A
weighted average lets a strong single-source signal be diluted into nothing by
the sources that stayed silent; capped addition means one source can only take
you so far and agreement between sources is what reaches CRITICAL. §26.1 sums
rule weights directly; the per-source caps are our tightening of it, and they
are what makes the §26.3 attribution breakdown ("+32 unusual outbound volume,
+11 ML anomaly") add up to the displayed risk.
"""
from __future__ import annotations

from detection.schemas import CONFIDENCE_VERSION, EVIDENCE_SOURCES, FUSION_VERSION

SEVERITY_ORDER = {"INFO": -1, "LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}

# fusion-v1. Caps sum to 130, so reaching 100 requires several sources to agree.
SOURCE_CAPS = {
    "rule": 55,
    "ml": 25,
    "dpi": 20,
    "baseline": 15,
    "correlation": 15,
}

SOURCE_LABELS = {
    "rule": "rule detections",
    "ml": "ML anomaly",
    "dpi": "DPI risk",
    "baseline": "baseline deviation",
    "correlation": "correlated with related activity",
}


def severity_for(score: int) -> str:
    """PRD §26.2 bands, exactly: 0-34 LOW / 35-64 MEDIUM / 65-84 HIGH / 85-100 CRITICAL."""
    if score >= 85:
        return "CRITICAL"
    if score >= 65:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))


def severity_for_finding(risk: int, confidence: int) -> str:
    """Severity considers more than anomaly magnitude (extends §26.2).

    Risk sets the band; very thin evidence pulls a finding down one band and
    demotes the weakest ones to INFO, so a 90-risk guess never renders the same
    as a 90-risk corroborated observation.
    """
    severity = severity_for(risk)
    if confidence < 35 and severity in {"CRITICAL", "HIGH"}:
        severity = {"CRITICAL": "HIGH", "HIGH": "MEDIUM"}[severity]
    if risk < 15 or confidence < 20:
        return "INFO"
    return severity


def source_scores(signals) -> dict[str, int]:
    """Each evidence source scores on its own 0-100 scale before fusion.

    §26.1 sums rule weights directly; bucketing them by source first is ours.
    """
    scores = {source: 0 for source in EVIDENCE_SOURCES}
    for signal in signals:
        if signal.source in scores:
            scores[signal.source] += signal.weight
    return {source: clamp_score(value) for source, value in scores.items()}


def _apportion(total: int, weights: list[float]) -> list[int]:
    """Split `total` into integers proportional to `weights`, summing to exactly
    `total` (largest-remainder). Keeps the attribution breakdown honest: the
    numbers the UI shows add up to the risk it shows."""
    if total <= 0 or not weights:
        return [0] * len(weights)
    positive = sum(w for w in weights if w > 0)
    if positive <= 0:
        return [0] * len(weights)
    raw = [total * max(w, 0.0) / positive for w in weights]
    out = [int(value) for value in raw]
    order = sorted(range(len(raw)), key=lambda i: raw[i] - out[i], reverse=True)
    for i in order[: total - sum(out)]:
        out[i] += 1
    return out


def fuse(scores: dict[str, int]) -> tuple[int, dict[str, float]]:
    """fusion-v1. Returns (risk, raw per-source contribution in risk points)."""
    contributions = {
        source: cap * clamp_score(scores.get(source, 0)) / 100.0
        for source, cap in SOURCE_CAPS.items()
    }
    return clamp_score(round(sum(contributions.values()))), contributions


def attribute(risk: int, scores: dict[str, int], signals, ml: dict | None = None) -> list[dict]:
    """PRD §26.3 risk composition: which evidence bought which points.

    Rule/DPI/baseline points are split across the individual signals that earned
    them so the breakdown names behaviours, not just source buckets. Points sum
    to `risk`.
    """
    _, contributions = fuse(scores)
    entries: list[dict] = []
    weights: list[float] = []

    per_source: dict[str, list] = {}
    for signal in signals:
        per_source.setdefault(signal.source, []).append(signal)

    for source, contribution in contributions.items():
        if contribution <= 0:
            continue
        members = per_source.get(source, [])
        if members:
            total_weight = sum(s.weight for s in members) or 1
            for signal in members:
                entries.append({
                    "source": source,
                    "rule_id": signal.rule_id,
                    "label": signal.title,
                    "points": 0,
                })
                weights.append(contribution * signal.weight / total_weight)
        else:
            label = SOURCE_LABELS.get(source, source)
            if source == "ml" and ml:
                label = f"ML anomaly ({ml.get('ml_category', 'unknown')})"
            entries.append({"source": source, "rule_id": None, "label": label, "points": 0})
            weights.append(contribution)

    for entry, points in zip(entries, _apportion(risk, weights)):
        entry["points"] = points
    entries.sort(key=lambda e: e["points"], reverse=True)
    return entries


def confidence(scores: dict[str, int], signals, ml: dict | None, *,
               metadata_completeness: float, baseline_available: bool,
               repeated_observations: int = 1) -> tuple[int, dict]:
    """confidence-v1 (our extension). Evidence *consistency*, not model probability.

    Deliberately never returns 100: no amount of network telemetry alone
    confirms intent — the §12 wording rule, applied to the number instead of the
    text.
    """
    active = [source for source in EVIDENCE_SOURCES if scores.get(source, 0) > 0]
    families = {s.family for s in signals}
    trust_levels = [s.trust for s in signals]
    observed = sum(1 for t in trust_levels if t == "OBSERVED")

    factors: dict[str, int] = {}
    # number of independent signals
    factors["independent_sources"] = min(30, 12 * max(0, len(active) - 1))
    factors["distinct_signals"] = min(12, 4 * max(0, len(signals) - 1))
    # signal quality: directly observed beats derived
    factors["signal_quality"] = min(14, 5 * observed)
    # measurement completeness
    factors["measurement_completeness"] = round(14 * max(0.0, min(1.0, metadata_completeness)))
    # cross-layer agreement: does ML land on a family a rule also fired on?
    ml_family = (ml or {}).get("behavior_family")
    factors["cross_layer_agreement"] = 14 if ml_family and ml_family in families else 0
    # repeated observation
    factors["repeated_observation"] = min(10, 5 * max(0, repeated_observations - 1))
    # baseline availability
    factors["baseline_available"] = 6 if baseline_available else 0

    # contradictory evidence: ML says benign while rules fired, or the only
    # evidence is a statistical anomaly no rule agrees with.
    penalties: dict[str, int] = {}
    if ml is not None and ml.get("ml_category") == "BENIGN" and scores.get("rule", 0) > 0:
        penalties["ml_disagrees"] = -18
    if scores.get("rule", 0) == 0 and scores.get("dpi", 0) == 0:
        penalties["no_deterministic_signal"] = -15
    if not baseline_available:
        penalties["no_baseline"] = -8

    total = 20 + sum(factors.values()) + sum(penalties.values())
    factors.update(penalties)
    factors["version"] = CONFIDENCE_VERSION
    return max(5, min(95, total)), factors


if __name__ == "__main__":
    from detection.schemas import Signal

    assert severity_for(0) == "LOW" and severity_for(85) == "CRITICAL"
    assert clamp_score(150) == 100 and clamp_score(-5) == 0

    # one strong source cannot reach CRITICAL alone; agreement can
    alone, _ = fuse({"rule": 100})
    agree, _ = fuse({"rule": 100, "ml": 100, "dpi": 100, "baseline": 100, "correlation": 100})
    assert alone == 55, alone
    assert agree == 100, agree

    sigs = [
        Signal("A", "EXFILTRATION", "Large outbound transfer", 25, "e", trust="OBSERVED"),
        Signal("B", "EXFILTRATION", "High outbound volume", 15, "e"),
        Signal("C", "TRAFFIC_ANOMALY", "nDPI risk", 25, "e", source="dpi", trust="OBSERVED"),
    ]
    scores = source_scores(sigs)
    assert scores == {"rule": 40, "ml": 0, "dpi": 25, "baseline": 0, "correlation": 0}, scores
    risk, _ = fuse({**scores, "ml": 60})
    breakdown = attribute(risk, {**scores, "ml": 60}, sigs, ml={"ml_category": "DATA_EXFILTRATION"})
    assert sum(e["points"] for e in breakdown) == risk, breakdown
    assert any(e["source"] == "ml" for e in breakdown)

    # risk and confidence move independently
    thin, _ = confidence({"ml": 90}, [], {"ml_category": "DOS"},
                         metadata_completeness=0.2, baseline_available=False)
    solid, f = confidence({"rule": 60, "ml": 60, "dpi": 40}, sigs,
                          {"ml_category": "DATA_EXFILTRATION", "behavior_family": "EXFILTRATION"},
                          metadata_completeness=1.0, baseline_available=True,
                          repeated_observations=3)
    assert thin < solid < 96, (thin, solid)
    assert f["cross_layer_agreement"] == 14
    assert severity_for_finding(90, 15) == "INFO"      # evidence too thin to rank
    assert severity_for_finding(90, 30) == "HIGH"      # demoted from CRITICAL
    assert severity_for_finding(90, 80) == "CRITICAL"
    print(f"scoring self-check ok ({FUSION_VERSION}, {CONFIDENCE_VERSION})")
