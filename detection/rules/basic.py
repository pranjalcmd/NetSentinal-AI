"""Rule detector library.

The PRD names six rules — DNS_HIGH_FREQUENCY (§20.1), DNS_LONG_QUERY (§21),
UNUSUAL_LEGACY_PORT (§22), REPEATED_DESTINATION (§23), HIGH_OUTBOUND_VOLUME
(§24) and NDPI_RISK (§25). The nine behaviour families below implement those and
extend them (beaconing, reconnaissance, lateral movement, flood, credential
access, baseline deviation); the extensions are ours and carry no section
number. Each detector emits `Signal`s — §20's rule engine produces evidence,
scoring/correlation turn those into Findings and Incidents. Nothing here decides
a verdict.

Evidence wording follows the §12 rule: "possible", "consistent with", never
"confirmed". A rule that fires is a reason to look, not a conclusion.

Weights are per evidence source. Signals with the same `source` sum into that
source's 0-100 score, so `rule` weights are calibrated against each other and
`dpi`/`baseline` weights against their own peers — not across sources.

Thresholds are calibrated against data/dataset.json label distributions
(scripts/generate_dataset.py). Bump RULE_CONFIG_VERSION in schemas.py when they
change; old findings record the version that produced them.

`ctx` is a detection.context.FlowContext for the whole capture. It is optional:
without it the cross-flow detectors stay silent rather than guess (§1.2 E —
report less rather than claim more than we measured).
"""
from __future__ import annotations

from typing import Any, Iterable

from detection.context import is_internal
from detection.schemas import Signal
from detection.scoring import clamp_score, severity_for

# --- DNS (§20.1 DNS_HIGH_FREQUENCY, §21 DNS_LONG_QUERY; entropy/subdomain ours) ---
DNS_FREQUENCY_THRESHOLD = 4.0
DNS_LONG_QUERY_THRESHOLD = 55.0
DNS_ENTROPY_THRESHOLD = 3.5          # benign p90 ≈ 3.0, tunneling p10 ≈ 3.7
DNS_SUBDOMAIN_THRESHOLD = 20

# --- beaconing (our extension) ---
BEACON_MIN_DURATION = 300.0
BEACON_MAX_RATE = 2.0
BEACON_MIN_PACKETS = 20
BEACON_MAX_DESTINATIONS = 2
BEACON_MIN_REPEATS = 3
BEACON_MAX_SIZE_CV = 0.25

# --- reconnaissance (our extension) ---
SCAN_TARGET_THRESHOLD = 12
SCAN_PORT_THRESHOLD = 15
SCAN_FAILURE_THRESHOLD = 10
SCAN_FAILURE_RATIO = 0.3
SCAN_SMALL_PACKET_BYTES = 120.0

# --- lateral movement (our extension) ---
LATERAL_FANOUT_THRESHOLD = 5

# --- exfiltration (§24 HIGH_OUTBOUND_VOLUME; sustained-transfer shaping ours) ---
EXFIL_BYTES_THRESHOLD = 50_000_000
EXFIL_OUTBOUND_RATIO = 0.8
EXFIL_MIN_PACKET_SIZE = 400.0        # separates bulk upload from flood traffic
EXFIL_SUSTAINED_SECONDS = 300.0
EXFIL_SUSTAINED_BYTES = 5_000_000

# --- flood (our extension) ---
FLOOD_RATE_THRESHOLD = 500.0
FLOOD_MAX_PACKET_SIZE = 300.0
FLOOD_SYN_THRESHOLD = 1000
FLOOD_SYN_RATIO = 0.4
FLOOD_SOURCE_THRESHOLD = 10
FLOOD_SMALL_PACKET_BYTES = 100.0

# --- credential access (our extension) ---
CREDENTIAL_FAILURE_THRESHOLD = 10
CREDENTIAL_RESET_THRESHOLD = 10
CREDENTIAL_RESET_RATIO = 0.05
CREDENTIAL_MAX_DESTINATIONS = 3

# --- suspicious encrypted (§25 NDPI_RISK is the closest named rule) ---
ENCRYPTED_SMALL_SESSION_PACKETS = 12

# --- baseline (our extension) ---
BASELINE_VOLUME_MULTIPLE = 8.0

LEGACY_PORTS = {23, 2323}
ADMIN_PORTS = {21, 22, 23, 135, 139, 445, 1433, 3306, 3389, 5900, 5985, 5986}
ENCRYPTED_APPS = {"HTTPS", "QUIC", "TLS", "SSL", "TOR"}
WELL_KNOWN_PORTS = {
    20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 119, 123, 135, 137, 138, 139,
    143, 161, 162, 179, 389, 443, 445, 465, 514, 546, 547, 587, 636, 993, 995,
}
COMMON_HIGH_PORTS = {
    1080, 1194, 1433, 1521, 1723, 2049, 3128, 3306, 3389, 5060, 5432, 5900,
    5985, 5986, 6379, 8000, 8080, 8443, 9092, 9200, 11211, 27017,
}


def _to_float(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int) -> int:
    return int(_to_float(value, default))


def _to_int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_metadata(flow: dict) -> dict:
    metadata = flow.get("metadata")
    return metadata if isinstance(metadata, dict) else {}


def _safe_ndpi_risks(flow: dict) -> list:
    risks = flow.get("ndpi_risks")
    return risks if isinstance(risks, list) else []


def _outbound_heavy(metadata: dict, threshold: float) -> bool:
    """True when the flow is outbound-dominated.

    Prefers the measured ratio. When DPI only supplied the boolean flag we use
    that instead of inventing a ratio for it.
    """
    if metadata.get("outbound_ratio") is not None:
        return _to_float(metadata.get("outbound_ratio"), 0.0) >= threshold
    return bool(metadata.get("high_outbound_ratio"))


def _unique_destinations(flow: dict, metadata: dict, ctx) -> int:
    """Distinct destinations this source touched, from DPI or from the capture."""
    if metadata.get("unique_destinations") is not None:
        return _to_int(metadata.get("unique_destinations"), 1)
    if ctx is not None:
        return max(1, ctx.host_unique_destinations(flow.get("source_ip")))
    return 1


# ---------------------------------------------------------------------------
# families
# ---------------------------------------------------------------------------

def _beaconing(flow, metadata, ctx, *, packets, duration, rate, dport) -> list[Signal]:
    out: list[Signal] = []
    src, dst = flow.get("source_ip"), flow.get("destination_ip")

    if metadata.get("repeated_destination", False):
        out.append(Signal(
            "REPEATED_DESTINATION", "BEACONING", "Repeated outbound connection pattern", 15,
            "The source repeatedly contacted the same external destination. "
            "This is a correlation indicator, not proof of malicious intent.",
            trust="OBSERVED",
        ))

    if (duration >= BEACON_MIN_DURATION and rate <= BEACON_MAX_RATE
            and packets >= BEACON_MIN_PACKETS
            and _unique_destinations(flow, metadata, ctx) <= BEACON_MAX_DESTINATIONS):
        out.append(Signal(
            "BEACON_LONG_RELATIONSHIP", "BEACONING", "Long-lived low-rate connection", 18,
            f"The flow lasted {duration:.0f}s at only {rate:.2f} packets/sec against a single "
            "destination. This shape is consistent with a periodic check-in, and equally with "
            "a keepalive or monitoring session.",
        ))

    if ctx is not None and ctx.pair_flows(src, dst) >= BEACON_MIN_REPEATS:
        cv = ctx.pair_size_cv(src, dst)
        if cv is not None and cv <= BEACON_MAX_SIZE_CV:
            out.append(Signal(
                "BEACON_STABLE_PROFILE", "BEACONING", "Repeated sessions of near-identical size", 14,
                f"{ctx.pair_flows(src, dst)} separate sessions to the same destination varied in "
                f"size by only {cv * 100:.0f}%. Automated traffic looks like this; so does a "
                "polling client.",
            ))

    if (dport is not None and dport > 1024 and dport not in COMMON_HIGH_PORTS
            and duration >= BEACON_MIN_DURATION):
        out.append(Signal(
            "BEACON_RARE_PORT", "BEACONING", "Long session on an uncommon high port", 10,
            f"A {duration:.0f}s session ran on port {dport}, which is not a commonly used "
            "service port in this capture. This is weak evidence on its own.",
        ))
    return out


def _dns(flow, metadata, ctx, *, rate) -> list[Signal]:
    out: list[Signal] = []
    if rate > DNS_FREQUENCY_THRESHOLD:
        out.append(Signal(
            "DNS_HIGH_FREQUENCY", "DNS_ANOMALY", "High DNS request frequency", 25,
            f"Observed {rate:.1f} packets/sec on a DNS flow, above the configured "
            f"threshold of {DNS_FREQUENCY_THRESHOLD:.1f} packets/sec. This may indicate "
            "abnormal DNS usage; it does not by itself prove an attack.",
            trust="CALCULATED",
        ))

    avg_query_length = _to_float(metadata.get("avg_query_length"), 0.0)
    if avg_query_length >= DNS_LONG_QUERY_THRESHOLD:
        out.append(Signal(
            "DNS_LONG_QUERY", "DNS_ANOMALY", "Unusually long DNS queries", 20,
            f"Average observed DNS query length is {avg_query_length:.0f} characters, "
            f"at or above the configured threshold of {DNS_LONG_QUERY_THRESHOLD:.0f} characters. "
            "This indicates unusual DNS query characteristics; it does not confirm DNS tunneling.",
            trust="OBSERVED",
        ))

    entropy = _to_float(metadata.get("dns_query_entropy"), 0.0)
    if entropy >= DNS_ENTROPY_THRESHOLD:
        out.append(Signal(
            "DNS_HIGH_ENTROPY", "DNS_ANOMALY", "High character entropy in DNS queries", 20,
            f"Query names carry {entropy:.2f} bits of character entropy, at or above the "
            f"{DNS_ENTROPY_THRESHOLD:.2f} threshold. Encoded payloads look like this; so do "
            "hashed hostnames used by legitimate CDN and security products.",
            trust="CALCULATED",
        ))

    # Optional DPI field — absent on adapters that do not count subdomains, in
    # which case we say nothing rather than assume (§1.2 E).
    if metadata.get("unique_subdomains") is not None:
        subdomains = _to_int(metadata.get("unique_subdomains"), 0)
        if subdomains >= DNS_SUBDOMAIN_THRESHOLD:
            out.append(Signal(
                "DNS_MANY_SUBDOMAINS", "DNS_ANOMALY", "Many unique subdomains queried", 18,
                f"{subdomains} distinct subdomains were queried under the observed parent "
                "domain. High subdomain churn is a tunneling indicator and also a normal "
                "pattern for some cloud services.",
                trust="OBSERVED",
            ))
    return out


def _reconnaissance(flow, metadata, ctx, *, packets, size) -> list[Signal]:
    out: list[Signal] = []
    targets = _unique_destinations(flow, metadata, ctx)
    syn = _to_float(metadata.get("syn_packets"), 0.0)
    failed = _to_float(metadata.get("failed_connections"), 0.0)

    if targets >= SCAN_TARGET_THRESHOLD:
        out.append(Signal(
            "SCAN_MANY_TARGETS", "RECONNAISSANCE", "Many distinct destinations from one source", 25,
            f"The source touched {targets} distinct destinations, at or above the "
            f"{SCAN_TARGET_THRESHOLD} threshold. This is consistent with a sweep, and also "
            "with an authorised scanner or discovery tool.",
            trust="OBSERVED",
        ))

    if ctx is not None and ctx.host_unique_dest_ports(flow.get("source_ip")) >= SCAN_PORT_THRESHOLD:
        ports = ctx.host_unique_dest_ports(flow.get("source_ip"))
        out.append(Signal(
            "SCAN_MANY_PORTS", "RECONNAISSANCE", "Many distinct destination ports from one source", 20,
            f"The source contacted {ports} distinct destination ports in this capture. "
            "Port enumeration produces this pattern.",
            trust="OBSERVED",
        ))

    if (failed >= SCAN_FAILURE_THRESHOLD and failed / max(syn, 1.0) >= SCAN_FAILURE_RATIO
            and targets >= SCAN_TARGET_THRESHOLD // 2):
        out.append(Signal(
            "SCAN_LOW_SUCCESS", "RECONNAISSANCE", "Low successful-session ratio", 20,
            f"{failed:.0f} of {max(syn, 1.0):.0f} connection attempts did not complete. "
            "Scanning produces mostly-failed attempts; so does a client pointed at a "
            "decommissioned range.",
            trust="OBSERVED",
        ))

    if packets and size / packets <= SCAN_SMALL_PACKET_BYTES and packets >= 50 \
            and targets >= SCAN_TARGET_THRESHOLD // 2:
        out.append(Signal(
            "SCAN_SHORT_FLOWS", "RECONNAISSANCE", "Many small packets across several targets", 10,
            f"Mean packet size was {size / packets:.0f} bytes across {packets} packets and "
            f"{targets} destinations — sessions that carried almost no payload.",
            trust="CALCULATED",
        ))
    return out


def _lateral_movement(flow, metadata, ctx, *, dport) -> list[Signal]:
    src, dst = flow.get("source_ip"), flow.get("destination_ip")
    if not (is_internal(src) and is_internal(dst)):
        return []

    out: list[Signal] = []
    if dport in ADMIN_PORTS:
        out.append(Signal(
            "LATERAL_INTERNAL_ADMIN", "LATERAL_MOVEMENT",
            "Internal host-to-host administrative protocol", 25,
            f"Internal host {src} reached internal host {dst} on port {dport}, an "
            "administrative or file-sharing service. Routine administration looks the same "
            "as lateral movement at the network layer.",
            trust="OBSERVED",
        ))

    if ctx is not None:
        fanout = ctx.host_internal_fanout(src)
        # Fan-out alone is just "chatty workstation" — measured at lift 0.9 on
        # the labelled set, i.e. no information. It only means something when the
        # peers are being reached on administrative services.
        if fanout >= LATERAL_FANOUT_THRESHOLD and dport in ADMIN_PORTS:
            out.append(Signal(
                "LATERAL_FANOUT", "LATERAL_MOVEMENT", "Administrative fan-out to internal peers", 20,
                f"{src} contacted {fanout} distinct internal hosts within this capture, "
                f"this one on administrative port {dport}.",
                trust="OBSERVED",
            ))
    return out


def _exfiltration(flow, metadata, ctx, *, packets, size, duration) -> list[Signal]:
    out: list[Signal] = []
    if metadata.get("high_outbound_ratio", False):
        out.append(Signal(
            "HIGH_OUTBOUND_VOLUME", "EXFILTRATION", "Unusually high outbound volume", 15,
            "Outbound byte volume is high relative to the capture baseline. "
            "This may warrant investigation but can also reflect a legitimate large transfer.",
            trust="CALCULATED",
        ))

    mean_packet = size / packets if packets else 0.0
    if (size >= EXFIL_BYTES_THRESHOLD and _outbound_heavy(metadata, EXFIL_OUTBOUND_RATIO)
            and mean_packet >= EXFIL_MIN_PACKET_SIZE):
        out.append(Signal(
            "EXFIL_LARGE_TRANSFER", "EXFILTRATION", "Large outbound transfer", 25,
            f"{size / 1_000_000:.0f} MB left the source in this flow at a mean packet size of "
            f"{mean_packet:.0f} bytes, outbound-dominated. This is the shape of a bulk upload; "
            "whether it is authorised cannot be determined from traffic alone.",
            trust="OBSERVED",
        ))

    if (duration >= EXFIL_SUSTAINED_SECONDS and size >= EXFIL_SUSTAINED_BYTES
            and _outbound_heavy(metadata, EXFIL_OUTBOUND_RATIO)):
        out.append(Signal(
            "EXFIL_SUSTAINED_UPLOAD", "EXFILTRATION", "Sustained outbound session", 14,
            f"An outbound-dominated session ran for {duration:.0f}s carrying "
            f"{size / 1_000_000:.1f} MB.",
        ))
    return out


def _flood(flow, metadata, ctx, *, packets, size, rate) -> list[Signal]:
    out: list[Signal] = []
    mean_packet = size / packets if packets else 0.0
    syn = _to_float(metadata.get("syn_packets"), 0.0)

    if rate >= FLOOD_RATE_THRESHOLD and mean_packet <= FLOOD_MAX_PACKET_SIZE:
        out.append(Signal(
            "FLOOD_CONNECTION_RATE", "FLOOD", "Very high packet rate with small packets", 25,
            f"{rate:.0f} packets/sec at a mean size of {mean_packet:.0f} bytes. Volumetric "
            "floods look like this; so does a load test or a retry storm.",
            trust="CALCULATED",
        ))

    if syn >= FLOOD_SYN_THRESHOLD and packets and syn / packets >= FLOOD_SYN_RATIO:
        out.append(Signal(
            "FLOOD_SYN_CONCENTRATION", "FLOOD", "Traffic dominated by connection attempts", 22,
            f"{syn:.0f} of {packets} packets were connection attempts "
            f"({syn / packets * 100:.0f}%), with few completed sessions.",
            trust="OBSERVED",
        ))

    if ctx is not None and rate >= FLOOD_RATE_THRESHOLD and mean_packet <= FLOOD_MAX_PACKET_SIZE:
        # Source count on its own measures destination *popularity*, not a flood
        # (lift 0.9 on the labelled set). Only counted once the flow already has
        # the flood shape, where it says "distributed" rather than "single host".
        sources = ctx.dest_source_count(flow.get("destination_ip"))
        if sources >= FLOOD_SOURCE_THRESHOLD:
            out.append(Signal(
                "FLOOD_MANY_SOURCES", "FLOOD", "Many sources converging on one destination", 20,
                f"{sources} distinct sources sent traffic to {flow.get('destination_ip')} in "
                "this capture, this flow at a flood-like rate. Note that a popular internal "
                "service under load also looks like this.",
                trust="OBSERVED",
            ))

    if mean_packet and mean_packet <= FLOOD_SMALL_PACKET_BYTES and packets >= 1000:
        out.append(Signal(
            "FLOOD_SMALL_PACKETS", "FLOOD", "High volume of minimal-payload packets", 10,
            f"{packets} packets averaged {mean_packet:.0f} bytes each.",
            trust="CALCULATED",
        ))
    return out


def _unexpected_service(flow, metadata, ctx, *, app, packets, dport) -> list[Signal]:
    out: list[Signal] = []
    if dport in LEGACY_PORTS or app == "TELNET":
        label = dport if dport is not None else app
        out.append(Signal(
            "UNUSUAL_LEGACY_PORT", "UNEXPECTED_SERVICE", "Legacy remote-access port observed", 15,
            f"Destination port {label} is commonly associated with legacy remote-access services. "
            "This observation alone does not confirm malicious activity.",
            trust="OBSERVED",
        ))

    if dport is not None and 0 < dport < 1024 and dport not in WELL_KNOWN_PORTS and packets >= 5:
        out.append(Signal(
            "UNEXPECTED_PRIVILEGED_PORT", "UNEXPECTED_SERVICE",
            "Service on an unexpected privileged port", 14,
            f"Port {dport} is in the privileged range but is not a service this capture "
            "otherwise uses. Inferring a listening service from observed traffic only.",
            trust="INFERRED",
        ))

    if ctx is not None and app == "UNKNOWN" and dport is not None and dport > 1024 \
            and ctx.port_is_rare(dport):
        out.append(Signal(
            "UNEXPECTED_RARE_PORT", "UNEXPECTED_SERVICE", "Unidentified protocol on a rare port", 10,
            f"DPI could not identify the protocol on port {dport}, which appears in only this "
            "flow. Unidentified is not the same as malicious.",
            trust="INFERRED",
        ))
    return out


def _credential_access(flow, metadata, ctx, *, packets, dport) -> list[Signal]:
    if dport not in ADMIN_PORTS:
        return []
    if _unique_destinations(flow, metadata, ctx) > CREDENTIAL_MAX_DESTINATIONS:
        return []  # spread across many hosts — that is scanning, not credential attempts

    out: list[Signal] = []
    failed = _to_float(metadata.get("failed_connections"), 0.0)
    resets = _to_float(metadata.get("rst_packets"), 0.0)

    if failed >= CREDENTIAL_FAILURE_THRESHOLD:
        out.append(Signal(
            "CREDENTIAL_REPEATED_FAILURES", "CREDENTIAL_ACCESS",
            "Repeated failed connections to a remote-access service", 22,
            f"{failed:.0f} connection attempts to port {dport} did not complete while the "
            "source kept retrying the same host. Consistent with repeated authentication "
            "attempts, and with a misconfigured client using a stale credential.",
            trust="OBSERVED",
        ))

    if resets >= CREDENTIAL_RESET_THRESHOLD and packets and resets / packets >= CREDENTIAL_RESET_RATIO:
        out.append(Signal(
            "CREDENTIAL_HIGH_RESET_RATE", "CREDENTIAL_ACCESS",
            "High connection-reset rate on a remote-access service", 14,
            f"{resets:.0f} resets across {packets} packets on port {dport} — sessions are "
            "being torn down rather than completing.",
            trust="OBSERVED",
        ))
    return out


def _suspicious_encrypted(flow, metadata, ctx, *, app, packets) -> list[Signal]:
    """Every signal here needs something beyond "it is encrypted"."""
    if app not in ENCRYPTED_APPS or ctx is None:
        return []

    src, dst = flow.get("source_ip"), flow.get("destination_ip")
    out: list[Signal] = []
    if packets <= ENCRYPTED_SMALL_SESSION_PACKETS and ctx.pair_flows(src, dst) >= BEACON_MIN_REPEATS:
        out.append(Signal(
            "ENCRYPTED_TINY_REPEATED_SESSIONS", "SUSPICIOUS_ENCRYPTED",
            "Repeated very short encrypted sessions", 12,
            f"{ctx.pair_flows(src, dst)} encrypted sessions to the same destination each "
            f"carried {packets} packets or fewer — too little to be a normal transfer.",
            trust="CALCULATED",
        ))
    return out


def _dpi_signals(flow) -> list[Signal]:
    """PRD §25 NDPI_RISK. Source `dpi`, so they score separately from rules."""
    return [
        Signal(
            "NDPI_RISK", "TRAFFIC_ANOMALY", "nDPI reported a flow risk", 25,
            f"nDPI risk indicator observed: {risk}. This is a DPI-level signal that should be "
            "investigated further; it does not by itself confirm compromise.",
            source="dpi", trust="OBSERVED",
        )
        for risk in _safe_ndpi_risks(flow)
    ]


def _baseline_signals(flow, metadata, ctx, *, size) -> list[Signal]:
    """Baseline deviation (our extension). Requires a capture large enough to
    have a baseline at all.

    Only volume deviation lives here. Destination *novelty* was measured at lift
    1.1 (41.7% of benign flows vs 44.6% of attack flows) because a single capture
    has no history — almost every external destination is "new". We make no
    novelty claim until there is a real historical baseline to make it against
    (§1.2 E: claims must match what was actually measured).
    """
    if ctx is None or not ctx.baseline_available:
        return []

    ratio = ctx.volume_ratio_to_baseline(size)
    if ratio < BASELINE_VOLUME_MULTIPLE:
        return []
    return [Signal(
        "BASELINE_VOLUME_DEVIATION", "TRAFFIC_ANOMALY", "Volume far above the capture median", 60,
        f"This flow carried {ratio:.1f}x the median flow size for the capture. Compared "
        "against this capture only — not a historical baseline.",
        source="baseline", trust="CALCULATED",
    )]


# ---------------------------------------------------------------------------
# entry points
# ---------------------------------------------------------------------------

def evaluate_flow(flow: dict, ctx=None) -> list[Signal]:
    """Run every detector over one flow. `ctx` unlocks the cross-flow families."""
    app = (flow.get("application") or "").upper()
    packets = _to_int(flow.get("packets"), 0)
    size = _to_float(flow.get("bytes"), 0.0)
    duration = max(_to_float(flow.get("duration_seconds"), 1.0), 1.0)
    rate = packets / duration
    dport = _to_int_or_none(flow.get("destination_port"))
    metadata = _safe_metadata(flow)

    out: list[Signal] = []
    out += _beaconing(flow, metadata, ctx, packets=packets, duration=duration, rate=rate, dport=dport)
    if app == "DNS":
        out += _dns(flow, metadata, ctx, rate=rate)
    out += _reconnaissance(flow, metadata, ctx, packets=packets, size=size)
    out += _lateral_movement(flow, metadata, ctx, dport=dport)
    out += _exfiltration(flow, metadata, ctx, packets=packets, size=size, duration=duration)
    out += _flood(flow, metadata, ctx, packets=packets, size=size, rate=rate)
    out += _unexpected_service(flow, metadata, ctx, app=app, packets=packets, dport=dport)
    out += _credential_access(flow, metadata, ctx, packets=packets, dport=dport)
    out += _suspicious_encrypted(flow, metadata, ctx, app=app, packets=packets)
    out += _dpi_signals(flow)
    out += _baseline_signals(flow, metadata, ctx, size=size)
    return out


def dedupe(signals: Iterable[Signal]) -> list[Signal]:
    """Drop signals that repeat the same rule with the same evidence text."""
    unique: list[Signal] = []
    seen: set[tuple[str, str]] = set()
    for signal in signals:
        key = (signal.rule_id, signal.evidence)
        if key in seen:
            continue
        seen.add(key)
        unique.append(signal)
    return unique


def build_alert(flow: dict, signals: Iterable[Signal]) -> dict | None:
    """Flat per-flow alert.

    Kept for the rules-only benchmark (scripts/benchmark.py) and as the simplest
    possible consumer of the rule library. The real output of the detection
    engine is detection.engine.run_detection, which fuses sources and correlates.

    Baseline signals are excluded: their weights are calibrated on the baseline
    source's own 0-100 scale, so adding them to rule points would be meaningless.
    """
    unique = [s for s in dedupe(signals) if s.source != "baseline"]
    if not unique:
        return None

    score = clamp_score(sum(s.weight for s in unique))
    return {
        "flow_id": flow["flow_id"],
        "rule_ids": [s.rule_id for s in unique],
        "title": unique[0].title,
        "severity": severity_for(score),
        "risk_score": score,
        "evidence": [s.evidence for s in unique],
    }
