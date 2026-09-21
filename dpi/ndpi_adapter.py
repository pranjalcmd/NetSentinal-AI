"""DPI integration boundary.

Everything DPI-specific lives here. The rest of the app only sees the
normalized Flow schema (see backend/app/schemas/api.py).

Three modes, tried in order:

1. ``ndpiReader`` binary on PATH / NDPI_READER env / a local nDPI build tree.
   We run ``ndpiReader -i cap.pcap -k out.json -K json -q`` and normalize the
   JSONL it emits. Adds nDPI protocol IDs and flow risk flags.
2. Sidecar fixture: ``cap.pcap`` -> ``cap.json`` next to it. Lets the team
   demo without a compiled engine.
3. ``dpi/pcap_flows.py`` + ``dpi/l7.py`` — the pure-Python capture engine:
   pcap and pcapng, Ethernet/VLAN/cooked/raw link layers, IPv4 and IPv6, with
   real L7 inspection ported from the Packet_analyzer C++ engine (TLS SNI,
   HTTP Host, DNS query names read out of the payload). No C toolchain needed,
   so this is the path that actually runs on Windows.

On the Packet_analyzer binary specifically: the copy in the drop is a Mach-O
ARM64 (macOS) build, and it reports aggregate counters plus an SNI list to
stdout rather than per-flow records, so it cannot populate the Flow schema.
Its detection logic is ported to dpi/l7.py instead and verified against the
two captures it ships — see tests/test_l7.py.

ponytail: mode 3 has no nDPI risk flags and no protocol-state machine, so an
app on a non-standard port with no Client Hello in the capture window still
falls back to the port table. Build nDPI and set NDPI_READER for those. It
does not invent risk flags to fill the gap — ``ndpi_risks`` stays empty.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from dpi.pcap_flows import extract_capture

# nDPI L4 proto name -> our transport enum
_TRANSPORTS = {"TCP", "UDP", "ICMP", "ICMPV6", "SCTP", "IGMP", "GRE"}


def _opaque_capture(container: str, flows: list[dict]) -> dict:
    """Coverage block for a source that reports flows but not packets."""
    return {
        "container": container,
        "link_types": [],
        "packets_read": 0,
        "packets_parsed": 0,
        "packets_truncated": 0,
        "packets_skipped": {},
        "coverage": None,          # unknown, which is not the same as complete
        "flows": len(flows),
        "started_at": flows[0].get("timestamp") if flows else None,
        "duration_seconds": None,
    }



def find_ndpi_reader() -> str | None:
    """Locate a built ndpiReader, or None."""
    env = os.environ.get("NDPI_READER")
    if env and Path(env).exists():
        return env

    on_path = shutil.which("ndpiReader") or shutil.which("ndpiReader.exe")
    if on_path:
        return on_path

    root = os.environ.get("NDPI_ROOT")
    if root:
        for candidate in (
            Path(root) / "example" / "ndpiReader",
            Path(root) / "example" / "ndpiReader.exe",
        ):
            if candidate.exists():
                return str(candidate)
    return None


# --------------------------------------------------------------------------
# nDPI JSONL -> Flow schema
# --------------------------------------------------------------------------

def _risk_names(record: dict[str, Any]) -> list[str]:
    """nDPI serializes risks as {"flow_risk": {"<bit>": {"risk": "...", ...}}}.

    Depending on the nDPI version the block sits at the top level or under
    "ndpi", so check both.
    """
    out: list[str] = []
    for holder in (record, record.get("ndpi") or {}):
        block = holder.get("flow_risk") if isinstance(holder, dict) else None
        if not isinstance(block, dict):
            continue
        for entry in block.values():
            if isinstance(entry, dict) and entry.get("risk"):
                out.append(str(entry["risk"]))
            elif isinstance(entry, str):
                out.append(entry)
    return list(dict.fromkeys(out))


def normalize_ndpi_record(record: dict[str, Any], index: int = 0) -> dict[str, Any]:
    """Map one ndpiReader JSON flow onto the internal Flow schema."""
    ndpi = record.get("ndpi") if isinstance(record.get("ndpi"), dict) else {}
    xfer = record.get("xfer") if isinstance(record.get("xfer"), dict) else {}
    tcp_flags = record.get("tcp_flags") if isinstance(record.get("tcp_flags"), dict) else {}

    l4 = str(record.get("proto") or "").upper()
    transport = l4 if l4 in _TRANSPORTS else "UNKNOWN"

    # L7 looks like "TLS.Google" / "DNS" — keep the master protocol.
    l7_raw = str(ndpi.get("proto") or record.get("proto_l7") or "UNKNOWN")
    application = l7_raw.split(".")[0].upper() or "UNKNOWN"
    if application == transport:  # nDPI gave up, no L7 detected
        application = "UNKNOWN"

    src2dst_pkts = int(xfer.get("src2dst_packets") or 0)
    dst2src_pkts = int(xfer.get("dst2src_packets") or 0)
    src2dst_bytes = int(xfer.get("src2dst_bytes") or 0)
    dst2src_bytes = int(xfer.get("dst2src_bytes") or 0)
    total_bytes = src2dst_bytes + dst2src_bytes

    duration = float(record.get("duration") or 0.0)
    first_seen = float(record.get("first_seen") or 0.0)

    return {
        "flow_id": f"F-{record.get('flow_id', index):04}",
        "timestamp": _iso(first_seen),
        "source_ip": record.get("src_ip") or "0.0.0.0",
        "destination_ip": record.get("dest_ip") or record.get("dst_ip") or "0.0.0.0",
        "source_port": _int_or_none(record.get("src_port")),
        "destination_port": _int_or_none(record.get("dst_port")),
        "transport": transport,
        "application": application,
        "packets": src2dst_pkts + dst2src_pkts,
        "bytes": total_bytes,
        "duration_seconds": max(duration, 0.0),
        "ndpi_risks": _risk_names(record),
        "metadata": {
            "ndpi_category": ndpi.get("category"),
            "ndpi_confidence": ndpi.get("confidence"),
            "hostname": ndpi.get("hostname"),
            "outbound_ratio": (src2dst_bytes / total_bytes) if total_bytes else 0.0,
            "high_outbound_ratio": bool(total_bytes) and src2dst_bytes / total_bytes >= 0.9,
            "syn_packets": int(tcp_flags.get("syn_count") or 0),
            "rst_packets": int(tcp_flags.get("rst_count") or 0),
        },
    }


def _iso(epoch_seconds: float) -> str:
    from datetime import datetime, timezone

    if not epoch_seconds:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromtimestamp(epoch_seconds, timezone.utc).isoformat()


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_ndpi_jsonl(text: str) -> list[dict[str, Any]]:
    """ndpiReader writes one JSON object per line; tolerate a JSON array too."""
    text = text.strip()
    if not text:
        return []
    if text.startswith("["):
        return [normalize_ndpi_record(r, i) for i, r in enumerate(json.loads(text))]

    flows = []
    for index, line in enumerate(text.splitlines()):
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            flows.append(normalize_ndpi_record(json.loads(line), index))
        except json.JSONDecodeError:
            continue
    return flows


# --------------------------------------------------------------------------

class NDPIAdapter:
    def __init__(self, reader_path: str | None = None):
        self.reader_path = reader_path or find_ndpi_reader()

    @property
    def mode(self) -> str:
        return "ndpiReader" if self.reader_path else "python-l7"

    def analyze_pcap(self, pcap_path: str) -> list[dict]:
        """Normalized flows. The boundary PRD §27.1 freezes."""
        return self.analyze_capture(pcap_path)[0]

    def analyze_capture(self, pcap_path: str) -> tuple[list[dict], dict]:
        """Flows plus what the reader understood about the capture.

        The second element is coverage, not detection: which container and link
        layers were seen, how many packets reached flow aggregation and why the
        rest did not. Only the pure-Python capture engine can report it per
        packet — ndpiReader and fixture mode say so rather than inventing
        numbers (PRD §1.2 Principle E).
        """
        path = Path(pcap_path)
        if not path.exists():
            raise FileNotFoundError(pcap_path)

        if self.reader_path:
            flows = self._run_ndpi_reader(path)
            if flows:
                return flows, _opaque_capture("ndpiReader", flows)

        # Sidecar fixture (demo/offline path).
        fixture = path.with_suffix(".json")
        if fixture.exists():
            flows = json.loads(fixture.read_text(encoding="utf-8"))
            return flows, _opaque_capture("fixture", flows)

        capture = extract_capture(str(path))
        return capture.flows, capture.stats.to_dict()

    def _run_ndpi_reader(self, path: Path) -> list[dict]:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "flows.json"
            try:
                subprocess.run(
                    [self.reader_path, "-i", str(path), "-k", str(out), "-K", "json", "-q"],
                    check=True,
                    capture_output=True,
                    timeout=300,
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
                return []
            if not out.exists():
                return []
            return parse_ndpi_jsonl(out.read_text(encoding="utf-8", errors="replace"))
