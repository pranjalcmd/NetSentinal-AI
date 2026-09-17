"""Capture engine — pcap/pcapng bytes to normalized flows.

Reads classic libpcap *and* pcapng (Wireshark's default since 1.8, and the
extension `/api/analyze/pcap` already advertises), unwraps the link layer
(Ethernet including 802.1Q/QinQ tags, Linux cooked v1/v2, raw IP, BSD
loopback), parses IPv4 and IPv6, and aggregates TCP/UDP/ICMP packets into
bidirectional 5-tuple flows. L7 application identity comes from dpi/l7.py —
the Python port of the Packet_analyzer C++ engine — so TLS SNI, HTTP Host and
DNS query names are read out of the payload rather than guessed from the port.

Whatever the reader cannot understand is *counted*, not hidden. `CaptureStats`
reports how many packets were parsed and why the rest were skipped, so a
capture we only partially read says so instead of presenting a fraction as the
whole (PRD §1.2 Principle E, §30 empty-capture wording).

ponytail: no IP defragmentation, no TCP reassembly, no IPv6 extension-header
walk, no PPP/802.11 link layers — those packets are counted under `skipped`
rather than parsed. Add when a capture that matters needs them. Port lookup
stays the fallback when a flow carries no identifying payload (already
established TLS, no Client Hello in the capture window).

Self-check (from the repo root): python -m dpi.pcap_flows
"""
from __future__ import annotations

import ipaddress
import math
import statistics
import struct
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from dpi.l7 import inspect

# --- container formats ------------------------------------------------------
PCAP_MAGICS = {
    0xA1B2C3D4: ("<", 1e-6),   # little-endian, microseconds
    0xD4C3B2A1: (">", 1e-6),
    0xA1B23C4D: ("<", 1e-9),   # nanosecond variants
    0x4D3CB2A1: (">", 1e-9),
}
PCAPNG_SHB = 0x0A0D0D0A        # section header — also the file's first 4 bytes
PCAPNG_IDB = 0x00000001        # interface description (linktype + resolution)
PCAPNG_PB = 0x00000002         # obsolete packet block
PCAPNG_SPB = 0x00000003        # simple packet block (no timestamp)
PCAPNG_EPB = 0x00000006        # enhanced packet block — the usual one

# --- link layers (tcpdump.org/linktypes.html) -------------------------------
LINKTYPE_NULL = 0
LINKTYPE_ETHERNET = 1
LINKTYPE_RAW_BSD = 12
LINKTYPE_RAW = 101
LINKTYPE_LINUX_SLL = 113
LINKTYPE_IPV4 = 228
LINKTYPE_IPV6 = 229
LINKTYPE_LINUX_SLL2 = 276
RAW_IP_LINKTYPES = frozenset({LINKTYPE_RAW_BSD, LINKTYPE_RAW, LINKTYPE_IPV4, LINKTYPE_IPV6})
LINKTYPE_NAMES = {
    LINKTYPE_NULL: "NULL/loopback", LINKTYPE_ETHERNET: "Ethernet",
    LINKTYPE_RAW_BSD: "raw IP", LINKTYPE_RAW: "raw IP", LINKTYPE_IPV4: "raw IPv4",
    LINKTYPE_IPV6: "raw IPv6", LINKTYPE_LINUX_SLL: "Linux cooked",
    LINKTYPE_LINUX_SLL2: "Linux cooked v2",
}

ETHERTYPE_IPV4 = 0x0800
ETHERTYPE_IPV6 = 0x86DD
VLAN_TPIDS = frozenset({0x8100, 0x88A8, 0x9100})   # 802.1Q, 802.1ad, legacy QinQ

# Next-header values that mean "an extension header follows", not a transport.
IPV6_EXTENSION_HEADERS = frozenset({0, 43, 44, 50, 51, 59, 60, 135})

PORT_APPS = {
    53: "DNS", 80: "HTTP", 443: "HTTPS", 22: "SSH", 21: "FTP", 25: "SMTP",
    23: "TELNET", 2323: "TELNET", 3389: "RDP", 445: "SMB", 123: "NTP",
    67: "DHCP", 68: "DHCP", 8080: "HTTP", 9001: "TOR", 6881: "BITTORRENT",
}


@dataclass
class CaptureStats:
    """What the reader actually understood about a capture.

    Reported to the caller rather than smoothed away: an analysis that only saw
    12% of the packets must not be presented as an analysis of the capture.
    """
    container: str = "unknown"
    link_types: list[str] = field(default_factory=list)
    packets_read: int = 0
    packets_parsed: int = 0
    packets_truncated: int = 0          # snaplen cut the frame — L7 may be partial
    flows: int = 0
    first_timestamp: float | None = None
    last_timestamp: float | None = None
    skipped: Counter = field(default_factory=Counter)

    @property
    def coverage(self) -> float:
        """Fraction of packets that reached flow aggregation."""
        return self.packets_parsed / self.packets_read if self.packets_read else 0.0

    def note_linktype(self, linktype: int) -> None:
        name = LINKTYPE_NAMES.get(linktype, f"linktype {linktype}")
        if name not in self.link_types:
            self.link_types.append(name)

    def note_time(self, ts: float) -> None:
        if not ts:
            return
        self.first_timestamp = ts if self.first_timestamp is None else min(self.first_timestamp, ts)
        self.last_timestamp = ts if self.last_timestamp is None else max(self.last_timestamp, ts)

    def to_dict(self) -> dict[str, Any]:
        span = (self.last_timestamp or 0) - (self.first_timestamp or 0)
        return {
            "container": self.container,
            "link_types": list(self.link_types),
            "packets_read": self.packets_read,
            "packets_parsed": self.packets_parsed,
            "packets_truncated": self.packets_truncated,
            "packets_skipped": dict(self.skipped),
            "coverage": round(self.coverage, 3),
            "flows": self.flows,
            "started_at": _iso(self.first_timestamp),
            "duration_seconds": round(max(span, 0.0), 3),
        }


@dataclass
class Capture:
    flows: list[dict[str, Any]] = field(default_factory=list)
    stats: CaptureStats = field(default_factory=CaptureStats)


def _iso(epoch: float | None) -> str | None:
    if not epoch:
        return None
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Container readers
# ---------------------------------------------------------------------------

def read_packets(path: str, stats: CaptureStats | None = None) -> Iterator[tuple[float, bytes, int]]:
    """Yield (epoch_seconds, frame, linktype) for every packet in the capture.

    `stats`, when given, is filled in as the file is read — the generator is the
    only place that knows the container, the link types and how many frames were
    snapped short, and materializing packets just to return them would defeat
    streaming a large capture.
    """
    data = Path(path).read_bytes()
    if len(data) < 24:
        raise ValueError("file too short to be a network capture")

    if struct.unpack(">I", data[:4])[0] == PCAPNG_SHB:
        yield from _read_pcapng(data, stats)
    else:
        yield from _read_pcap(data, stats)


def _read_pcap(data: bytes, stats: CaptureStats | None) -> Iterator[tuple[float, bytes, int]]:
    magic = struct.unpack("<I", data[:4])[0]
    if magic not in PCAP_MAGICS:
        raise ValueError(f"unrecognized capture magic 0x{magic:08x}")

    endian, tick = PCAP_MAGICS[magic]
    # The global header's `network` field is the link type. Assuming Ethernet
    # here would silently mis-parse every cooked or raw-IP capture.
    linktype = struct.unpack(endian + "I", data[20:24])[0]
    if stats is not None:
        stats.container = "pcap"
        stats.note_linktype(linktype)

    offset = 24
    while offset + 16 <= len(data):
        ts_sec, ts_frac, caplen, origlen = struct.unpack(endian + "IIII", data[offset:offset + 16])
        offset += 16
        if caplen > len(data) - offset:
            if stats is not None:
                stats.skipped["file_truncated"] += 1
            break
        if stats is not None:
            stats.packets_read += 1
            if origlen > caplen:
                stats.packets_truncated += 1
        yield ts_sec + ts_frac * tick, data[offset:offset + caplen], linktype
        offset += caplen


def _read_pcapng(data: bytes, stats: CaptureStats | None) -> Iterator[tuple[float, bytes, int]]:
    """Block-structured pcapng: SHB sets endianness, IDBs describe interfaces,
    packet blocks reference them by index."""
    if stats is not None:
        stats.container = "pcapng"

    endian = "<"
    interfaces: list[tuple[int, float]] = []       # (linktype, seconds per tick)
    offset, n = 0, len(data)

    while offset + 12 <= n:
        block_type = struct.unpack(endian + "I", data[offset:offset + 4])[0]
        if data[offset:offset + 4] == b"\x0a\x0d\x0d\x0a":
            # New section: its byte-order magic decides endianness from here on,
            # and the interface table starts over.
            endian = "<" if data[offset + 8:offset + 12] == b"\x4d\x3c\x2b\x1a" else ">"
            block_type = PCAPNG_SHB
            interfaces = []

        length = struct.unpack(endian + "I", data[offset + 4:offset + 8])[0]
        if length < 12 or offset + length > n:
            if stats is not None:
                stats.skipped["file_truncated"] += 1
            break
        body = data[offset + 8:offset + length - 4]
        offset += length

        if block_type == PCAPNG_IDB and len(body) >= 8:
            linktype = struct.unpack(endian + "H", body[:2])[0]
            interfaces.append((linktype, _timestamp_tick(body[8:], endian)))
            if stats is not None:
                stats.note_linktype(linktype)

        elif block_type in (PCAPNG_EPB, PCAPNG_PB) and len(body) >= 20:
            # A Packet Block has a 2-byte interface id + 2-byte drops where an
            # Enhanced Packet Block has a 4-byte interface id; both then carry
            # ts_high/ts_low/caplen/origlen, so one unpack covers the pair.
            if_id = struct.unpack(endian + ("I" if block_type == PCAPNG_EPB else "H"),
                                  body[:4 if block_type == PCAPNG_EPB else 2])[0]
            ts_hi, ts_lo, caplen, origlen = struct.unpack(endian + "IIII", body[4:20])
            linktype, tick = interfaces[if_id] if if_id < len(interfaces) else (LINKTYPE_ETHERNET, 1e-6)
            if stats is not None:
                stats.packets_read += 1
                if origlen > caplen:
                    stats.packets_truncated += 1
            yield (((ts_hi << 32) | ts_lo) * tick, body[20:20 + caplen], linktype)

        elif block_type == PCAPNG_SPB and len(body) >= 4 and interfaces:
            # No timestamp in this block type; 0.0 means "unknown", and duration
            # falls out as 0 rather than a fabricated time.
            origlen = struct.unpack(endian + "I", body[:4])[0]
            if stats is not None:
                stats.packets_read += 1
            yield 0.0, body[4:4 + origlen], interfaces[0][0]


def _timestamp_tick(options: bytes, endian: str) -> float:
    """Seconds per timestamp unit from an IDB's if_tsresol option (code 9).

    The default is microseconds; a high bit in the value means 2^-n instead of
    10^-n. Getting this wrong shifts every packet time by orders of magnitude,
    which would wreck the rate-based rules downstream.
    """
    offset = 0
    while offset + 4 <= len(options):
        code, length = struct.unpack(endian + "HH", options[offset:offset + 4])
        if code == 0:                                   # opt_endofopt
            break
        value = options[offset + 4:offset + 4 + length]
        if code == 9 and value:
            n = value[0]
            return 2.0 ** -(n & 0x7F) if n & 0x80 else 10.0 ** -n
        offset += 4 + ((length + 3) // 4) * 4           # options are 4-byte padded
    return 1e-6


# ---------------------------------------------------------------------------
# Link layer -> network layer
# ---------------------------------------------------------------------------

def _ip_ethertype(packet: bytes) -> int:
    """Ethertype implied by an IP version nibble, for header-less link types."""
    if not packet:
        return 0
    version = packet[0] >> 4
    return ETHERTYPE_IPV4 if version == 4 else ETHERTYPE_IPV6 if version == 6 else 0


def _strip_link(frame: bytes, linktype: int) -> tuple[int, bytes] | None:
    """(ethertype, network-layer bytes), or None for a link layer we do not read."""
    if linktype == LINKTYPE_ETHERNET:
        if len(frame) < 14:
            return None
        ethertype = struct.unpack(">H", frame[12:14])[0]
        offset = 14
        # 802.1Q/QinQ: each tag is 4 bytes and carries the next ethertype. A
        # fixed offset of 14 reads the VLAN id as the ethertype and drops the
        # packet, which is why tagged captures used to come out empty.
        while ethertype in VLAN_TPIDS and len(frame) >= offset + 4:
            ethertype = struct.unpack(">H", frame[offset + 2:offset + 4])[0]
            offset += 4
        return ethertype, frame[offset:]

    if linktype == LINKTYPE_LINUX_SLL:
        if len(frame) < 16:
            return None
        return struct.unpack(">H", frame[14:16])[0], frame[16:]

    if linktype == LINKTYPE_LINUX_SLL2:
        if len(frame) < 20:
            return None
        return struct.unpack(">H", frame[:2])[0], frame[20:]

    if linktype == LINKTYPE_NULL:
        if len(frame) < 4:
            return None
        family = struct.unpack("<I", frame[:4])[0]
        if family > 0xFFFF:                     # written on a big-endian host
            family = struct.unpack(">I", frame[:4])[0]
        if family == 2:
            return ETHERTYPE_IPV4, frame[4:]
        if family in (24, 28, 30):              # AF_INET6 differs per BSD
            return ETHERTYPE_IPV6, frame[4:]
        return None

    if linktype in RAW_IP_LINKTYPES:
        return _ip_ethertype(frame), frame

    return None


# ---------------------------------------------------------------------------
# Network + transport
# ---------------------------------------------------------------------------

def _parse_packet(ethertype: int, packet: bytes) -> tuple[dict[str, Any] | None, str]:
    """(packet facts, "") on success, or (None, skip reason).

    The reason string is what CaptureStats counts, so an unreadable capture can
    explain itself instead of just returning nothing.
    """
    if ethertype == ETHERTYPE_IPV4:
        if len(packet) < 20:
            return None, "short_ip_header"
        ihl = (packet[0] & 0x0F) * 4
        if ihl < 20 or len(packet) < ihl:
            return None, "short_ip_header"
        if struct.unpack(">H", packet[6:8])[0] & 0x1FFF:
            return None, "ip_fragment"          # no L4 header in a later fragment
        proto = packet[9]
        src = ".".join(str(b) for b in packet[12:16])
        dst = ".".join(str(b) for b in packet[16:20])
        size = struct.unpack(">H", packet[2:4])[0] or len(packet)
        l4 = packet[ihl:]
    elif ethertype == ETHERTYPE_IPV6:
        if len(packet) < 40:
            return None, "short_ip_header"
        proto = packet[6]
        if proto in IPV6_EXTENSION_HEADERS:
            return None, "ipv6_extension_header"
        src = str(ipaddress.IPv6Address(packet[8:24]))
        dst = str(ipaddress.IPv6Address(packet[24:40]))
        size = 40 + struct.unpack(">H", packet[4:6])[0]
        l4 = packet[40:]
    else:
        return None, "non_ip"

    info: dict[str, Any] = {
        "src": src, "dst": dst, "bytes": size,
        "sport": None, "dport": None, "transport": "UNKNOWN",
        "syn": 0, "rst": 0, "qname": None, "l7": {},
    }

    payload = b""
    if proto in (6, 17):
        if len(l4) < (20 if proto == 6 else 8):
            return None, "short_l4_header"
        info["sport"], info["dport"] = struct.unpack(">HH", l4[:4])
        if proto == 6:
            info["transport"] = "TCP"
            flags = l4[13]
            info["syn"] = 1 if (flags & 0x02) and not (flags & 0x10) else 0
            info["rst"] = 1 if flags & 0x04 else 0
            # Data offset is in 32-bit words and includes options — a fixed 20
            # here would land mid-options and break SNI parsing on real traffic.
            data_offset = ((l4[12] >> 4) & 0x0F) * 4
            if 20 <= data_offset <= len(l4):
                payload = l4[data_offset:]
        else:
            info["transport"] = "UDP"
            payload = l4[8:]
    elif proto == 1 and ethertype == ETHERTYPE_IPV4:
        info["transport"] = "ICMP"
    elif proto == 58 and ethertype == ETHERTYPE_IPV6:
        info["transport"] = "ICMPV6"
    else:
        return None, "unsupported_transport"

    if payload:
        info["l7"] = inspect(payload, info["sport"], info["dport"])
        if info["l7"].get("dns_query"):
            info["qname"] = info["l7"]["dns_query"]

    return info, ""


def _shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


# ---------------------------------------------------------------------------
# Flow aggregation
# ---------------------------------------------------------------------------

def extract_capture(path: str) -> Capture:
    """Read a capture into normalized flows plus the reader's own coverage."""
    stats = CaptureStats()
    flows: dict[tuple, dict[str, Any]] = {}

    for ts, frame, linktype in read_packets(path, stats):
        link = _strip_link(frame, linktype)
        if link is None:
            stats.skipped["unsupported_link_layer"] += 1
            continue
        pkt, reason = _parse_packet(*link)
        if pkt is None:
            stats.skipped[reason] += 1
            continue
        stats.packets_parsed += 1
        stats.note_time(ts)

        fwd = (pkt["src"], pkt["sport"], pkt["dst"], pkt["dport"], pkt["transport"])
        rev = (pkt["dst"], pkt["dport"], pkt["src"], pkt["sport"], pkt["transport"])
        key, outbound = (rev, False) if rev in flows else (fwd, True)

        flow = flows.get(key)
        if flow is None:
            flow = flows[key] = {
                "first": ts, "last": ts, "packets": 0,
                "bytes_out": 0, "bytes_in": 0,
                "syn": 0, "rst": 0, "qlens": [], "qnames": [], "l7": {},
            }

        flow["last"] = max(flow["last"], ts)
        flow["first"] = min(flow["first"], ts)
        flow["packets"] += 1
        flow["bytes_out" if outbound else "bytes_in"] += pkt["bytes"]
        flow["syn"] += pkt["syn"]
        flow["rst"] += pkt["rst"]
        if pkt["qname"]:
            flow["qnames"].append(pkt["qname"])
            flow["qlens"].append(len(pkt["qname"]))
        # First identifying payload wins: a Client Hello appears once per
        # connection, and later packets carry nothing to override it.
        if pkt["l7"] and not flow["l7"]:
            flow["l7"] = pkt["l7"]

    # Fan-out per source IP, used by the port-scan rule.
    dsts_per_src: dict[str, set[str]] = {}
    for (src, _sp, dst, _dp, _t) in flows:
        dsts_per_src.setdefault(src, set()).add(dst)

    out = []
    for index, ((src, sport, dst, dport, transport), agg) in enumerate(flows.items(), start=1):
        total_bytes = agg["bytes_out"] + agg["bytes_in"]
        duration = max(agg["last"] - agg["first"], 0.0)
        l7 = agg["l7"]

        # Protocol identity. DPI wins when it found something, because a flow on
        # a non-standard port is exactly the case the port table gets wrong;
        # otherwise fall back to the well-known port. "application" deliberately
        # stays a *protocol* (DNS/HTTPS/...) — the rules engine and the ML
        # heuristic branch on it — and the brand goes in metadata instead.
        app = l7.get("l7_proto") or PORT_APPS.get(dport) or PORT_APPS.get(sport) or "UNKNOWN"
        if app == "TLS":
            app = "HTTPS"

        qlens, qnames = agg["qlens"], agg["qnames"]
        avg_q = sum(qlens) / len(qlens) if qlens else 0.0
        # Mean entropy of the *individual* query names, matching how the training
        # set defines this feature (one name at a time). Two earlier versions got
        # this wrong in different ways: first it measured the entropy of the list
        # of lengths ("[45, 52]"), then the entropy of every name concatenated.
        # Concatenation measures variety across names, not randomness within one,
        # so it climbs with the number of lookups — three ordinary hostnames
        # scored 3.65 against a 3.5 threshold, flagging every busy resolver.
        # Dots are dropped because the generator's names are alphanumeric.
        entropy = statistics.fmean(
            _shannon_entropy(name.replace(".", "")) for name in qnames
        ) if qnames else 0.0

        metadata = {
            "source": "python-pcap+l7",
            "avg_query_length": round(avg_q, 1),
            "dns_query_entropy": round(entropy, 3),
            "outbound_ratio": round(agg["bytes_out"] / total_bytes, 3) if total_bytes else 0.0,
            "high_outbound_ratio": bool(total_bytes) and agg["bytes_out"] / total_bytes >= 0.9,
            "repeated_destination": agg["packets"] > 50,
            "unique_destinations": len(dsts_per_src.get(src, ())),
            "syn_packets": agg["syn"],
            "rst_packets": agg["rst"],
            "failed_connections": max(agg["syn"] - 1, 0) if agg["rst"] else 0,
            # L7 identity from the ported DPI engine. Additive — nothing
            # upstream of here is required to read them.
            "l7_app": l7.get("l7_app", "Unknown"),
            "sni": l7.get("sni"),
            "hostname": l7.get("hostname") or l7.get("sni"),
            "dns_query": qnames[0] if qnames else None,
            "dns_query_count": len(qnames),
        }

        out.append({
            "flow_id": f"F-{index:04}",
            "timestamp": _iso(agg["first"]) or datetime.now(timezone.utc).isoformat(),
            "source_ip": src,
            "destination_ip": dst,
            "source_port": sport,
            "destination_port": dport,
            "transport": transport,
            "application": app,
            "packets": agg["packets"],
            "bytes": total_bytes,
            "duration_seconds": round(duration, 3),
            # Risk flags are an nDPI concept; this reader does not infer them.
            "ndpi_risks": [],
            "metadata": metadata,
        })

    stats.flows = len(out)
    return Capture(flows=out, stats=stats)


def extract_flows(path: str) -> list[dict[str, Any]]:
    """Flows only — the shape PRD §27.1 freezes for the DPI boundary."""
    return extract_capture(path).flows


if __name__ == "__main__":
    import tempfile

    def eth(payload: bytes, ethertype: int = ETHERTYPE_IPV4, vlans: tuple = ()) -> bytes:
        head = b"\x02" * 6 + b"\x03" * 6
        for vid in vlans:
            head += struct.pack(">HH", 0x8100, vid)
        return head + struct.pack(">H", ethertype) + payload

    def ipv4(payload: bytes, proto: int = 17) -> bytes:
        total = 20 + len(payload)
        return (struct.pack(">BBHHHBBH", 0x45, 0, total, 1, 0, 64, proto, 0)
                + bytes((10, 0, 0, 5)) + bytes((8, 8, 8, 8)) + payload)

    def ipv6(payload: bytes, proto: int = 6) -> bytes:
        return (struct.pack(">IHBB", 6 << 28, len(payload), proto, 64)
                + ipaddress.IPv6Address("fd00::1").packed
                + ipaddress.IPv6Address("fd00::2").packed + payload)

    dns = (struct.pack(">HHHHHH", 0xABCD, 0x0100, 1, 0, 0, 0)
           + b"\x03www\x07example\x03com\x00" + struct.pack(">HH", 1, 1))
    udp = struct.pack(">HHHH", 51000, 53, 8 + len(dns), 0) + dns
    tcp = struct.pack(">HHIIBBHHH", 51001, 443, 1, 1, 0x50, 0x02, 8192, 0, 0)

    def write_pcap(frames: list[bytes], linktype: int, endian: str = "<",
                   magic: int = 0xA1B2C3D4) -> str:
        # The magic is written in the host's byte order, so a big-endian file
        # holds the same value and a reader infers endianness from how it reads.
        blob = struct.pack(endian + "IHHiIII", magic, 2, 4, 0, 0, 65535, linktype)
        for i, frame in enumerate(frames):
            blob += struct.pack(endian + "IIII", 1700000000 + i, 0, len(frame), len(frame)) + frame
        handle = tempfile.NamedTemporaryFile(suffix=".pcap", delete=False)
        handle.write(blob); handle.close()
        return handle.name

    def write_pcapng(frames: list[bytes], linktype: int, tsresol: int = 9) -> str:
        shb = struct.pack("<IIIHHq", PCAPNG_SHB, 28, 0x1A2B3C4D, 1, 0, -1) + struct.pack("<I", 28)
        opts = struct.pack("<HH", 9, 1) + bytes([tsresol]) + b"\x00" * 3 + struct.pack("<HH", 0, 0)
        idb_body = struct.pack("<HHI", linktype, 0, 65535) + opts
        idb = struct.pack("<II", PCAPNG_IDB, 12 + len(idb_body)) + idb_body \
            + struct.pack("<I", 12 + len(idb_body))
        blob = shb + idb
        for i, frame in enumerate(frames):
            pad = (-len(frame)) % 4
            ticks = int((1700000000 + i) * 10 ** tsresol)
            body = struct.pack("<IIIII", 0, ticks >> 32, ticks & 0xFFFFFFFF,
                               len(frame), len(frame)) + frame + b"\x00" * pad
            blob += struct.pack("<II", PCAPNG_EPB, 12 + len(body)) + body \
                + struct.pack("<I", 12 + len(body))
        handle = tempfile.NamedTemporaryFile(suffix=".pcapng", delete=False)
        handle.write(blob); handle.close()
        return handle.name

    # classic pcap, Ethernet, DNS over UDP
    cap = extract_capture(write_pcap([eth(ipv4(udp))] * 3, LINKTYPE_ETHERNET))
    assert cap.stats.container == "pcap" and cap.stats.coverage == 1.0
    assert len(cap.flows) == 1 and cap.flows[0]["application"] == "DNS"
    assert cap.flows[0]["metadata"]["dns_query"] == "www.example.com"

    # the same frames behind two VLAN tags must still parse
    tagged = extract_capture(write_pcap([eth(ipv4(udp), vlans=(100, 200))], LINKTYPE_ETHERNET))
    assert tagged.flows and tagged.flows[0]["application"] == "DNS", tagged.stats.to_dict()

    # pcapng with nanosecond timestamps
    ng = extract_capture(write_pcapng([eth(ipv4(udp))] * 2, LINKTYPE_ETHERNET))
    assert ng.stats.container == "pcapng" and len(ng.flows) == 1
    assert ng.flows[0]["timestamp"].startswith("2023-11-14"), ng.flows[0]["timestamp"]
    assert ng.flows[0]["duration_seconds"] == 1.0

    # link layers without an Ethernet header
    assert extract_capture(write_pcap([ipv4(udp)], LINKTYPE_RAW)).flows
    sll = b"\x00\x00\x00\x01" + b"\x00" * 10 + struct.pack(">H", ETHERTYPE_IPV4)
    assert extract_capture(write_pcap([sll + ipv4(udp)], LINKTYPE_LINUX_SLL)).flows
    assert extract_capture(write_pcap([b"\x02\x00\x00\x00" + ipv4(udp)], LINKTYPE_NULL)).flows

    # IPv6, and a big-endian file
    v6 = extract_capture(write_pcap([eth(ipv6(tcp), ETHERTYPE_IPV6)], LINKTYPE_ETHERNET))
    assert v6.flows[0]["source_ip"] == "fd00::1" and v6.flows[0]["application"] == "HTTPS"
    assert extract_capture(write_pcap([eth(ipv4(udp))], LINKTYPE_ETHERNET, ">")).flows

    # unreadable packets are counted, never silently dropped
    mixed = extract_capture(write_pcap(
        [eth(ipv4(udp)), eth(b"\x00" * 40, 0x0806), eth(ipv6(b"\x00" * 8, proto=43), ETHERTYPE_IPV6)],
        LINKTYPE_ETHERNET))
    assert mixed.stats.packets_read == 3 and mixed.stats.packets_parsed == 1
    assert mixed.stats.skipped["non_ip"] == 1
    assert mixed.stats.skipped["ipv6_extension_header"] == 1
    assert 0.3 < mixed.stats.coverage < 0.34

    try:
        extract_capture(write_pcap([], LINKTYPE_ETHERNET, "<", 0xDEADBEEF))
    except ValueError as exc:
        assert "magic" in str(exc)
    else:
        raise AssertionError("a bad magic must raise, not return zero flows")

    print("capture engine self-check ok — pcap + pcapng, "
          f"{len(LINKTYPE_NAMES)} link types, coverage reported")
