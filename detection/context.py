"""Capture-level context: host, graph and baseline features.

The PRD's data model (§19.1) is per-flow. Rules that need more than one flow
(port scan, lateral fan-out, many-sources-to-one-destination floods, repeated
destinations for §23) read this instead of guessing from a single flow. The
cross-flow feature set is our extension.

Built in one pass over the capture, so "baseline" here means *within this
capture*, not historical. That is stated on every finding it feeds: a
single-capture baseline is weaker evidence than a real history, and
`baseline_available` is False on captures too small to say anything.
"""
from __future__ import annotations

import ipaddress
import statistics
from collections import defaultdict
from dataclasses import dataclass, field

# Below this many flows there is no meaningful in-capture baseline. Report
# nothing rather than fabricate one (§1.2 E).
MIN_FLOWS_FOR_BASELINE = 20

# "Internal" means address space a site actually owns. Deliberately *not*
# `ipaddress.is_private`, which is also True for the documentation ranges
# (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) and the benchmarking range —
# exactly the addresses sample captures and test datasets use for *external*
# servers. Counting those as internal reclassifies every fixture exfiltration as
# lateral movement, which is the opposite of what it is.
_INTERNAL_NETWORKS = tuple(ipaddress.ip_network(cidr) for cidr in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",    # RFC1918
    "100.64.0.0/10",                                     # RFC6598 carrier NAT
    "127.0.0.0/8", "169.254.0.0/16",                     # loopback, link-local
    "::1/128", "fc00::/7", "fe80::/10",                  # the v6 equivalents
))


def is_internal(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        address = ipaddress.ip_address(str(ip))
    except ValueError:
        return False
    return any(address in network for network in _INTERNAL_NETWORKS)


def _num(value, default=0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out if out == out and abs(out) != float("inf") else default


@dataclass
class HostStats:
    flows: int = 0
    packets: float = 0.0
    bytes: float = 0.0
    dest_ips: set = field(default_factory=set)
    dest_ports: set = field(default_factory=set)
    internal_peers: set = field(default_factory=set)
    applications: set = field(default_factory=set)
    syn_packets: float = 0.0
    failed_connections: float = 0.0


@dataclass
class DestStats:
    flows: int = 0
    packets: float = 0.0
    bytes: float = 0.0
    source_ips: set = field(default_factory=set)


@dataclass
class PairStats:
    flows: int = 0
    packets_per_flow: list = field(default_factory=list)
    bytes_per_flow: list = field(default_factory=list)
    first_seen: float | None = None
    last_seen: float | None = None


class FlowContext:
    """Aggregates one capture. Construct with `FlowContext(flows)`."""

    def __init__(self, flows: list[dict]):
        self.flow_count = len(flows)
        self.hosts: dict[str, HostStats] = defaultdict(HostStats)
        self.destinations: dict[str, DestStats] = defaultdict(DestStats)
        self.pairs: dict[tuple[str, str], PairStats] = defaultdict(PairStats)
        self.port_flows: dict[int, int] = defaultdict(int)
        self.app_flows: dict[str, int] = defaultdict(int)
        byte_sizes: list[float] = []

        for index, flow in enumerate(flows):
            src = flow.get("source_ip")
            dst = flow.get("destination_ip")
            packets = _num(flow.get("packets"))
            size = _num(flow.get("bytes"))
            dport = flow.get("destination_port")
            app = (flow.get("application") or "UNKNOWN").upper()
            metadata = flow.get("metadata") if isinstance(flow.get("metadata"), dict) else {}
            byte_sizes.append(size)
            self.app_flows[app] += 1
            if isinstance(dport, int) or (isinstance(dport, str) and dport.isdigit()):
                self.port_flows[int(dport)] += 1

            if src:
                host = self.hosts[src]
                host.flows += 1
                host.packets += packets
                host.bytes += size
                host.applications.add(app)
                host.syn_packets += _num(metadata.get("syn_packets"))
                host.failed_connections += _num(metadata.get("failed_connections"))
                if dst:
                    host.dest_ips.add(dst)
                    if is_internal(src) and is_internal(dst):
                        host.internal_peers.add(dst)
                if dport is not None:
                    host.dest_ports.add(dport)

            if dst:
                dest = self.destinations[dst]
                dest.flows += 1
                dest.packets += packets
                dest.bytes += size
                if src:
                    dest.source_ips.add(src)

            if src and dst:
                pair = self.pairs[(src, dst)]
                pair.flows += 1
                pair.packets_per_flow.append(packets)
                pair.bytes_per_flow.append(size)
                # Ordinal position stands in for time when timestamps are absent or
                # unparseable; only used for "was this a long-lived relationship".
                start = _num(flow.get("_t"), float(index))
                pair.first_seen = start if pair.first_seen is None else min(pair.first_seen, start)
                pair.last_seen = start + _num(flow.get("duration_seconds")) \
                    if pair.last_seen is None else max(pair.last_seen, start + _num(flow.get("duration_seconds")))

        self.median_bytes = statistics.median(byte_sizes) if byte_sizes else 0.0
        self.baseline_available = self.flow_count >= MIN_FLOWS_FOR_BASELINE

    # --- host / graph features ---------------------------------------------
    def host_unique_destinations(self, src: str | None) -> int:
        return len(self.hosts[src].dest_ips) if src in self.hosts else 0

    def host_unique_dest_ports(self, src: str | None) -> int:
        return len(self.hosts[src].dest_ports) if src in self.hosts else 0

    def host_internal_fanout(self, src: str | None) -> int:
        return len(self.hosts[src].internal_peers) if src in self.hosts else 0

    def dest_source_count(self, dst: str | None) -> int:
        return len(self.destinations[dst].source_ips) if dst in self.destinations else 0

    def pair_flows(self, src: str | None, dst: str | None) -> int:
        return self.pairs[(src, dst)].flows if (src, dst) in self.pairs else 0

    def pair_span(self, src: str | None, dst: str | None) -> float:
        pair = self.pairs.get((src, dst))
        if not pair or pair.first_seen is None or pair.last_seen is None:
            return 0.0
        return max(0.0, pair.last_seen - pair.first_seen)

    def pair_size_cv(self, src: str | None, dst: str | None) -> float | None:
        """Coefficient of variation of per-flow byte counts for this pair.

        Low CV over several flows is the "similar payload/packet profile"
        signal the beaconing detector needs. None when there are too few flows
        to say anything.
        """
        pair = self.pairs.get((src, dst))
        if not pair or len(pair.bytes_per_flow) < 3:
            return None
        mean = statistics.fmean(pair.bytes_per_flow)
        if mean <= 0:
            return None
        return statistics.pstdev(pair.bytes_per_flow) / mean

    # --- rarity / novelty --------------------------------------------------
    # There is deliberately no `destination_is_novel` here. Within a single
    # capture, "this destination appears once" is true of most benign external
    # traffic — measured at lift 1.1 against the labelled set, i.e. no
    # information. Novelty needs a historical baseline; until there is one, the
    # engine makes no novelty claim (§1.2 E).
    def port_is_rare(self, port) -> bool:
        if not self.baseline_available or port is None:
            return False
        try:
            port = int(port)
        except (TypeError, ValueError):
            return False
        return self.port_flows.get(port, 0) <= 1

    def volume_ratio_to_baseline(self, size) -> float:
        """How many times the capture's median flow size this flow is."""
        if self.median_bytes <= 0:
            return 0.0
        return _num(size) / self.median_bytes


if __name__ == "__main__":
    flows = [
        {"flow_id": "a", "source_ip": "10.0.0.1", "destination_ip": "10.0.0.2",
         "destination_port": 445, "packets": 10, "bytes": 1000, "duration_seconds": 5},
        {"flow_id": "b", "source_ip": "10.0.0.1", "destination_ip": "8.8.8.8",
         "destination_port": 53, "packets": 4, "bytes": 400, "duration_seconds": 1},
        {"flow_id": "c", "source_ip": "10.0.0.3", "destination_ip": "8.8.8.8",
         "destination_port": 53, "packets": 4, "bytes": 400, "duration_seconds": 1},
    ]
    ctx = FlowContext(flows)
    assert ctx.host_unique_destinations("10.0.0.1") == 2
    assert ctx.host_internal_fanout("10.0.0.1") == 1
    assert ctx.dest_source_count("8.8.8.8") == 2
    assert not ctx.baseline_available          # only 3 flows
    assert is_internal("192.168.1.1") and not is_internal("8.8.8.8")
    assert ctx.volume_ratio_to_baseline(4000) == 10.0            # median is 400
    print("context self-check ok")
