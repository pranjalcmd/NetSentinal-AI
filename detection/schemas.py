"""Detection data models.

What the PRD actually fixes: the flow and alert shapes (§19.1, §19.2) and the
severity bands (§26.2). Everything else here — Finding and Incident as separate
records, behaviour families, trust levels, readiness, the version stamps — is
our extension on top of the §20 rule engine. Those carry no section number on
purpose: inventing one would be a claim the PRD does not make (§1.2 E).

Plain dataclasses on purpose. `detection/` is a pure library imported by the
backend, the offline scripts and (later) the sensor, so it stays free of
pydantic/FastAPI. The backend converts to its own API schemas at the edge.
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

# --- versions (our own model/rule/fusion stamps; not a PRD schema) ------------
RULE_VERSION = "rules-v2"
RULE_CONFIG_VERSION = "thresholds-v2"
FUSION_VERSION = "fusion-v1"
CONFIDENCE_VERSION = "confidence-v1"
CORRELATION_VERSION = "correlation-v1"
# Must stay equal to ml.detection_engine.FEATURE_VERSION; tests/detection/test_engine.py pins it.
FEATURE_SCHEMA_VERSION = "ndpi-flow-v1"

# --- findings taxonomy ---------------------------------------------------------
# The PRD's alert (§19.2) carries a free-text title and a rule id, not a category.
# These are ours: a closed vocabulary so the UI can group and the AI layer can be
# constrained to pick from a list instead of naming a threat of its own.
CATEGORIES = (
    "COMMAND_AND_CONTROL",
    "DNS_ANOMALY",
    "RECONNAISSANCE",
    "LATERAL_MOVEMENT",
    "EXFILTRATION",
    "DENIAL_OF_SERVICE",
    "UNEXPECTED_SERVICE",
    "TRAFFIC_ANOMALY",
    "POLICY_VIOLATION",
    "CREDENTIAL_ACCESS",
    "UNKNOWN_SUSPICIOUS_BEHAVIOR",
)

# --- severity bands (PRD §26.2) ------------------------------------------------
SEVERITIES = ("INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL")

# --- incident statuses (our extension; the PRD stops at the §19.2 alert) -------
INCIDENT_STATUSES = (
    "NEW", "TRIAGE", "INVESTIGATING", "CONFIRMED",
    "BENIGN", "FALSE_POSITIVE", "RESOLVED", "CLOSED",
)

# --- trust model (our extension: how much to believe each field) ---------------
TRUST_LEVELS = ("OBSERVED", "CALCULATED", "INFERRED", "AI_INTERPRETED", "ANALYST_CONFIRMED")

# --- investigation readiness (our extension) -----------------------------------
READINESS = ("READY", "PARTIAL", "LIMITED")

# Evidence sources scored separately before fusion. §26.1 sums rule weights; the
# per-source split (ml/dpi/baseline/correlation) is ours.
EVIDENCE_SOURCES = ("rule", "ml", "dpi", "baseline", "correlation")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --- behaviour families --------------------------------------------------------
# The PRD names five rules (§21–§25) plus DNS_HIGH_FREQUENCY (§20.1). These nine
# families are the layer above: several rules can land in one family, and the
# family is what an analyst actually triages. `summary` follows the §12 wording
# rule — "Possible X", never "X confirmed". The narrative fields fill a Finding's
# alternative_explanations / missing_evidence / recommended_next_steps, so they
# live with the family definition rather than being invented per finding at
# report time.
BEHAVIOR_FAMILIES: dict[str, dict] = {
    "BEACONING": {
        "category": "COMMAND_AND_CONTROL",
        "summary": "Possible periodic command-and-control style communication",
        "alternatives": [
            "Scheduled software update, telemetry or monitoring agent check-in.",
            "Cloud sync client polling a fixed endpoint on a timer.",
        ],
        "missing_evidence": [
            "Process ownership on the source host for this connection.",
            "Ownership or reputation data for the destination address.",
            "A longer capture window to confirm the interval stays stable.",
        ],
        "next_steps": [
            "Identify the process on the source host that owns this connection.",
            "Check whether the destination is an approved vendor endpoint.",
            "Extend the capture window and re-check interval stability.",
        ],
    },
    "DNS_ANOMALY": {
        "category": "DNS_ANOMALY",
        "summary": "Possible DNS tunneling or other abnormal DNS usage",
        "alternatives": [
            "Endpoint security or reputation product that encodes lookups in DNS.",
            "Misconfigured resolver retrying aggressively.",
            "Content-delivery or anti-spam product with long generated hostnames.",
        ],
        "missing_evidence": [
            "DNS response codes and NXDOMAIN ratio for these queries.",
            "The authoritative name server for the parent domain.",
            "Unique-subdomain count over a longer window.",
        ],
        "next_steps": [
            "Review the parent domain's ownership and registration age.",
            "Collect resolver logs for this client to obtain response codes.",
            "Confirm whether an approved product uses DNS as a transport here.",
        ],
    },
    "RECONNAISSANCE": {
        "category": "RECONNAISSANCE",
        "summary": "Possible port scanning or network reconnaissance",
        "alternatives": [
            "Authorised vulnerability scanner or asset-discovery sweep.",
            "Monitoring system health-checking a range of hosts and ports.",
        ],
        "missing_evidence": [
            "Change-management record for an authorised scan in this window.",
            "Identity of the account or tool driving the source host.",
        ],
        "next_steps": [
            "Check whether an authorised scan was scheduled for this window.",
            "Confirm the source host's owner and expected role.",
        ],
    },
    "LATERAL_MOVEMENT": {
        "category": "LATERAL_MOVEMENT",
        "summary": "Possible lateral movement between internal hosts",
        "alternatives": [
            "Administrator performing routine remote management.",
            "Backup, patching or configuration-management agent fan-out.",
        ],
        "missing_evidence": [
            "Authentication logs for the destination hosts.",
            "Whether these host-to-host relationships existed before this capture.",
        ],
        "next_steps": [
            "Correlate with authentication logs on the destination hosts.",
            "Confirm whether the source host is an approved management station.",
        ],
    },
    "EXFILTRATION": {
        "category": "EXFILTRATION",
        "summary": "Possible unauthorised outbound data transfer",
        "alternatives": [
            "Approved cloud backup, sync or off-site replication job.",
            "Large legitimate upload (media, dataset, build artefact).",
        ],
        "missing_evidence": [
            "Whether the destination is an approved storage or backup provider.",
            "Whether a transfer of this size is scheduled for this host.",
            "File-level or endpoint context for what was sent.",
        ],
        "next_steps": [
            "Identify the destination's owner and whether it is approved.",
            "Check backup and sync schedules for this host and time window.",
            "Review endpoint telemetry for the process performing the transfer.",
        ],
    },
    "FLOOD": {
        "category": "DENIAL_OF_SERVICE",
        "summary": "Possible flood or denial-of-service style traffic",
        "alternatives": [
            "Load test or performance benchmark against the destination.",
            "Application retry storm caused by an upstream outage.",
            "Backup or replication burst compressed into a short window.",
        ],
        "missing_evidence": [
            "Availability metrics for the destination service during this window.",
            "Whether a load test was authorised for this window.",
        ],
        "next_steps": [
            "Check whether the destination service degraded during this window.",
            "Confirm whether a load test or planned burst was scheduled.",
        ],
    },
    "UNEXPECTED_SERVICE": {
        "category": "UNEXPECTED_SERVICE",
        "summary": "Traffic to an unexpected or legacy service",
        "alternatives": [
            "Legacy equipment that legitimately requires a cleartext protocol.",
            "Vendor appliance using a non-standard management port.",
        ],
        "missing_evidence": [
            "Asset inventory entry for the destination and its expected services.",
            "Whether this service is documented as an accepted exception.",
        ],
        "next_steps": [
            "Confirm the destination's role in the asset inventory.",
            "Check whether the protocol is an accepted exception, and if credentials cross the network in cleartext.",
        ],
    },
    "CREDENTIAL_ACCESS": {
        "category": "CREDENTIAL_ACCESS",
        "summary": "Possible repeated authentication attempts against a remote-access service",
        "alternatives": [
            "Misconfigured client or expired credential retrying automatically.",
            "Service account whose password was rotated without updating a caller.",
            "Monitoring probe that authenticates on every poll.",
        ],
        "missing_evidence": [
            "Authentication logs distinguishing failed from successful attempts.",
            "Whether any attempt eventually succeeded.",
        ],
        "next_steps": [
            "Pull authentication logs for the destination service in this window.",
            "Determine whether any attempt succeeded and from which account.",
        ],
    },
    "SUSPICIOUS_ENCRYPTED": {
        "category": "TRAFFIC_ANOMALY",
        "summary": "Encrypted traffic with an unusual destination or shape",
        "alternatives": [
            "A legitimate service this environment simply has not used before.",
            "Newly deployed application or a CDN edge that changed address.",
        ],
        "missing_evidence": [
            "Server name indication or certificate metadata for the session.",
            "Historical baseline showing whether this destination is genuinely new.",
        ],
        "next_steps": [
            "Retrieve SNI or certificate metadata for the destination.",
            "Compare against a longer historical baseline before escalating.",
        ],
        # §25 NDPI_RISK is the closest named rule: encryption alone is never the finding.
    },
    "TRAFFIC_ANOMALY": {
        "category": "TRAFFIC_ANOMALY",
        "summary": "Traffic anomaly without a matching rule signature",
        "alternatives": [
            "Normal but uncommon application behaviour for this environment.",
            "Capture artefact such as a truncated or partially observed session.",
        ],
        "missing_evidence": [
            "A rule-level or DPI-level signal corroborating the statistical anomaly.",
            "Baseline history for this host and destination.",
        ],
        "next_steps": [
            "Review the flow against the host's normal behaviour.",
            "Treat as context until a second independent signal appears.",
        ],
    },
}

# ML label (ml.detection_engine.THREAT_LABELS) -> behaviour family.
ML_LABEL_FAMILIES = {
    "DNS_TUNNELING": "DNS_ANOMALY",
    "PORT_SCAN": "RECONNAISSANCE",
    "DOS": "FLOOD",
    "BOTNET": "BEACONING",
    "BRUTE_FORCE": "CREDENTIAL_ACCESS",
    "DATA_EXFILTRATION": "EXFILTRATION",
    "SUSPICIOUS_LEGACY_SERVICE": "UNEXPECTED_SERVICE",
    "SUSPICIOUS_TRAFFIC": "TRAFFIC_ANOMALY",
    "BENIGN": None,
}


def category_for(family: str) -> str:
    return BEHAVIOR_FAMILIES.get(family, {}).get("category", "UNKNOWN_SUSPICIOUS_BEHAVIOR")


@dataclass
class Signal:
    """One rule/DPI/baseline evidence unit produced before fusion.

    A rule's `weight` is the §26.1 contribution; the PRD sums them directly,
    we group them by source first (see detection/scoring.py).
    """

    rule_id: str
    family: str
    title: str
    weight: int
    evidence: str
    source: str = "rule"          # one of EVIDENCE_SOURCES
    trust: str = "CALCULATED"     # one of TRUST_LEVELS

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Finding:
    """A scored detection record. `risk`/`severity` follow §26; `scores`,
    `attribution` and `confidence_factors` are the §26.3 composition breakdown
    the UI must be able to render instead of one mystery number."""

    finding_id: str
    category: str
    summary: str
    severity: str = "INFO"
    risk: int = 0
    confidence: int = 0
    status: str = "NEW"
    incident_id: str | None = None
    capture_id: str | None = None
    first_seen: str | None = None
    last_seen: str | None = None
    behavior_family: str = "TRAFFIC_ANOMALY"
    rule_ids: list[str] = field(default_factory=list)
    observed_facts: list[str] = field(default_factory=list)
    supporting_features: dict = field(default_factory=dict)
    related_flows: list[str] = field(default_factory=list)
    related_hosts: list[str] = field(default_factory=list)
    related_domains: list[str] = field(default_factory=list)
    related_services: list[str] = field(default_factory=list)
    alternative_explanations: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    recommended_next_steps: list[str] = field(default_factory=list)
    scores: dict = field(default_factory=dict)
    attribution: list[dict] = field(default_factory=list)
    confidence_factors: dict = field(default_factory=dict)
    trust: str = "CALCULATED"
    rule_version: str = RULE_VERSION
    ml_model_version: str | None = None
    feature_schema_version: str = FEATURE_SCHEMA_VERSION
    fusion_version: str = FUSION_VERSION
    source_references: list[str] = field(default_factory=list)
    analyst_notes: str = ""
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Incident:
    """Several findings about one host in one window, grouped into one case.

    Our extension — the PRD's model stops at the individual alert (§19.2).
    """

    incident_id: str
    fingerprint: str
    title: str
    severity: str = "INFO"
    risk: int = 0
    confidence: int = 0
    status: str = "NEW"
    customer_id: str | None = None
    engagement_id: str | None = None
    sensor_ids: list[str] = field(default_factory=list)
    capture_ids: list[str] = field(default_factory=list)
    started_at: str | None = None
    last_activity_at: str | None = None
    primary_host: str | None = None
    primary_destination: str | None = None
    finding_ids: list[str] = field(default_factory=list)
    entity_ids: list[str] = field(default_factory=list)
    behavior_families: list[str] = field(default_factory=list)
    narrative: list[str] = field(default_factory=list)
    root_hypothesis: str = ""
    alternatives: list[str] = field(default_factory=list)
    impact_assessment: str = ""
    recommendations: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    readiness: str = "LIMITED"
    evidence_coverage: int = 0
    analyst_verdict: str | None = None
    correlation_version: str = CORRELATION_VERSION
    created_at: str = field(default_factory=now_iso)
    closed_at: str | None = None
    closed_by: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def fingerprint(entities: list[str], families: list[str], time_bucket: str) -> str:
    """Stable id for an incident: hash(normalized entities + families + time bucket).

    Stable across runs so the same behaviour re-observed in a later capture
    deduplicates onto the same incident.
    """
    parts = "|".join(sorted(set(entities))) + "#" + "|".join(sorted(set(families))) + "#" + time_bucket
    return hashlib.sha1(parts.encode("utf-8")).hexdigest()[:16]


if __name__ == "__main__":
    assert set(ML_LABEL_FAMILIES.values()) - {None} <= set(BEHAVIOR_FAMILIES)
    assert all(f["category"] in CATEGORIES for f in BEHAVIOR_FAMILIES.values())
    assert fingerprint(["a", "b"], ["X"], "t") == fingerprint(["b", "a"], ["X"], "t")
    assert fingerprint(["a"], ["X"], "t") != fingerprint(["a"], ["Y"], "t")
    print("schemas self-check ok")
