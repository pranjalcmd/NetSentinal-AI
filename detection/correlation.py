"""Correlation engine — our extension; the PRD has no correlation section.

Turns isolated findings into incident candidates. The case it exists for: one
host produces a DNS anomaly, periodic TLS and a large outbound transfer. That is
five alerts in a naive tool and one story here. §23 REPEATED_DESTINATION is the
closest the PRD gets, and it says a repeated destination is "a correlation
indicator ... avoid using it as a sole high-confidence malicious signal" — which
is the principle this module generalises.

Grouping is by (primary host, time bucket): those are the two dimensions that
hold across all behaviour families — grouping by destination or protocol would
split exactly the chains this engine exists to join. Destination, domain,
protocol, family and graph neighbourhood are recorded on the incident and drive
the narrative order and the correlation score instead.
"""
from __future__ import annotations

from datetime import datetime, timezone

from detection.schemas import (
    BEHAVIOR_FAMILIES,
    Incident,
    fingerprint,
    now_iso,
)
from detection.scoring import SEVERITY_ORDER, clamp_score, severity_for_finding

TIME_BUCKET_SECONDS = 300

# A story is worth more than its parts: each extra independent behaviour family
# on the same host is what turns "an anomaly" into "a sequence".
CORRELATION_PER_FAMILY = 25
CORRELATION_PER_EXTRA_FINDING = 8

# Narrative order — how an intrusion tends to read, so the story is not just
# findings in arrival order.
FAMILY_ORDER = [
    "RECONNAISSANCE",
    "CREDENTIAL_ACCESS",
    "UNEXPECTED_SERVICE",
    "DNS_ANOMALY",
    "SUSPICIOUS_ENCRYPTED",
    "BEACONING",
    "LATERAL_MOVEMENT",
    "EXFILTRATION",
    "FLOOD",
    "TRAFFIC_ANOMALY",
]


def _epoch(timestamp) -> float | None:
    if not timestamp:
        return None
    try:
        text = str(timestamp).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except ValueError:
        return None


def time_bucket(timestamp) -> str:
    """Coarse time key. Findings with no usable timestamp share one bucket
    rather than each becoming its own incident."""
    seconds = _epoch(timestamp)
    if seconds is None:
        return "unbucketed"
    return str(int(seconds // TIME_BUCKET_SECONDS))


def group_key(finding) -> tuple[str, str]:
    host = finding.related_hosts[0] if finding.related_hosts else "unknown-host"
    return host, time_bucket(finding.first_seen)


def correlation_score(findings) -> int:
    """The `correlation` fusion source (detection/scoring.py), computed per group."""
    if len(findings) < 2:
        return 0
    families = {f.behavior_family for f in findings}
    score = CORRELATION_PER_FAMILY * (len(families) - 1)
    score += CORRELATION_PER_EXTRA_FINDING * (len(findings) - len(families))
    return clamp_score(score)


def _ordered(findings):
    return sorted(
        findings,
        key=lambda f: (
            FAMILY_ORDER.index(f.behavior_family) if f.behavior_family in FAMILY_ORDER else 99,
            -f.risk,
        ),
    )


def _title(host: str, findings) -> str:
    if len(findings) == 1:
        return f"{findings[0].summary} — {host}"
    lead = _ordered(findings)[0]
    return f"{len(findings)} correlated findings on {host}, starting with {lead.summary.lower()}"


def _narrative(findings) -> list[str]:
    """The story, one step per finding, in intrusion order. Plain observations —
    the AI layer later interprets these, it does not get to invent them (§45:
    "Do not invent facts")."""
    return [
        f"{f.severity} · risk {f.risk} · confidence {f.confidence}% — {f.summary}"
        f" ({', '.join(f.rule_ids) if f.rule_ids else 'statistical signal only'})"
        for f in _ordered(findings)
    ]


def _root_hypothesis(findings) -> str:
    ordered = _ordered(findings)
    families = list(dict.fromkeys(f.behavior_family for f in ordered))
    if len(families) == 1:
        return BEHAVIOR_FAMILIES.get(families[0], {}).get(
            "summary", "Anomalous behaviour of undetermined type")
    chain = " then ".join(
        BEHAVIOR_FAMILIES.get(family, {}).get("summary", family).lower() for family in families
    )
    return f"A single host shows {chain}. Whether these share one cause is not established by traffic alone."


def _impact(severity: str, findings) -> str:
    hosts = {h for f in findings for h in f.related_hosts}
    destinations = {d for f in findings for d in f.related_domains}
    scope = f"{len(hosts)} host(s) and {len(destinations)} external destination(s) observed"
    if severity in {"CRITICAL", "HIGH"}:
        return (f"If the leading hypothesis holds, impact is significant: {scope}. "
                "Endpoint and authentication evidence is required to size actual impact.")
    if severity == "MEDIUM":
        return f"Potential impact is limited on current evidence: {scope}."
    return f"No impact established: {scope}."


def _evidence_coverage(findings, *, baseline_available: bool) -> tuple[int, str]:
    """Is this case actually investigable, separate from how bad it looks?

    Our extension — the PRD scores severity, not investigability.
    """
    checks = {
        "host_attribution": any(f.related_hosts for f in findings),
        "destination_attribution": any(f.related_domains for f in findings),
        "protocol_visibility": any(f.related_services for f in findings),
        "deterministic_signal": any(f.rule_ids for f in findings),
        "baseline": baseline_available,
        "corroboration": len({f.behavior_family for f in findings}) > 1,
    }
    coverage = round(100 * sum(checks.values()) / len(checks))
    readiness = "READY" if coverage >= 80 else "PARTIAL" if coverage >= 50 else "LIMITED"
    return coverage, readiness


def correlate(findings, *, capture_id: str | None = None,
              baseline_available: bool = False, on_correlation=None) -> list[Incident]:
    """Group findings into incidents and stamp incident ids onto them.

    `on_correlation` is an optional callback `(finding, correlation_score) -> None`
    used by the engine to re-fuse each finding once its correlation_score is known —
    correlation is one of the five fusion sources, so it has to feed back into
    risk rather than only decorate the group.
    """
    groups: dict[tuple[str, str], list] = {}
    for finding in findings:
        groups.setdefault(group_key(finding), []).append(finding)

    incidents: list[Incident] = []
    for (host, bucket), members in sorted(groups.items()):
        score = correlation_score(members)
        if on_correlation is not None:
            for finding in members:
                on_correlation(finding, score)

        families = list(dict.fromkeys(f.behavior_family for f in _ordered(members)))
        destinations = list(dict.fromkeys(d for f in _ordered(members) for d in f.related_domains))
        hosts = list(dict.fromkeys(h for f in members for h in f.related_hosts))
        seen = [f.first_seen for f in members if f.first_seen]
        last = [f.last_seen for f in members if f.last_seen]

        risk = max(f.risk for f in members)
        top = max(members, key=lambda f: (f.risk, f.confidence))
        severity = max(
            (f.severity for f in members),
            key=lambda s: SEVERITY_ORDER.get(s, -1),
        )
        coverage, readiness = _evidence_coverage(members, baseline_available=baseline_available)
        finger = fingerprint(hosts + destinations, families, bucket)

        incident = Incident(
            incident_id=f"INC-{finger}",
            fingerprint=finger,
            title=_title(host, members),
            severity=severity,
            risk=risk,
            confidence=top.confidence,
            capture_ids=[capture_id] if capture_id else [],
            started_at=min(seen) if seen else None,
            last_activity_at=max(last) if last else None,
            primary_host=host if host != "unknown-host" else None,
            primary_destination=destinations[0] if destinations else None,
            finding_ids=[f.finding_id for f in _ordered(members)],
            entity_ids=hosts + destinations,
            behavior_families=families,
            narrative=_narrative(members),
            root_hypothesis=_root_hypothesis(members),
            alternatives=list(dict.fromkeys(
                alt for f in _ordered(members) for alt in f.alternative_explanations)),
            impact_assessment=_impact(severity, members),
            recommendations=list(dict.fromkeys(
                step for f in _ordered(members) for step in f.recommended_next_steps)),
            missing_evidence=list(dict.fromkeys(
                gap for f in _ordered(members) for gap in f.missing_evidence)),
            readiness=readiness,
            evidence_coverage=coverage,
        )
        for finding in members:
            finding.incident_id = incident.incident_id
            finding.updated_at = now_iso()
        incidents.append(incident)

    incidents.sort(key=lambda i: (SEVERITY_ORDER.get(i.severity, -1), i.risk), reverse=True)
    return incidents


if __name__ == "__main__":
    from detection.schemas import Finding

    def _finding(fid, family, risk, host="10.0.0.14", ts="2026-09-09T14:00:00Z", dest="203.0.113.5"):
        return Finding(
            finding_id=fid, category=family, summary=f"{family} on {host}",
            behavior_family=family, risk=risk, confidence=70,
            severity=severity_for_finding(risk, 70), first_seen=ts, last_seen=ts,
            related_hosts=[host], related_domains=[dest], rule_ids=[f"R_{family}"],
            alternative_explanations=[f"benign {family}"], missing_evidence=["endpoint data"],
            recommended_next_steps=[f"check {family}"],
        )

    chain = [
        _finding("F1", "DNS_ANOMALY", 45),
        _finding("F2", "BEACONING", 55),
        _finding("F3", "EXFILTRATION", 80),
        _finding("F4", "RECONNAISSANCE", 30, host="10.0.0.99"),
    ]
    incidents = correlate(chain, baseline_available=True)
    assert len(incidents) == 2, [i.incident_id for i in incidents]
    story = next(i for i in incidents if i.primary_host == "10.0.0.14")
    assert len(story.finding_ids) == 3
    # narrative is ordered recon -> dns -> beacon -> exfil, not by arrival
    assert story.finding_ids == ["F1", "F2", "F3"]
    assert story.behavior_families == ["DNS_ANOMALY", "BEACONING", "EXFILTRATION"]
    assert story.risk == 80 and story.severity == "HIGH"
    assert correlation_score(chain[:3]) == 50
    assert correlation_score(chain[:1]) == 0
    assert all(f.incident_id for f in chain)
    # same behaviour, same host, same window -> same fingerprint (dedup)
    again = correlate([_finding("F5", "DNS_ANOMALY", 45), _finding("F6", "BEACONING", 55),
                       _finding("F7", "EXFILTRATION", 80)], baseline_available=True)
    assert again[0].fingerprint == story.fingerprint
    print("correlation self-check ok")
