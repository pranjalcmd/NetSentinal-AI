"""Minimal pure-Python pcap -> flow aggregation.

Handles classic libpcap (all four byte-order/precision magics), Ethernet +
IPv4, TCP/UDP/ICMP. L7 application identification comes from dpi/l7.py — the
Python port of the Packet_analyzer C++ engine — so TLS SNI, HTTP Host and DNS
query names are read out of the payload rather than guessed from the port.

ponytail: no pcapng, no IPv6, no VLAN. Port lookup remains the fallback when a
flow carries no identifying payload (already-established TLS, no Client Hello
in the capture window).
"""
from __future__ import annotations

import math
import struct
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from dpi.l7 import inspect

PCAP_MAGICS = {
    0xA1B2C3D4: ("<", 1e-6),   # little-endian, microseconds
    0xD4C3B2A1: (">", 1e-6),
    0xA1B23C4D: ("<", 1e-9),   # nanosecond variants
    0x4D3CB2A1: (">", 1e-9),
}

PORT_APPS = {
    53: "DNS", 80: "HTTP", 443: "HTTPS", 22: "SSH", 21: "FTP", 25: "SMTP",
    23: "TELNET", 2323: "TELNET", 3389: "RDP", 445: "SMB", 123: "NTP",
    67: "DHCP", 68: "DHCP", 8080: "HTTP", 9001: "TOR", 6881: "BITTORRENT",
}


def read_packets(path: str) -> Iterator[tuple[float, bytes]]:
    data = Path(path).read_bytes()
    if len(data) < 24:
        raise ValueError("file too short to be a pcap")

    magic = struct.unpack("<I", data[:4])[0]
    if magic not in PCAP_MAGICS:
        magic_be = struct.unpack(">I", data[:4])[0]
        if magic_be == 0x0A0D0D0A:
            raise ValueError("pcapng is not supported by the fallback reader; build nDPI")
        raise ValueError(f"unrecognized pcap magic 0x{magic:08x}")

    endian, tick = PCAP_MAGICS[magic]
    offset = 24
    while offset + 16 <= len(data):
        ts_sec, ts_frac, caplen, _origlen = struct.unpack(endian + "IIII", data[offset:offset + 16])
        offset += 16
        if caplen > len(data) - offset:
            break
        yield ts_sec + ts_frac * tick, data[offset:offset + caplen]
        offset += caplen


def _dns_qname_length(payload: bytes) -> int | None:
    """Length of the first DNS question name, or None if not parseable.

    Kept as a thin wrapper so the length metric stays in step with the name
    the L7 extractor reports.
    """
    from dpi.l7 import extract_dns_query

    name = extract_dns_query(payload)
    return len(name) if name else None


def _shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _parse_packet(frame: bytes) -> dict[str, Any] | None:
    if len(frame) < 34:
        return None
    ethertype = struct.unpack(">H", frame[12:14])[0]
    if ethertype != 0x0800:  # IPv4 only
        return None

    ip = frame[14:]
    ihl = (ip[0] & 0x0F) * 4
    if ihl < 20 or len(ip) < ihl:
        return None
    proto = ip[9]
    src = ".".join(str(b) for b in ip[12:16])
    dst = ".".join(str(b) for b in ip[16:20])
    total_len = struct.unpack(">H", ip[2:4])[0]
    l4 = ip[ihl:]

    info: dict[str, Any] = {
        "src": src, "dst": dst, "bytes": total_len or len(ip),
        "sport": None, "dport": None, "transport": "UNKNOWN",
        "syn": 0, "rst": 0, "qname": None, "l7": {},
    }

    payload = b""
    if proto == 6 and len(l4) >= 20:  # TCP
        info["transport"] = "TCP"
        info["sport"], info["dport"] = struct.unpack(">HH", l4[:4])
        flags = l4[13]
        info["syn"] = 1 if (flags & 0x02) and not (flags & 0x10) else 0
        info["rst"] = 1 if flags & 0x04 else 0
        # Data offset is in 32-bit words and includes options — a fixed 20 here
        # would land mid-options and break SNI parsing on any real capture.
        data_offset = ((l4[12] >> 4) & 0x0F) * 4
        if 20 <= data_offset <= len(l4):
            payload = l4[data_offset:]
    elif proto == 17 and len(l4) >= 8:  # UDP
        info["transport"] = "UDP"
        info["sport"], info["dport"] = struct.unpack(">HH", l4[:4])
        payload = l4[8:]
    elif proto == 1:
        info["transport"] = "ICMP"
    else:
        return None

    if payload:
        info["l7"] = inspect(payload, info["sport"], info["dport"])
        if info["l7"].get("dns_query"):
            info["qname"] = info["l7"]["dns_query"]

    return info


def extract_flows(path: str) -> list[dict[str, Any]]:
    """Aggregate packets into bidirectional 5-tuple flows."""
    flows: dict[tuple, dict[str, Any]] = {}

    for ts, frame in read_packets(path):
        pkt = _parse_packet(frame)
        if pkt is None:
            continue

        fwd = (pkt["src"], pkt["sport"], pkt["dst"], pkt["dport"], pkt["transport"])
        rev = (pkt["dst"], pkt["dport"], pkt["src"], pkt["sport"], pkt["transport"])
        key, outbound = (rev, False) if rev in flows else (fwd, True)

        flow = flows.get(key)
        if flow is None:
            flow = flows[key] = {
                "first": ts, "last": ts, "packets": 0,
                "bytes_out": 0, "bytes_in": 0,
                "syn": 0, "rst": 0, "qlens": [], "qnames": [],
                "dst_ports": set(), "l7": {},
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
        # connection, and later packets in the flow carry nothing to override it.
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
        # Entropy of the query-name characters, matching how the training set
        # defines this feature. It previously measured entropy of the *list of
        # lengths* ("[45, 52]"), which trained and served on different things.
        # Dots are dropped because the generator's names are alphanumeric.
        entropy_source = "".join(qnames).replace(".", "")

        metadata = {
            "source": "python-pcap+l7",
            "avg_query_length": round(avg_q, 1),
            "dns_query_entropy": round(_shannon_entropy(entropy_source), 3),
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
            "timestamp": datetime.fromtimestamp(agg["first"], timezone.utc).isoformat(),
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
    return out
