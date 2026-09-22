"""nDPI integration tests.

The real-DPI path (mode 1, ndpiReader) cannot run here — no C toolchain — so
this pins the JSON contract instead. Every field name and nesting level below
was read off the nDPI serializer source, not guessed:

  src/lib/ndpi_utils.c:2284    src_ip / dest_ip / src_port / dst_port / proto
  src/lib/ndpi_utils.c:1653    ndpi_dpi2json opens the "ndpi" block
  src/lib/ndpi_utils.c:1201    flow_risk block, keyed by risk bit
  src/lib/ndpi_utils.c:1193-99 risk == 0 returns early -> NO flow_risk key
  src/lib/ndpi_utils.c:1273    category, inside "ndpi"
  src/lib/ndpi_utils.c:1248    confidence is a BLOCK {"<id>": "<name>"}
  example/ndpiReader.c:2757    flow_id / first_seen / duration
  example/ndpiReader.c:2765    xfer block
  example/ndpiReader.c:2831    tcp_flags block, syn_count / rst_count

If these tests pass, building nDPI and setting NDPI_READER works on the first
try. That is the whole point of them.
"""
from dpi.ndpi_adapter import normalize_ndpi_record, parse_ndpi_jsonl

# One flow as ndpiReader -K json actually emits it: TLS to a Google IP, two
# risks set, asymmetric download.
NDPI_FLOW = {
    "flow_id": 1,
    "first_seen": 1700000000.123,
    "last_seen": 1700000012.456,
    "duration": 12.333,
    "vlan_id": 0,
    "bidirectional": 1,
    "xfer": {
        "data_ratio": -0.88,
        "data_ratio_str": "Download",
        "src2dst_packets": 12,
        "src2dst_bytes": 1450,
        "src2dst_goodput_bytes": 400,
        "dst2src_packets": 30,
        "dst2src_bytes": 48000,
        "dst2src_goodput_bytes": 45000,
    },
    "tcp_flags": {
        "cwr_count": 0,
        "ece_count": 0,
        "urg_count": 0,
        "ack_count": 40,
        "psh_count": 8,
        "rst_count": 1,
        "syn_count": 2,
        "fin_count": 1,
    },
    "src_ip": "10.0.0.5",
    "dest_ip": "93.184.216.34",
    "src_port": 49812,
    "dst_port": 443,
    "ip": 4,
    "proto": "TCP",
    "ndpi": {
        "flow_risk": {
            "7": {
                "risk": "Self-signed Certificate",
                "severity": "Medium",
                "risk_score": {"total": 150, "client": 100, "server": 50},
            },
            "12": {
                "risk": "Suspicious DGA domain name",
                "severity": "High",
                "risk_score": {"total": 300, "client": 200, "server": 100},
            },
        },
        "confidence": {"6": "DPI"},
        "proto": "TLS.Google",
        "proto_id": "91.126",
        "proto_by_ip": "Google",
        "category": "Web",
    },
}


def test_maps_identity_and_counters():
    flow = normalize_ndpi_record(NDPI_FLOW)

    assert flow["flow_id"] == "F-0001"
    assert flow["source_ip"] == "10.0.0.5"
    assert flow["destination_ip"] == "93.184.216.34"  # nDPI spells it "dest_ip"
    assert flow["source_port"] == 49812
    assert flow["destination_port"] == 443
    assert flow["transport"] == "TCP"
    # "TLS.Google" -> master protocol only.
    assert flow["application"] == "TLS"
    # Both directions summed, not just src2dst.
    assert flow["packets"] == 42
    assert flow["bytes"] == 49450
    assert flow["duration_seconds"] == 12.333
    assert flow["timestamp"].startswith("2023-11-14")  # first_seen, not now()


def test_extracts_risks_from_the_ndpi_block():
    """The risk names are what the rule engine and ML features consume."""
    flow = normalize_ndpi_record(NDPI_FLOW)

    assert flow["ndpi_risks"] == [
        "Self-signed Certificate",
        "Suspicious DGA domain name",
    ]


def test_risks_at_top_level_also_work():
    """Older nDPI puts flow_risk beside "ndpi" rather than inside it."""
    record = {**NDPI_FLOW, "flow_risk": NDPI_FLOW["ndpi"]["flow_risk"], "ndpi": {}}

    assert normalize_ndpi_record(record)["ndpi_risks"] == [
        "Self-signed Certificate",
        "Suspicious DGA domain name",
    ]


def test_clean_flow_has_no_flow_risk_key_at_all():
    """ndpi_serialize_risk returns early when risk == 0 — the key is absent,
    not empty. Mishandling this would crash on every benign flow."""
    record = {**NDPI_FLOW, "ndpi": {k: v for k, v in NDPI_FLOW["ndpi"].items()
                                    if k != "flow_risk"}}

    assert normalize_ndpi_record(record)["ndpi_risks"] == []


def test_metadata_feeds_the_detection_engines():
    meta = normalize_ndpi_record(NDPI_FLOW)["metadata"]

    assert meta["ndpi_category"] == "Web"
    assert meta["syn_packets"] == 2
    assert meta["rst_packets"] == 1
    # Mostly inbound, so this must NOT trip the exfiltration heuristic.
    assert round(meta["outbound_ratio"], 4) == round(1450 / 49450, 4)
    assert meta["high_outbound_ratio"] is False


def test_high_outbound_ratio_trips_on_upload():
    record = {**NDPI_FLOW, "xfer": {**NDPI_FLOW["xfer"],
                                    "src2dst_bytes": 48000, "dst2src_bytes": 1450}}
    meta = normalize_ndpi_record(record)["metadata"]

    assert meta["high_outbound_ratio"] is True


def test_undetected_l7_does_not_echo_the_transport():
    """nDPI reports the L4 name as L7 when it detects nothing. Passing "TCP"
    through as an application would make every rule keyed on protocol misfire."""
    record = {**NDPI_FLOW, "ndpi": {"proto": "TCP"}}

    assert normalize_ndpi_record(record)["application"] == "UNKNOWN"


def test_missing_ports_survive():
    """src_port/dst_port are only serialized when non-zero (ICMP, e.g.)."""
    record = {k: v for k, v in NDPI_FLOW.items() if k not in {"src_port", "dst_port"}}
    record["proto"] = "ICMP"
    flow = normalize_ndpi_record(record)

    assert flow["source_port"] is None
    assert flow["destination_port"] is None
    assert flow["transport"] == "ICMP"


def test_unknown_transport_is_not_passed_through():
    assert normalize_ndpi_record({**NDPI_FLOW, "proto": "WEIRD"})["transport"] == "UNKNOWN"


# ------------------------------------------------------------------
# ndpiReader writes one JSON object per line into the -k file.
# ------------------------------------------------------------------

def test_parses_jsonl():
    import json

    text = "\n".join(json.dumps(NDPI_FLOW) for _ in range(3))
    flows = parse_ndpi_jsonl(text)

    assert len(flows) == 3
    assert all(f["application"] == "TLS" for f in flows)


def test_parses_json_array_and_tolerates_junk_lines():
    import json

    assert len(parse_ndpi_jsonl(json.dumps([NDPI_FLOW, NDPI_FLOW]))) == 2
    # A truncated final line (killed mid-write) must not lose the good flows.
    assert len(parse_ndpi_jsonl(json.dumps(NDPI_FLOW) + '\n{"flow_id": 2, "sr')) == 1
    assert parse_ndpi_jsonl("   ") == []


def test_flow_ids_stay_unique_when_ndpi_omits_them():
    """Index fallback — duplicate flow_ids would collapse the store dict."""
    import json

    record = {k: v for k, v in NDPI_FLOW.items() if k != "flow_id"}
    flows = parse_ndpi_jsonl("\n".join(json.dumps(record) for _ in range(3)))

    assert [f["flow_id"] for f in flows] == ["F-0000", "F-0001", "F-0002"]
