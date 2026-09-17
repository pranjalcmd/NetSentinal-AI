"""Synthetic labelled flow dataset + a matching real libpcap capture.

Two artifacts from one generator, so the ML benchmark and the DPI path are
exercised on the *same* traffic:

  data/dataset.json      labelled flows (the Flow schema + a "label" key)
  data/synthetic.pcap    classic libpcap, Ethernet/IPv4, valid checksums

Packet counts are capped per flow for the pcap, and each flow's duration is
scaled by the same factor — so every *rate* feature (pps, bytes/sec, avg
packet size) survives the downsampling unchanged.

    python scripts/generate_dataset.py --flows 4000

ponytail: no IPv6, no TLS handshakes, no pcapng. Enough to drive nDPI and the
python fallback over realistic 5-tuples; swap in a real capture when you have one.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import string
import struct
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_TIME = datetime(2026, 9, 9, 14, 0, 0, tzinfo=timezone.utc)

# How much of the dataset each class gets. Benign-heavy, like real traffic.
CLASS_MIX = {
    "BENIGN": 0.52,
    "DNS_TUNNELING": 0.08,
    "PORT_SCAN": 0.08,
    "DOS": 0.07,
    "BOTNET": 0.08,
    "BRUTE_FORCE": 0.07,
    "DATA_EXFILTRATION": 0.05,
    "SUSPICIOUS_LEGACY_SERVICE": 0.05,
}

BENIGN_APPS = [
    # (application, transport, dst_port, bytes/packet, packets/sec)
    ("HTTPS", "TCP", 443, 700, 3.0),
    ("HTTPS", "TCP", 443, 1100, 1.2),
    ("HTTP", "TCP", 80, 600, 2.0),
    ("DNS", "UDP", 53, 110, 0.5),
    ("SSH", "TCP", 22, 260, 1.5),
    ("NTP", "UDP", 123, 90, 0.05),
    ("SMTP", "TCP", 25, 900, 0.8),
    ("ICMP", "ICMP", None, 98, 1.0),
]


# ----------------------------------------------------------------------
# Flow synthesis
# ----------------------------------------------------------------------

def _internal_ip(rng: random.Random) -> str:
    return rng.choice([f"192.168.1.{rng.randint(10, 240)}", f"10.0.{rng.randint(0, 4)}.{rng.randint(2, 250)}"])


def _external_ip(rng: random.Random) -> str:
    # Documentation/public-looking ranges; never RFC1918 so the graph labels split cleanly.
    return rng.choice([
        f"203.0.113.{rng.randint(1, 254)}",
        f"198.51.100.{rng.randint(1, 254)}",
        f"93.184.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
        f"104.{rng.randint(16, 31)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
        f"8.8.{rng.choice([4, 8])}.{rng.choice([4, 8])}",
    ])


def _entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    n = len(text)
    return round(-sum((c / n) * math.log2(c / n) for c in counts.values()), 3)


def _jitter(rng: random.Random, value: float, spread: float = 0.25) -> float:
    return value * rng.uniform(1 - spread, 1 + spread)


def _blank_metadata() -> dict:
    return {
        "avg_query_length": 0.0,
        "dns_query_entropy": 0.0,
        "outbound_ratio": 0.5,
        "high_outbound_ratio": False,
        "repeated_destination": False,
        "unique_destinations": 1,
        "failed_connections": 0,
        "syn_packets": 0,
        "rst_packets": 0,
    }


def _benign(rng: random.Random) -> dict:
    app, transport, dport, bpp, pps = rng.choice(BENIGN_APPS)
    duration = round(_jitter(rng, rng.choice([5, 15, 30, 60, 120])), 2)
    packets = max(2, int(_jitter(rng, pps * duration) + 1))
    meta = _blank_metadata()
    meta["outbound_ratio"] = round(rng.uniform(0.25, 0.6), 3)
    meta["unique_destinations"] = rng.randint(1, 4)
    if app == "DNS":
        # Ordinary hostnames. Long enough to be plausible, short of the threshold.
        meta["avg_query_length"] = round(rng.uniform(12, 34), 1)
        meta["dns_query_entropy"] = round(rng.uniform(2.6, 3.6), 3)
    if transport == "TCP":
        meta["syn_packets"] = rng.randint(1, 3)
    return {
        "transport": transport, "application": app,
        "source_port": rng.randint(32768, 60999),
        "destination_port": dport,
        "packets": packets,
        "bytes": int(packets * _jitter(rng, bpp, 0.15)),
        "duration_seconds": duration,
        "ndpi_risks": [],
        "metadata": meta,
    }


def _dns_tunneling(rng: random.Random) -> dict:
    duration = round(_jitter(rng, rng.choice([30, 60, 120])), 2)
    pps = _jitter(rng, rng.uniform(5, 35))
    packets = max(10, int(pps * duration))
    qlen = round(rng.uniform(56, 118), 1)
    meta = _blank_metadata()
    meta.update({
        "avg_query_length": qlen,
        # Base32-ish payload labels: high entropy, unlike real hostnames.
        "dns_query_entropy": _entropy("".join(rng.choice(string.ascii_lowercase + string.digits)
                                              for _ in range(int(qlen)))),
        "outbound_ratio": round(rng.uniform(0.6, 0.85), 3),
        "repeated_destination": True,
        "unique_destinations": rng.randint(1, 2),
    })
    return {
        "transport": "UDP", "application": "DNS",
        "source_port": rng.randint(32768, 60999), "destination_port": 53,
        "packets": packets,
        "bytes": int(packets * _jitter(rng, 210, 0.2)),
        "duration_seconds": duration,
        "ndpi_risks": ["Suspicious DNS traffic"] if rng.random() < 0.45 else [],
        "metadata": meta,
    }


def _port_scan(rng: random.Random) -> dict:
    unique = rng.randint(24, 180)
    syn = int(_jitter(rng, unique * rng.uniform(1.0, 2.5)))
    duration = round(_jitter(rng, rng.uniform(3, 40)), 2)
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.82, 0.97), 3),
        "unique_destinations": unique,
        "syn_packets": syn,
        "rst_packets": int(syn * rng.uniform(0.4, 0.9)),
        "failed_connections": int(syn * rng.uniform(0.5, 0.95)),
    })
    return {
        "transport": "TCP", "application": "UNKNOWN",
        "source_port": rng.randint(32768, 60999),
        "destination_port": rng.choice([22, 80, 139, 443, 445, 1433, 3306, 3389, 8080]),
        "packets": syn + meta["rst_packets"],
        "bytes": int((syn + meta["rst_packets"]) * _jitter(rng, 60, 0.1)),
        "duration_seconds": duration,
        "ndpi_risks": [],
        "metadata": meta,
    }


def _dos(rng: random.Random) -> dict:
    duration = round(_jitter(rng, rng.uniform(4, 45)), 2)
    pps = _jitter(rng, rng.uniform(2_000, 40_000))
    packets = int(pps * duration)
    transport = rng.choice(["TCP", "UDP", "ICMP"])
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.9, 0.99), 3),
        "high_outbound_ratio": True,
        "repeated_destination": True,
        "unique_destinations": 1,
        "syn_packets": packets if transport == "TCP" else 0,
        "failed_connections": int(packets * 0.6) if transport == "TCP" else 0,
    })
    return {
        "transport": transport,
        "application": "ICMP" if transport == "ICMP" else "UNKNOWN",
        "source_port": rng.randint(32768, 60999) if transport != "ICMP" else None,
        "destination_port": rng.choice([80, 443, 53, 123]) if transport != "ICMP" else None,
        "packets": packets,
        "bytes": int(packets * _jitter(rng, 74, 0.2)),
        "duration_seconds": duration,
        "ndpi_risks": [],
        "metadata": meta,
    }


def _botnet(rng: random.Random) -> dict:
    # Low-and-slow beaconing: long duration, tiny payloads, same destination.
    duration = round(_jitter(rng, rng.uniform(300, 3600)), 2)
    packets = rng.randint(20, 240)
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.45, 0.7), 3),
        "repeated_destination": True,
        "unique_destinations": 1,
        "syn_packets": rng.randint(5, 60),
    })
    return {
        "transport": "TCP",
        "application": rng.choice(["UNKNOWN", "HTTPS", "TOR"]),
        "source_port": rng.randint(32768, 60999),
        "destination_port": rng.choice([443, 8080, 8443, 9001, 50050]),
        "packets": packets,
        "bytes": int(packets * _jitter(rng, 180, 0.3)),
        "duration_seconds": duration,
        "ndpi_risks": rng.choice([["Risky domain"], ["Malicious host"], ["Risky domain", "Suspicious DNS traffic"], []]),
        "metadata": meta,
    }


def _brute_force(rng: random.Random) -> dict:
    duration = round(_jitter(rng, rng.uniform(30, 600)), 2)
    attempts = rng.randint(40, 900)
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.55, 0.75), 3),
        "repeated_destination": True,
        "unique_destinations": 1,
        "syn_packets": attempts,
        "rst_packets": int(attempts * rng.uniform(0.3, 0.8)),
        "failed_connections": int(attempts * rng.uniform(0.85, 0.99)),
    })
    return {
        "transport": "TCP",
        "application": rng.choice(["SSH", "RDP", "FTP", "SMB"]),
        "source_port": rng.randint(32768, 60999),
        "destination_port": rng.choice([22, 21, 445, 3389]),
        "packets": attempts * rng.randint(2, 6),
        "bytes": int(attempts * _jitter(rng, 640, 0.25)),
        "duration_seconds": duration,
        "ndpi_risks": [],
        "metadata": meta,
    }


def _exfiltration(rng: random.Random) -> dict:
    duration = round(_jitter(rng, rng.uniform(20, 400)), 2)
    bps = _jitter(rng, rng.uniform(5_500_000, 60_000_000))
    total_bytes = int(bps * duration)
    avg_pkt = rng.uniform(1100, 1460)
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.9, 0.995), 3),
        "high_outbound_ratio": True,
        "unique_destinations": 1,
        "syn_packets": rng.randint(1, 6),
    })
    return {
        "transport": "TCP",
        "application": rng.choice(["HTTPS", "FTP", "HTTP", "UNKNOWN"]),
        "source_port": rng.randint(32768, 60999),
        "destination_port": rng.choice([443, 21, 80, 8080]),
        "packets": max(10, int(total_bytes / avg_pkt)),
        "bytes": total_bytes,
        "duration_seconds": duration,
        "ndpi_risks": ["Risky domain"] if rng.random() < 0.3 else [],
        "metadata": meta,
    }


def _legacy_service(rng: random.Random) -> dict:
    duration = round(_jitter(rng, rng.uniform(10, 300)), 2)
    packets = rng.randint(20, 400)
    meta = _blank_metadata()
    meta.update({
        "outbound_ratio": round(rng.uniform(0.4, 0.65), 3),
        "repeated_destination": rng.random() < 0.6,
        "unique_destinations": rng.randint(1, 3),
        "syn_packets": rng.randint(1, 8),
    })
    return {
        "transport": "TCP", "application": "TELNET",
        "source_port": rng.randint(32768, 60999),
        "destination_port": rng.choice([23, 2323]),
        "packets": packets,
        "bytes": int(packets * _jitter(rng, 120, 0.3)),
        "duration_seconds": duration,
        "ndpi_risks": ["Unusual port"] if rng.random() < 0.25 else [],
        "metadata": meta,
    }


GENERATORS = {
    "BENIGN": _benign,
    "DNS_TUNNELING": _dns_tunneling,
    "PORT_SCAN": _port_scan,
    "DOS": _dos,
    "BOTNET": _botnet,
    "BRUTE_FORCE": _brute_force,
    "DATA_EXFILTRATION": _exfiltration,
    "SUSPICIOUS_LEGACY_SERVICE": _legacy_service,
}


# ----------------------------------------------------------------------
# Boundary cases
# ----------------------------------------------------------------------
# Without these every class occupies its own region of feature space and the
# model scores a meaningless 1.000. Each shape below is a traffic *pattern*
# that both a benign activity and a specific attack genuinely produce — a
# nightly backup and an exfil look the same on the wire; an asset scanner and
# a recon scan look the same. Both sides draw from the identical distribution
# and reset all metadata, so no field leaks the label. The resulting overlap
# is irreducible: it is the honest ceiling for any classifier on flow features.

def _set_rates(flow: dict, pps: float, bytes_per_packet: float, duration: float) -> None:
    packets = max(2, int(pps * duration))
    flow["duration_seconds"] = round(duration, 2)
    flow["packets"] = packets
    flow["bytes"] = int(packets * bytes_per_packet)


def _shape_bulk_transfer(flow: dict, rng: random.Random) -> None:
    """Nightly backup / large upload — or a throttled exfiltration."""
    flow.update(transport="TCP", application=rng.choice(["HTTPS", "FTP"]),
                destination_port=rng.choice([443, 21]))
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(outbound_ratio=round(rng.uniform(0.85, 0.97), 3),
                            high_outbound_ratio=True, syn_packets=rng.randint(1, 6))
    _set_rates(flow, rng.uniform(1_500, 7_000), rng.uniform(1300, 1450), rng.uniform(40, 400))
    flow["ndpi_risks"] = []


def _shape_host_sweep(flow: dict, rng: random.Random) -> None:
    """Asset-inventory scanner — or slow network recon."""
    syn = rng.randint(12, 40)
    flow.update(transport="TCP", application="UNKNOWN",
                destination_port=rng.choice([22, 80, 443, 445, 3389]))
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(unique_destinations=rng.randint(10, 30), syn_packets=syn,
                            rst_packets=int(syn * rng.uniform(0.3, 0.8)),
                            failed_connections=int(syn * rng.uniform(0.4, 0.95)),
                            outbound_ratio=round(rng.uniform(0.78, 0.96), 3))
    _set_rates(flow, rng.uniform(0.3, 4), rng.uniform(60, 95), rng.uniform(20, 400))
    flow["ndpi_risks"] = []


def _shape_chatty_dns(flow: dict, rng: random.Random) -> None:
    """Busy internal resolver — or a low-rate DNS tunnel."""
    flow.update(transport="UDP", application="DNS", destination_port=53)
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(avg_query_length=round(rng.uniform(40, 58), 1),
                            dns_query_entropy=round(rng.uniform(3.2, 4.2), 3),
                            repeated_destination=True,
                            outbound_ratio=round(rng.uniform(0.55, 0.8), 3))
    _set_rates(flow, rng.uniform(1.5, 9), rng.uniform(120, 200), rng.uniform(45, 300))
    flow["ndpi_risks"] = []


def _shape_legacy_admin(flow: dict, rng: random.Random) -> None:
    """Telnet to lab/network gear — or an attacker on the same port."""
    flow.update(transport="TCP", application="TELNET", destination_port=rng.choice([23, 2323]))
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(outbound_ratio=round(rng.uniform(0.4, 0.65), 3),
                            repeated_destination=rng.random() < 0.5,
                            syn_packets=rng.randint(1, 6))
    _set_rates(flow, rng.uniform(0.2, 3), rng.uniform(95, 130), rng.uniform(10, 200))
    flow["ndpi_risks"] = []


def _shape_keepalive(flow: dict, rng: random.Random) -> None:
    """Long-lived HTTPS session / push channel — or C2 beaconing."""
    flow.update(transport="TCP", application="HTTPS", destination_port=443)
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(outbound_ratio=round(rng.uniform(0.4, 0.7), 3),
                            repeated_destination=rng.random() < 0.5,
                            syn_packets=rng.randint(1, 5))
    _set_rates(flow, rng.uniform(0.05, 0.6), rng.uniform(150, 260), rng.uniform(400, 3600))
    flow["ndpi_risks"] = []


def _shape_repeated_login(flow: dict, rng: random.Random) -> None:
    """Misconfigured client retrying auth — or a slow credential attack."""
    attempts = rng.randint(12, 50)
    flow.update(transport="TCP", application=rng.choice(["SSH", "RDP", "FTP", "SMB"]),
                destination_port=rng.choice([22, 21, 445, 3389]))
    flow["metadata"] = _blank_metadata()
    flow["metadata"].update(syn_packets=attempts, rst_packets=int(attempts * rng.uniform(0.2, 0.7)),
                            failed_connections=int(attempts * rng.uniform(0.6, 0.98)),
                            repeated_destination=True,
                            outbound_ratio=round(rng.uniform(0.5, 0.75), 3))
    _set_rates(flow, rng.uniform(0.1, 2.5), rng.uniform(400, 800), rng.uniform(60, 900))
    flow["ndpi_risks"] = []


def _shape_burst(flow: dict, rng: random.Random) -> None:
    """Traffic spike / load test — or a low-rate flood."""
    transport = rng.choice(["TCP", "UDP"])
    flow.update(transport=transport, application="UNKNOWN" if transport == "TCP" else rng.choice(["UNKNOWN", "NTP"]),
                destination_port=rng.choice([80, 443, 53, 123]))
    flow["metadata"] = _blank_metadata()
    _set_rates(flow, rng.uniform(250, 2_500), rng.uniform(70, 95), rng.uniform(3, 60))
    flow["metadata"].update(outbound_ratio=round(rng.uniform(0.85, 0.99), 3),
                            high_outbound_ratio=rng.random() < 0.5,
                            repeated_destination=True,
                            syn_packets=int(flow["packets"] * 0.8) if transport == "TCP" else 0,
                            failed_connections=int(flow["packets"] * 0.5) if transport == "TCP" else 0)
    flow["ndpi_risks"] = []


# attack class -> the benign-lookalike shape it shares
SHAPES = {
    "DATA_EXFILTRATION": _shape_bulk_transfer,
    "PORT_SCAN": _shape_host_sweep,
    "DNS_TUNNELING": _shape_chatty_dns,
    "SUSPICIOUS_LEGACY_SERVICE": _shape_legacy_admin,
    "BOTNET": _shape_keepalive,
    "BRUTE_FORCE": _shape_repeated_login,
    "DOS": _shape_burst,
}


def _blur(flow: dict, label: str, rng: random.Random) -> None:
    """Redraw one flow as an ambiguous shape, keeping its true label."""
    shape = SHAPES[rng.choice(list(SHAPES))] if label == "BENIGN" else SHAPES[label]
    shape(flow, rng)


def generate(count: int, seed: int = 1337, hard_fraction: float = 0.18) -> list[dict]:
    rng = random.Random(seed)

    labels: list[str] = []
    for label, share in CLASS_MIX.items():
        labels += [label] * max(1, round(count * share))
    labels = labels[:count]
    while len(labels) < count:
        labels.append("BENIGN")
    rng.shuffle(labels)

    flows = []
    for index, label in enumerate(labels, start=1):
        flow = GENERATORS[label](rng)
        hard = rng.random() < hard_fraction
        if hard:
            _blur(flow, label, rng)
        internal, external = _internal_ip(rng), _external_ip(rng)
        inbound = label == "BRUTE_FORCE" and rng.random() < 0.5
        flow.update({
            "flow_id": f"F-{index:05}",
            "timestamp": (BASE_TIME + timedelta(seconds=index * 7)).isoformat(),
            "source_ip": external if inbound else internal,
            "destination_ip": internal if inbound else external,
            "label": label,
            "boundary_case": hard,
        })
        flows.append(flow)
    return flows


# ----------------------------------------------------------------------
# pcap writer
# ----------------------------------------------------------------------

PCAP_HEADER = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)  # LINKTYPE_ETHERNET
MAX_PACKETS_PER_FLOW = 30
MAX_SCAN_TARGETS = 40


def _checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\x00"
    total = sum(struct.unpack(f">{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF


def _ip_bytes(ip: str) -> bytes:
    return bytes(int(part) for part in ip.split("."))


def _frame(src: str, dst: str, proto: int, l4: bytes, payload: bytes) -> bytes:
    """Ethernet II + IPv4 + L4, with correct IPv4 and L4 checksums."""
    body = l4 + payload
    total_len = 20 + len(body)
    header = struct.pack(
        ">BBHHHBBH4s4s",
        0x45, 0, total_len, 0x1234, 0x4000, 64, proto, 0,
        _ip_bytes(src), _ip_bytes(dst),
    )
    header = header[:10] + struct.pack(">H", _checksum(header)) + header[12:]

    pseudo = _ip_bytes(src) + _ip_bytes(dst) + struct.pack(">BBH", 0, proto, len(body))
    if proto == 6:  # TCP: checksum at offset 16
        csum = _checksum(pseudo + body)
        body = body[:16] + struct.pack(">H", csum) + body[18:]
    elif proto == 17:  # UDP: checksum at offset 6
        csum = _checksum(pseudo + body) or 0xFFFF
        body = body[:6] + struct.pack(">H", csum) + body[8:]

    eth = b"\x02\x00\x00\x00\x00\x02" + b"\x02\x00\x00\x00\x00\x01" + struct.pack(">H", 0x0800)
    return eth + header + body


def _tcp(sport: int, dport: int, seq: int, flags: int) -> bytes:
    return struct.pack(">HHIIBBHHH", sport, dport, seq, 1, 0x50, flags, 8192, 0, 0)


def _udp(sport: int, dport: int, payload_len: int) -> bytes:
    return struct.pack(">HHHH", sport, dport, 8 + payload_len, 0)


def _dns_query(qname_len: int, rng: random.Random) -> bytes:
    """A real DNS question whose QNAME is ~qname_len chars (dots included)."""
    alphabet = string.ascii_lowercase + string.digits
    labels: list[bytes] = []
    remaining = max(qname_len, 5)
    while remaining > 0:
        size = min(remaining if remaining <= 63 else rng.randint(20, 50), remaining)
        labels.append("".join(rng.choice(alphabet) for _ in range(size)).encode())
        remaining -= size + 1  # the dot
    qname = b"".join(bytes([len(l)]) + l for l in labels) + b"\x00"
    return struct.pack(">HHHHHH", rng.randint(1, 65535), 0x0100, 1, 0, 0, 0) + qname + struct.pack(">HH", 1, 1)


def _flow_packets(flow: dict, rng: random.Random) -> list[tuple[float, bytes]]:
    """Downsample a flow to at most MAX_PACKETS_PER_FLOW real frames.

    Duration shrinks by the same factor as the packet count, so packets/sec,
    bytes/sec and avg packet size all come out of the pcap unchanged.
    """
    packets = max(int(flow["packets"]), 1)
    factor = min(1.0, MAX_PACKETS_PER_FLOW / packets)
    emit = max(1, round(packets * factor))
    duration = float(flow["duration_seconds"]) * factor
    avg_size = max(int(flow["bytes"]) / packets, 60.0)

    start = datetime.fromisoformat(flow["timestamp"]).timestamp()
    step = duration / emit if emit else 0.0
    sport = flow.get("source_port") or 40000
    dport = flow.get("destination_port") or 0
    src, dst = flow["source_ip"], flow["destination_ip"]
    qlen = int(flow["metadata"].get("avg_query_length") or 0)

    out: list[tuple[float, bytes]] = []
    for i in range(emit):
        ts = start + i * step
        outbound = flow["transport"] == "UDP" or i % 4 != 3  # mostly client->server
        a, b, pa, pb = (src, dst, sport, dport) if outbound else (dst, src, dport, sport)

        if flow["transport"] == "UDP":
            if flow["application"] == "DNS":
                payload = _dns_query(qlen or rng.randint(10, 25), rng)
            else:
                payload = bytes(max(int(avg_size) - 42, 0))
            out.append((ts, _frame(a, b, 17, _udp(pa, pb, len(payload)), payload)))
        elif flow["transport"] == "ICMP":
            payload = bytes(max(int(avg_size) - 42, 0))
            icmp = struct.pack(">BBHHH", 8, 0, 0, 0x1234, i)
            icmp = icmp[:2] + struct.pack(">H", _checksum(icmp + payload)) + icmp[4:]
            out.append((ts, _frame(a, b, 1, icmp, payload)))
        else:
            if i == 0:
                flags = 0x02  # SYN
            elif flow["metadata"].get("rst_packets") and i == emit - 1:
                flags = 0x14  # RST/ACK
            else:
                flags = 0x18  # PSH/ACK
            payload = bytes(max(int(avg_size) - 54, 0)) if flags == 0x18 else b""
            out.append((ts, _frame(a, b, 6, _tcp(pa, pb, 1000 + i * 1400, flags), payload)))
    return out


def _scan_packets(flow: dict, rng: random.Random) -> list[tuple[float, bytes]]:
    """A scan is fan-out, not one flow — emit SYNs to distinct destinations."""
    targets = min(int(flow["metadata"]["unique_destinations"]), MAX_SCAN_TARGETS)
    start = datetime.fromisoformat(flow["timestamp"]).timestamp()
    step = float(flow["duration_seconds"]) / max(targets, 1)
    src, sport = flow["source_ip"], flow["source_port"] or 40000
    out = []
    for i in range(targets):
        dst = _external_ip(rng) if not flow["destination_ip"].startswith(("10.", "192.168.")) \
            else f"192.168.1.{(i * 7) % 250 + 2}"
        ts = start + i * step
        out.append((ts, _frame(src, dst, 6, _tcp(sport + i, flow["destination_port"] or 80, 1000, 0x02), b"")))
        if rng.random() < 0.7:  # most ports closed -> RST back
            out.append((ts + step / 3, _frame(dst, src, 6, _tcp(flow["destination_port"] or 80, sport + i, 1, 0x14), b"")))
    return out


def write_pcap(flows: list[dict], path: Path, seed: int = 7) -> int:
    rng = random.Random(seed)
    packets: list[tuple[float, bytes]] = []
    for flow in flows:
        if flow.get("label") == "PORT_SCAN":
            packets += _scan_packets(flow, rng)
        else:
            packets += _flow_packets(flow, rng)

    packets.sort(key=lambda p: p[0])
    with path.open("wb") as sink:
        sink.write(PCAP_HEADER)
        for ts, frame in packets:
            sec = int(ts)
            sink.write(struct.pack("<IIII", sec, int((ts - sec) * 1e6), len(frame), len(frame)))
            sink.write(frame)
    return len(packets)


# ----------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--flows", type=int, default=4000, help="labelled flows to generate")
    parser.add_argument("--pcap-flows", type=int, default=120, help="flows to also render as packets")
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--hard", type=float, default=0.18,
                        help="fraction of flows pulled toward the decision boundary")
    parser.add_argument("--out", type=Path, default=ROOT / "data")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    flows = generate(args.flows, args.seed, args.hard)

    dataset = args.out / "dataset.json"
    dataset.write_text(json.dumps(flows, indent=None), encoding="utf-8")

    # Stratified slice for the capture so every class shows up in the pcap.
    rng = random.Random(args.seed)
    per_class = max(1, args.pcap_flows // len(CLASS_MIX))
    slice_: list[dict] = []
    for label in CLASS_MIX:
        candidates = [f for f in flows if f["label"] == label]
        slice_ += rng.sample(candidates, min(per_class, len(candidates)))

    pcap = args.out / "synthetic.pcap"
    packet_count = write_pcap(slice_, pcap, args.seed)

    counts = Counter(f["label"] for f in flows)
    hard = sum(1 for f in flows if f["boundary_case"])
    print(f"{dataset}: {len(flows)} flows, {hard} boundary cases ({hard / len(flows):.1%})")
    for label, n in counts.most_common():
        print(f"  {label:<28} {n:>5}  ({n / len(flows):.1%})")
    print(f"{pcap}: {packet_count} packets from {len(slice_)} flows "
          f"({pcap.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
