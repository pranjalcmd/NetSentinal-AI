"""Generate the four sample captures PRD §28 asks the project to maintain.

    python scripts/make_samples.py

    samples/
    ├── normal.pcap                 normal HTTPS + normal DNS, nothing flagged
    ├── suspicious_dns.pcap         §20.1 DNS_HIGH_FREQUENCY + §21 DNS_LONG_QUERY
    ├── repeated_connections.pcap   §23 REPEATED_DESTINATION + §22 UNUSUAL_LEGACY_PORT
    └── high_outbound.pcap          §24 HIGH_OUTBOUND_VOLUME + §25 NDPI_RISK

Between them they cover every behaviour §28.2 requires the demo data to show.
The legacy-port case rides in repeated_connections.pcap because §28 fixes the
four filenames and a repeated telnet session is where a legacy port actually
turns up.

These are synthetic frames written byte by byte, not captured traffic. §28.2:
do not present them as a real-world confirmed intrusion — they are shaped to
cross known thresholds so the pipeline has something deterministic to chew on.

The packet builders are the ones the capture-engine tests already use; this
script imports them rather than growing a second copy that can drift from the
parser they were written against.
"""
from __future__ import annotations

import random
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from detection.engine import run_detection  # noqa: E402
from dpi.ndpi_adapter import NDPIAdapter  # noqa: E402
from test_capture import (  # noqa: E402
    BASE_TIME,
    client_hello,
    dns_query,
    eth,
    ipv4,
    pcap_bytes,
    tcp,
    udp,
)

SAMPLES = ROOT / "samples"
CLIENT = "10.0.0.5"
RESOLVER = "10.0.0.53"


def _https(dst: str, host: str, *, payload: int = 1200, packets: int = 8,
           sport: int = 51001, outbound_only: bool = False):
    """One TLS session: client hello, then data. Returns frames."""
    frames = [eth(ipv4(tcp(b"", sport=sport, dport=443, flags=0x02), proto=6,
                       src=CLIENT, dst=dst)),
              eth(ipv4(tcp(client_hello(host), sport=sport, dport=443, flags=0x18),
                       proto=6, src=CLIENT, dst=dst))]
    for i in range(packets):
        frames.append(eth(ipv4(tcp(b"\x17\x03\x03" + b"x" * payload, sport=sport,
                                   dport=443, flags=0x18), proto=6, src=CLIENT, dst=dst)))
        if not outbound_only:
            frames.append(eth(ipv4(tcp(b"\x17\x03\x03" + b"y" * payload, sport=443,
                                       dport=sport, flags=0x18), proto=6,
                                   src=dst, dst=CLIENT)))
    return frames


def normal():
    """Ordinary browsing: a couple of TLS sessions and a few short DNS lookups.

    The capture the "no suspicious behaviour was flagged" path (§30) needs to
    exist — a tool that has never produced a clean result has not been tested.
    """
    frames, times = [], []
    for index, (host, dst) in enumerate([
        ("www.example.com", "93.184.216.34"),
        ("cdn.example.net", "93.184.216.35"),
        ("api.example.org", "93.184.216.36"),
    ]):
        for offset, frame in enumerate(_https(dst, host, sport=51001 + index)):
            frames.append(frame)
            times.append(BASE_TIME + index * 20 + offset * 0.4)
        frames.append(eth(ipv4(udp(dns_query(host), dport=53), src=CLIENT, dst=RESOLVER)))
        times.append(BASE_TIME + index * 20)
        frames.append(eth(ipv4(udp(dns_query(host), sport=53, dport=51000),
                               src=RESOLVER, dst=CLIENT)))
        times.append(BASE_TIME + index * 20 + 0.05)
    return pcap_bytes(frames, times=times)


def suspicious_dns():
    """DNS tunneling shape: long random labels, far too many per second.

    §20.1 threshold is 4 queries/s and §21 is 55 characters; these run at ~40/s
    with 60-character labels, i.e. clearly over rather than borderline.
    """
    rng = random.Random(28)
    alphabet = string.ascii_lowercase + string.digits
    frames, times = [], []
    for i in range(120):
        label = "".join(rng.choice(alphabet) for _ in range(48))
        frames.append(eth(ipv4(udp(dns_query(f"{label}.tunnel.example.com"),
                                   sport=51000 + (i % 8), dport=53),
                               src=CLIENT, dst=RESOLVER)))
        times.append(BASE_TIME + i * 0.025)
    return pcap_bytes(frames, times=times)


def repeated_connections():
    """The same destination over and over, plus a legacy service.

    §23 is explicit that a repeated destination is a correlation indicator and
    not a high-confidence malicious signal on its own, so this sample is
    deliberately a weak one: it should raise something small, not a red alert.
    """
    frames, times = [], []
    for session in range(14):
        base = BASE_TIME + session * 60
        for offset, frame in enumerate(
                _https("198.51.100.23", "updates.example.com", payload=64,
                       packets=3, sport=52000 + session)):
            frames.append(frame)
            times.append(base + offset * 0.2)
    # Telnet (§22): a legacy cleartext admin service, repeated from the same host.
    for i in range(30):
        frames.append(eth(ipv4(tcp(b"login: " if i % 2 else b"admin\r\n",
                                   sport=53000, dport=23, flags=0x18), proto=6,
                               src=CLIENT, dst="198.51.100.77")))
        times.append(BASE_TIME + 900 + i * 2)
    return pcap_bytes(frames, times=times)


def high_outbound():
    """A large one-directional upload to an unusual port.

    Outbound-only traffic pushes `high_outbound_ratio` past 0.9 (§24). The odd
    high port is what a DPI risk indicator would attach to (§25) — the sample
    carries the shape; whether ndpiReader or the Python capture engine labels it
    is up to whichever is installed.
    """
    frames, times = [], []
    for i in range(400):
        frames.append(eth(ipv4(tcp(b"\x17\x03\x03" + b"z" * 1400, sport=54000,
                                   dport=8443, flags=0x18), proto=6,
                               src=CLIENT, dst="203.0.113.44")))
        times.append(BASE_TIME + i * 0.05)
    # A handful of ACKs back, so it is a real session and not a blind one-way blast.
    for i in range(6):
        frames.append(eth(ipv4(tcp(b"", sport=8443, dport=54000, flags=0x10), proto=6,
                               src="203.0.113.44", dst=CLIENT)))
        times.append(BASE_TIME + i * 3)
    return pcap_bytes(frames, times=times)


BUILDERS = {
    "normal.pcap": normal,
    "suspicious_dns.pcap": suspicious_dns,
    "repeated_connections.pcap": repeated_connections,
    "high_outbound.pcap": high_outbound,
}

# What each sample has to still be worth shipping. `clean` means the capture
# must produce no alert-worthy finding; the rest name a rule that must fire.
EXPECTED = {
    "normal.pcap": "clean",
    "suspicious_dns.pcap": "DNS_HIGH_FREQUENCY",
    "repeated_connections.pcap": "UNUSUAL_LEGACY_PORT",
    "high_outbound.pcap": "HIGH_OUTBOUND_VOLUME",
}


def main() -> None:
    SAMPLES.mkdir(exist_ok=True)
    adapter = NDPIAdapter()

    for name, build in BUILDERS.items():
        path = SAMPLES / name
        path.write_bytes(build())

        # Verify through the real chain, not the builder's intent: a sample that
        # no longer triggers what it is named after is a broken fixture.
        flows = adapter.analyze_pcap(str(path))
        result = run_detection(flows, capture_id=name)
        rules = {rule for f in result.findings for rule in f.rule_ids}
        expected = EXPECTED[name]

        if expected == "clean":
            # Zero findings, not just zero alert-worthy ones. A LOW finding on
            # ordinary browsing is still a false positive; the MEDIUM alert cut
            # would just hide it. This caught the DNS entropy bug.
            assert not result.findings, \
                f"{name}: expected a clean capture, got {[f.summary for f in result.findings]}"
        else:
            assert expected in rules, f"{name}: expected {expected}, got {sorted(rules)}"

        print(f"  {name:<28} {path.stat().st_size / 1024:6.1f} KB  "
              f"{len(flows):3d} flows  {len(result.findings):3d} findings  "
              f"{sorted(rules) if rules else 'no rules fired'}")

    print(f"\nwrote {len(BUILDERS)} captures to {SAMPLES} (mode: {adapter.mode})")
    print("Synthetic traffic shaped to cross known thresholds — not a real intrusion (§28.2).")


if __name__ == "__main__":
    main()
