"""Capture engine tests — dpi/pcap_flows.py.

Every capture here is built byte by byte in this file, so a failure points at
the reader rather than at a fixture nobody can inspect. Three layers:

  1. containers and link layers   — can we read the file at all
  2. coverage accounting          — what we could NOT read is reported (§1.2 E)
  3. capture -> detection         — crafted attack traffic reaches the right rules

Layer 3 is the one that matters for the PRD: a flow field the capture engine
fills in wrongly (query length, outbound ratio, SYN count) silently disarms a
detector, and no amount of parser testing catches that.

Run: python -m pytest tests/test_capture.py -q
"""
from __future__ import annotations

import ipaddress
import itertools
import json
import random
import string
import struct
from pathlib import Path

import pytest

from detection.engine import run_detection
from dpi.ndpi_adapter import NDPIAdapter
from dpi.pcap_flows import (
    ETHERTYPE_IPV4,
    ETHERTYPE_IPV6,
    LINKTYPE_ETHERNET,
    LINKTYPE_IPV6,
    LINKTYPE_LINUX_SLL,
    LINKTYPE_LINUX_SLL2,
    LINKTYPE_NULL,
    LINKTYPE_RAW,
    LINKTYPE_RAW_BSD,
    PCAPNG_EPB,
    PCAPNG_IDB,
    PCAPNG_PB,
    PCAPNG_SHB,
    PCAPNG_SPB,
    extract_capture,
    extract_flows,
)

ROOT = Path(__file__).resolve().parents[1]
SYNTHETIC = ROOT / "data" / "synthetic.pcap"

# Canonical magic values; a writer packs these in the file's own byte order.
MAGIC_US = 0xA1B2C3D4
MAGIC_NS = 0xA1B23C4D

BASE_TIME = 1700000000          # 2023-11-14T22:13:20Z


# ---------------------------------------------------------------------------
# packet builders
# ---------------------------------------------------------------------------

def eth(payload: bytes, ethertype: int = ETHERTYPE_IPV4, vlans: tuple = ()) -> bytes:
    head = b"\x02" * 6 + b"\x03" * 6
    for tpid, vid in vlans:
        head += struct.pack(">HH", tpid, vid)
    return head + struct.pack(">H", ethertype) + payload


def ipv4(payload: bytes, proto: int = 17, src: str = "10.0.0.5", dst: str = "8.8.8.8",
         *, frag_offset: int = 0, options: bytes = b"") -> bytes:
    ihl = 5 + len(options) // 4
    total = ihl * 4 + len(payload)
    return (struct.pack(">BBHHHBBH", 0x40 | ihl, 0, total, 1, frag_offset, 64, proto, 0)
            + ipaddress.IPv4Address(src).packed + ipaddress.IPv4Address(dst).packed
            + options + payload)


def ipv6(payload: bytes, proto: int = 6, src: str = "fd00::1", dst: str = "fd00::2") -> bytes:
    return (struct.pack(">IHBB", 6 << 28, len(payload), proto, 64)
            + ipaddress.IPv6Address(src).packed + ipaddress.IPv6Address(dst).packed + payload)


def udp(payload: bytes, sport: int = 51000, dport: int = 53) -> bytes:
    return struct.pack(">HHHH", sport, dport, 8 + len(payload), 0) + payload


def tcp(payload: bytes = b"", sport: int = 51001, dport: int = 443,
        flags: int = 0x02, options: bytes = b"") -> bytes:
    data_offset = 5 + len(options) // 4
    return (struct.pack(">HHIIBBHHH", sport, dport, 1, 1, data_offset << 4, flags, 8192, 0, 0)
            + options + payload)


def dns_query(name: str) -> bytes:
    labels = b"".join(bytes([len(p)]) + p.encode() for p in name.split("."))
    return (struct.pack(">HHHHHH", 0xABCD, 0x0100, 1, 0, 0, 0)
            + labels + b"\x00" + struct.pack(">HH", 1, 1))


def client_hello(host: str) -> bytes:
    """A real TLS Client Hello, so the SNI path is exercised end to end."""
    name = host.encode()
    sni_ext = (struct.pack(">HH", 0x0000, len(name) + 5) + struct.pack(">H", len(name) + 3)
               + b"\x00" + struct.pack(">H", len(name)) + name)
    body = (b"\x03\x03" + b"\xAA" * 32 + b"\x00" + struct.pack(">H", 2) + b"\x13\x01"
            + b"\x01\x00" + struct.pack(">H", len(sni_ext)) + sni_ext)
    handshake = b"\x01" + len(body).to_bytes(3, "big") + body
    return b"\x16\x03\x01" + struct.pack(">H", len(handshake)) + handshake


# ---------------------------------------------------------------------------
# container builders
# ---------------------------------------------------------------------------

def pcap_bytes(frames, linktype: int = LINKTYPE_ETHERNET, *, endian: str = "<",
               magic: int = MAGIC_US, times=None, snaplen: int | None = None) -> bytes:
    """Classic libpcap. `magic` is the canonical value, packed in `endian` —
    which is exactly how a real capture records its own byte order."""
    tick = 1e-9 if magic == MAGIC_NS else 1e-6
    blob = struct.pack(endian + "IHHiIII", magic, 2, 4, 0, 0, 65535, linktype)
    for i, frame in enumerate(frames):
        ts = BASE_TIME + i if times is None else times[i]
        caplen = min(len(frame), snaplen) if snaplen else len(frame)
        blob += struct.pack(endian + "IIII", int(ts), int(round((ts % 1) / tick)),
                            caplen, len(frame)) + frame[:caplen]
    return blob


def pcapng_bytes(frames, linktypes=(LINKTYPE_ETHERNET,), *, endian: str = "<",
                 tsresol: int = 9, block: int = PCAPNG_EPB, if_ids=None, times=None) -> bytes:
    """pcapng. `tsresol` is the raw if_tsresol option byte, so the 2^-n form
    (high bit set) can be tested alongside the decimal one."""
    per_tick = 2.0 ** -(tsresol & 0x7F) if tsresol & 0x80 else 10.0 ** -tsresol

    bom = 0x1A2B3C4D
    blob = struct.pack(endian + "IIIHHq", PCAPNG_SHB, 28, bom, 1, 0, -1) \
        + struct.pack(endian + "I", 28)

    opts = (struct.pack(endian + "HH", 9, 1) + bytes([tsresol]) + b"\x00" * 3
            + struct.pack(endian + "HH", 0, 0))
    for linktype in linktypes:
        body = struct.pack(endian + "HHI", linktype, 0, 65535) + opts
        blob += (struct.pack(endian + "II", PCAPNG_IDB, 12 + len(body)) + body
                 + struct.pack(endian + "I", 12 + len(body)))

    for i, frame in enumerate(frames):
        ts = BASE_TIME + i if times is None else times[i]
        if_id = 0 if if_ids is None else if_ids[i]
        ticks = int(round(ts / per_tick))
        pad = b"\x00" * ((-len(frame)) % 4)
        if block == PCAPNG_SPB:
            body = struct.pack(endian + "I", len(frame)) + frame + pad
        elif block == PCAPNG_PB:
            body = struct.pack(endian + "HHIIII", if_id, 0, ticks >> 32, ticks & 0xFFFFFFFF,
                               len(frame), len(frame)) + frame + pad
        else:
            body = struct.pack(endian + "IIIII", if_id, ticks >> 32, ticks & 0xFFFFFFFF,
                               len(frame), len(frame)) + frame + pad
        blob += (struct.pack(endian + "II", block, 12 + len(body)) + body
                 + struct.pack(endian + "I", 12 + len(body)))
    return blob


@pytest.fixture
def write(tmp_path):
    """Write a capture blob to a fresh file and return its path."""
    counter = itertools.count()
    def _write(blob: bytes, suffix: str = ".pcap") -> str:
        path = tmp_path / f"c{next(counter)}{suffix}"
        path.write_bytes(blob)
        return str(path)
    return _write


@pytest.fixture
def cap(write):
    """Build -> write -> read back through the capture engine."""
    return lambda blob, suffix=".pcap": extract_capture(write(blob, suffix))


DNS_FRAME = eth(ipv4(udp(dns_query("www.example.com"))))


# ===========================================================================
# 1. containers
# ===========================================================================

@pytest.mark.parametrize("endian,magic,frac_seconds", [
    ("<", MAGIC_US, 0.25),
    (">", MAGIC_US, 0.25),
    ("<", MAGIC_NS, 0.125),
    (">", MAGIC_NS, 0.125),
])
def test_all_four_pcap_magics_read_with_the_right_time_unit(cap, endian, magic, frac_seconds):
    """Byte order and µs/ns both come from the magic. Getting the unit wrong
    shifts every timestamp by 1000x and silently wrecks the rate rules."""
    times = [BASE_TIME, BASE_TIME + frac_seconds]
    capture = cap(pcap_bytes([DNS_FRAME] * 2, endian=endian, magic=magic, times=times))
    assert capture.stats.container == "pcap"
    assert capture.stats.packets_parsed == 2
    assert capture.flows[0]["duration_seconds"] == pytest.approx(frac_seconds, abs=1e-6)


def test_pcap_reads_the_linktype_from_the_global_header(cap):
    """Assuming Ethernet would mis-parse every cooked or raw-IP capture."""
    capture = cap(pcap_bytes([ipv4(udp(dns_query("a.example.com")))], LINKTYPE_RAW))
    assert capture.stats.link_types == ["raw IP"]
    assert capture.flows[0]["application"] == "DNS"


def test_pcapng_enhanced_packet_block(cap):
    capture = cap(pcapng_bytes([DNS_FRAME] * 2), ".pcapng")
    assert capture.stats.container == "pcapng"
    assert capture.flows[0]["timestamp"].startswith("2023-11-14")
    assert capture.flows[0]["duration_seconds"] == 1.0


@pytest.mark.parametrize("tsresol", [6, 9, 0x80 | 10])
def test_pcapng_honours_if_tsresol(cap, tsresol):
    """Decimal and binary resolutions both appear in the wild; both must resolve
    to the same wall-clock time."""
    capture = cap(pcapng_bytes([DNS_FRAME], tsresol=tsresol), ".pcapng")
    assert capture.flows[0]["timestamp"].startswith("2023-11-14T22:13:20")


def test_pcapng_obsolete_packet_block(cap):
    """A Packet Block puts a 2-byte interface id where an EPB puts 4."""
    capture = cap(pcapng_bytes([DNS_FRAME], block=PCAPNG_PB), ".pcapng")
    assert capture.stats.packets_parsed == 1 and capture.flows


def test_pcapng_simple_packet_block_has_no_timestamp(cap):
    """No time in the block means no time in the output — not a made-up one."""
    capture = cap(pcapng_bytes([DNS_FRAME] * 2, block=PCAPNG_SPB), ".pcapng")
    assert capture.stats.packets_parsed == 2
    assert capture.stats.to_dict()["started_at"] is None
    assert capture.flows[0]["duration_seconds"] == 0.0


def test_pcapng_big_endian_section(cap):
    capture = cap(pcapng_bytes([DNS_FRAME], endian=">"), ".pcapng")
    assert capture.stats.packets_parsed == 1
    assert capture.flows[0]["timestamp"].startswith("2023-11-14")


def test_pcapng_packets_follow_their_own_interface(cap):
    """Two interfaces, two link types. Using interface 0's linktype for every
    packet would turn the raw-IP frame into garbage."""
    blob = pcapng_bytes(
        [DNS_FRAME, ipv4(udp(dns_query("b.example.com")))],
        linktypes=(LINKTYPE_ETHERNET, LINKTYPE_RAW),
        if_ids=[0, 1],
    )
    capture = cap(blob, ".pcapng")
    assert capture.stats.packets_parsed == 2
    assert set(capture.stats.link_types) == {"Ethernet", "raw IP"}


# ===========================================================================
# 2. link layers
# ===========================================================================

def test_vlan_and_qinq_tags_are_unwrapped(cap):
    """A fixed 14-byte Ethernet header reads the VLAN id as the ethertype and
    drops the packet — tagged captures used to come out empty."""
    for tags in [((0x8100, 100),), ((0x88A8, 100), (0x8100, 200)), ((0x9100, 7),)]:
        capture = cap(pcap_bytes([eth(ipv4(udp(dns_query("www.example.com"))), vlans=tags)]))
        assert capture.flows, f"tags {tags} dropped: {capture.stats.to_dict()}"
        assert capture.flows[0]["application"] == "DNS"


def test_linux_cooked_v1_and_v2(cap):
    sll = b"\x00\x00\x00\x01" + b"\x00" * 10 + struct.pack(">H", ETHERTYPE_IPV4)
    assert cap(pcap_bytes([sll + ipv4(udp(b"x" * 8))], LINKTYPE_LINUX_SLL)).flows

    sll2 = struct.pack(">H", ETHERTYPE_IPV4) + b"\x00" * 18
    assert cap(pcap_bytes([sll2 + ipv4(udp(b"x" * 8))], LINKTYPE_LINUX_SLL2)).flows


@pytest.mark.parametrize("family,expect_v6", [(2, False), (24, True), (28, True), (30, True)])
def test_null_loopback_address_families(cap, family, expect_v6):
    payload = ipv6(tcp()) if expect_v6 else ipv4(udp(b"x" * 8))
    frame = struct.pack("<I", family) + payload
    flows = cap(pcap_bytes([frame], LINKTYPE_NULL)).flows
    assert flows and (":" in flows[0]["source_ip"]) == expect_v6


def test_null_loopback_written_on_a_big_endian_host(cap):
    frame = struct.pack(">I", 2) + ipv4(udp(b"x" * 8))
    assert cap(pcap_bytes([frame], LINKTYPE_NULL)).flows


@pytest.mark.parametrize("linktype", [LINKTYPE_RAW_BSD, LINKTYPE_RAW, LINKTYPE_IPV6])
def test_raw_ip_linktypes_infer_the_version_from_the_nibble(cap, linktype):
    v4 = cap(pcap_bytes([ipv4(udp(b"x" * 8))], linktype)).flows
    v6 = cap(pcap_bytes([ipv6(tcp())], linktype)).flows
    assert v4[0]["source_ip"] == "10.0.0.5"
    assert v6[0]["source_ip"] == "fd00::1"


def test_unsupported_link_layer_is_counted_not_dropped(cap):
    capture = cap(pcap_bytes([b"\x00" * 60], 105))       # 802.11
    assert capture.stats.skipped["unsupported_link_layer"] == 1
    assert capture.stats.coverage == 0.0
    assert capture.stats.link_types == ["linktype 105"]


# ===========================================================================
# 3. network and transport
# ===========================================================================

def test_ipv6_flow(cap):
    flows = cap(pcap_bytes([eth(ipv6(tcp()), ETHERTYPE_IPV6)])).flows
    assert flows[0]["source_ip"] == "fd00::1"
    assert flows[0]["destination_ip"] == "fd00::2"
    assert flows[0]["transport"] == "TCP"
    assert flows[0]["application"] == "HTTPS"


def test_icmp_and_icmpv6_have_no_ports(cap):
    v4 = cap(pcap_bytes([eth(ipv4(b"\x08\x00" + b"\x00" * 6, proto=1))])).flows
    assert v4[0]["transport"] == "ICMP" and v4[0]["destination_port"] is None

    v6 = cap(pcap_bytes([eth(ipv6(b"\x80\x00" + b"\x00" * 6, proto=58), ETHERTYPE_IPV6)])).flows
    assert v6[0]["transport"] == "ICMPV6"


def test_ipv4_options_do_not_shift_the_transport_header(cap):
    """IHL is in 32-bit words. A hardcoded 20 lands mid-options and reads the
    option bytes as ports."""
    frame = eth(ipv4(udp(dns_query("www.example.com")), options=b"\x01" * 8))
    flows = cap(pcap_bytes([frame])).flows
    assert flows[0]["destination_port"] == 53
    assert flows[0]["metadata"]["dns_query"] == "www.example.com"


def test_tcp_options_do_not_shift_the_payload(cap):
    """Same trap one layer up: the data offset includes TCP options, and a fixed
    20 bytes puts the SNI parser inside the option block."""
    hello = client_hello("www.github.com")
    frame = eth(ipv4(tcp(hello, options=b"\x01" * 12), proto=6))
    flows = cap(pcap_bytes([frame])).flows
    assert flows[0]["application"] == "HTTPS"
    assert flows[0]["metadata"]["sni"] == "www.github.com"
    assert flows[0]["metadata"]["l7_app"] == "GitHub"


def test_syn_ack_is_not_counted_as_a_connection_attempt(cap):
    """SYN|ACK is the server answering. Counting it doubles every SYN-based
    score and makes a normal handshake look like a scan."""
    frames = [eth(ipv4(tcp(flags=0x02), proto=6)),          # SYN
              eth(ipv4(tcp(flags=0x12), proto=6)),          # SYN|ACK
              eth(ipv4(tcp(flags=0x04), proto=6))]          # RST
    metadata = cap(pcap_bytes(frames)).flows[0]["metadata"]
    assert metadata["syn_packets"] == 1
    assert metadata["rst_packets"] == 1


@pytest.mark.parametrize("frame,reason", [
    (eth(b"\x00" * 40, 0x0806), "non_ip"),                              # ARP
    (eth(ipv4(udp(b"x" * 8), frag_offset=185)), "ip_fragment"),
    (eth(ipv4(b"\x00" * 4, proto=6)), "short_l4_header"),
    (eth(ipv4(b"", proto=47)), "unsupported_transport"),                # GRE
    (eth(ipv6(b"\x00" * 8, proto=43), ETHERTYPE_IPV6), "ipv6_extension_header"),
    (eth(b"\x45\x00\x00\x10"), "short_ip_header"),
])
def test_every_unparsed_packet_reports_a_reason(cap, frame, reason):
    capture = cap(pcap_bytes([frame]))
    assert capture.stats.skipped[reason] == 1, capture.stats.to_dict()
    assert capture.flows == []


# ===========================================================================
# 4. flow aggregation
# ===========================================================================

def test_both_directions_land_in_one_flow(cap):
    forward = eth(ipv4(tcp(b"x" * 100, sport=5000, dport=443), proto=6,
                       src="10.0.0.5", dst="93.184.216.34"))
    back = eth(ipv4(tcp(b"y" * 900, sport=443, dport=5000), proto=6,
                    src="93.184.216.34", dst="10.0.0.5"))
    flows = cap(pcap_bytes([forward, back])).flows
    assert len(flows) == 1
    assert flows[0]["source_ip"] == "10.0.0.5"          # the initiator
    assert flows[0]["packets"] == 2
    assert flows[0]["metadata"]["outbound_ratio"] < 0.5
    assert flows[0]["metadata"]["high_outbound_ratio"] is False


def test_outbound_only_transfer_is_flagged_outbound_heavy(cap):
    frames = [eth(ipv4(tcp(b"x" * 1200, sport=5000, dport=443), proto=6,
                       src="10.0.0.5", dst="203.0.113.9"))] * 10
    metadata = cap(pcap_bytes(frames)).flows[0]["metadata"]
    assert metadata["outbound_ratio"] == 1.0
    assert metadata["high_outbound_ratio"] is True


def test_unique_destinations_counts_across_flows(cap):
    frames = [eth(ipv4(tcp(sport=5000 + i, dport=80, flags=0x02), proto=6,
                       src="10.0.0.5", dst=f"10.0.1.{i}")) for i in range(6)]
    flows = cap(pcap_bytes(frames)).flows
    assert len(flows) == 6
    assert all(f["metadata"]["unique_destinations"] == 6 for f in flows)


def test_failed_connections_needs_a_reset(cap):
    """Retries without a reset are just retries; the rules only treat them as
    failures once the peer actually refused."""
    syns = [eth(ipv4(tcp(flags=0x02), proto=6))] * 5
    assert cap(pcap_bytes(syns)).flows[0]["metadata"]["failed_connections"] == 0
    with_rst = cap(pcap_bytes(syns + [eth(ipv4(tcp(flags=0x04), proto=6))]))
    assert with_rst.flows[0]["metadata"]["failed_connections"] == 4


def test_dns_query_stats_measure_the_names_not_the_lengths(cap):
    names = ["aaaa.example.com", "bbbb.example.com"]
    frames = [eth(ipv4(udp(dns_query(n)))) for n in names]
    metadata = cap(pcap_bytes(frames)).flows[0]["metadata"]
    assert metadata["dns_query_count"] == 2
    assert metadata["avg_query_length"] == 16.0
    # entropy of "aaaaexamplecombbbbexamplecom", not of "[16, 16]"
    assert 2.0 < metadata["dns_query_entropy"] < 3.2


def test_flow_shape_matches_the_frozen_schema(write):
    """PRD §19.1 / §27.1: extract_flows is the boundary, and these keys are it."""
    flows = extract_flows(write(pcap_bytes([DNS_FRAME])))
    required = {"flow_id", "timestamp", "source_ip", "destination_ip", "source_port",
                "destination_port", "transport", "application", "packets", "bytes",
                "duration_seconds", "ndpi_risks", "metadata"}
    assert required <= set(flows[0])
    assert flows[0]["ndpi_risks"] == []        # this reader infers no risk flags
    assert flows[0]["flow_id"] == "F-0001"


# ===========================================================================
# 5. coverage honesty (PRD §1.2 Principle E)
# ===========================================================================

def test_coverage_is_the_parsed_fraction_with_reasons(cap):
    frames = [DNS_FRAME, eth(b"\x00" * 40, 0x0806), eth(ipv4(udp(b"x" * 8), frag_offset=9))]
    stats = cap(pcap_bytes(frames)).stats.to_dict()
    assert stats["packets_read"] == 3
    assert stats["packets_parsed"] == 1
    assert stats["coverage"] == 0.333
    assert stats["packets_skipped"] == {"non_ip": 1, "ip_fragment": 1}
    assert stats["flows"] == 1


def test_snapped_frames_are_parsed_but_flagged_truncated(cap):
    """A snaplen that keeps the headers still loses the payload. The flow is
    real, so it is kept — but the DNS name is reported as absent, not guessed."""
    capture = cap(pcap_bytes([DNS_FRAME] * 3, snaplen=54))   # eth+ip+udp = 42
    assert capture.stats.packets_parsed == 3
    assert capture.stats.packets_truncated == 3
    assert capture.flows[0]["application"] == "DNS"          # from the port table
    assert capture.flows[0]["metadata"]["dns_query"] is None


def test_frames_snapped_below_the_transport_header_are_skipped(cap):
    capture = cap(pcap_bytes([DNS_FRAME] * 3, snaplen=40))
    assert capture.stats.packets_parsed == 0
    assert capture.stats.skipped["short_l4_header"] == 3


def test_a_file_cut_mid_record_stops_and_says_so(cap):
    blob = pcap_bytes([DNS_FRAME] * 2)
    capture = cap(blob[:-20])
    assert capture.stats.packets_read == 1
    assert capture.stats.skipped["file_truncated"] == 1
    assert capture.flows


def test_empty_capture_reports_zero_not_a_division_error(cap):
    capture = cap(pcap_bytes([]))
    assert capture.stats.coverage == 0.0
    assert capture.flows == []
    assert capture.stats.to_dict()["duration_seconds"] == 0.0


@pytest.mark.parametrize("blob,message", [
    (b"\xd4\xc3\xb2\xa1" * 3, "too short"),
    (pcap_bytes([], magic=0xDEADBEEF), "magic"),
])
def test_unreadable_files_raise_rather_than_return_nothing(write, blob, message):
    """Zero flows from an unreadable file would be indistinguishable from a
    clean capture. The API turns this into PRD §30's 422 wording."""
    with pytest.raises(ValueError, match=message):
        extract_capture(write(blob))


# ===========================================================================
# 6. adapter boundary (PRD §27.1)
# ===========================================================================

def test_adapter_returns_flows_and_coverage(write):
    path = write(pcap_bytes([DNS_FRAME] * 2))
    adapter = NDPIAdapter()
    adapter.reader_path = None                  # pin mode 3; no nDPI build here

    flows, capture = adapter.analyze_capture(path)
    assert flows == adapter.analyze_pcap(path)  # the frozen signature still works
    assert capture["container"] == "pcap"
    assert capture["coverage"] == 1.0
    assert capture["flows"] == len(flows) == 1


def test_adapter_fixture_mode_reports_unknown_coverage(write, tmp_path):
    """A sidecar JSON has no packets to count. Unknown, not 100%."""
    path = write(pcap_bytes([DNS_FRAME]))
    Path(path).with_suffix(".json").write_text(
        json.dumps([{"flow_id": "F-0001", "timestamp": "2024-01-01T00:00:00+00:00"}]),
        encoding="utf-8")

    adapter = NDPIAdapter()
    adapter.reader_path = None
    flows, capture = adapter.analyze_capture(path)
    assert len(flows) == 1
    assert capture["container"] == "fixture"
    assert capture["coverage"] is None


def test_adapter_raises_on_a_missing_file():
    with pytest.raises(FileNotFoundError):
        NDPIAdapter().analyze_capture("no/such/capture.pcap")


# ===========================================================================
# 7. capture -> detection engine
#
# The point of the capture engine is to feed the detectors. These build attack
# traffic as packets and assert the rules it is supposed to arm actually fire.
# ===========================================================================

def _families(result) -> set[str]:
    return {f.behavior_family for f in result.findings}


def _rule_ids(result) -> set[str]:
    return {rid for f in result.findings for rid in f.rule_ids}


def test_dns_tunneling_capture_reaches_the_dns_rules(cap):
    rng = random.Random(7)
    alphabet = string.ascii_lowercase + string.digits
    frames = []
    for _ in range(60):
        label = "".join(rng.choice(alphabet) for _ in range(52))
        frames.append(eth(ipv4(udp(dns_query(f"{label}.tun.example.com")),
                               src="10.0.0.5", dst="10.0.0.53")))
    # One timestamp: 60 queries inside a second is the rate the rule looks for.
    capture = cap(pcap_bytes(frames, times=[BASE_TIME] * len(frames)))

    metadata = capture.flows[0]["metadata"]
    assert metadata["avg_query_length"] >= 55
    assert metadata["dns_query_entropy"] >= 3.5

    result = run_detection(capture.flows)
    assert "DNS_ANOMALY" in _families(result)
    assert {"DNS_LONG_QUERY", "DNS_HIGH_ENTROPY", "DNS_HIGH_FREQUENCY"} <= _rule_ids(result)


def test_port_scan_capture_reaches_the_recon_rules(cap):
    frames = [eth(ipv4(tcp(sport=40000 + i, dport=20 + i, flags=0x02), proto=6,
                       src="10.0.0.9", dst=f"10.0.2.{i + 1}")) for i in range(20)]
    result = run_detection(cap(pcap_bytes(frames)).flows)

    assert "RECONNAISSANCE" in _families(result)
    assert {"SCAN_MANY_TARGETS", "SCAN_MANY_PORTS"} <= _rule_ids(result)


def test_lateral_movement_capture_reaches_the_lateral_rules(cap):
    """Internal -> internal on SMB, across enough peers to be fan-out."""
    frames = [eth(ipv4(tcp(b"x" * 200, sport=50000 + i, dport=445, flags=0x18), proto=6,
                       src="10.0.0.9", dst=f"10.0.3.{i + 1}")) for i in range(8)]
    result = run_detection(cap(pcap_bytes(frames)).flows)

    assert "LATERAL_MOVEMENT" in _families(result)
    assert {"LATERAL_INTERNAL_ADMIN", "LATERAL_FANOUT"} <= _rule_ids(result)


def test_benign_web_browsing_capture_stays_quiet(cap):
    """The other half of a detector test: normal traffic must not light up.
    A rule that fires on everything has no lift, whatever its recall looks like."""
    frames = []
    for i in range(6):
        hello = client_hello(f"www{i}.example.com")
        frames.append(eth(ipv4(tcp(hello, sport=51000 + i, dport=443, flags=0x18), proto=6,
                              src="10.0.0.5", dst=f"93.184.216.{i + 1}")))
        frames.append(eth(ipv4(tcp(b"y" * 1400, sport=443, dport=51000 + i, flags=0x18), proto=6,
                              src=f"93.184.216.{i + 1}", dst="10.0.0.5")))
    capture = cap(pcap_bytes(frames))
    assert len(capture.flows) == 6

    result = run_detection(capture.flows)
    high = [f for f in result.findings if f.severity in {"HIGH", "CRITICAL"}]
    assert high == [], [f.summary for f in high]


# ===========================================================================
# 8. the real capture, end to end
# ===========================================================================

@pytest.mark.skipif(not SYNTHETIC.exists(), reason="data/synthetic.pcap not generated")
def test_synthetic_pcap_runs_the_whole_pipeline():
    """pcap -> capture engine -> DPI -> rules + ML + baseline -> alerts."""
    from backend.app.services.analysis import analyse_flows
    from backend.app.services.store import store

    adapter = NDPIAdapter()
    adapter.reader_path = None
    flows, capture = adapter.analyze_capture(str(SYNTHETIC))

    assert capture["coverage"] == 1.0, capture
    assert capture["packets_read"] > 1000
    assert len(flows) == capture["flows"] > 100

    s = analyse_flows(flows, capture_id="CAP-test")
    assert s["total_flows"] == len(flows)
    assert s["suspicious_flows"] > 0
    assert store.findings and store.incidents

    alert = next(iter(store.alerts.values()))
    # Detection-engine fields must survive the projection into the alert shape.
    for key in ("confidence", "behavior_family", "attribution", "finding_ids",
                "alternative_explanations", "recommended_next_steps"):
        assert key in alert, alert.keys()
    assert all(fid in store.findings for fid in alert["finding_ids"])
