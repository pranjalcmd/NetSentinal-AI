"""nDPI integration boundary.

The hackathon team should keep all nDPI-specific logic here. The rest of the
application consumes the stable Flow schema and does not depend on nDPI internals.

For the initial scaffold this adapter can read fixture JSON. Replace
`analyze_pcap()` with a subprocess/FFI wrapper around the locally built nDPI
reader once the team's environment is ready.
"""
from pathlib import Path
import json

class NDPIAdapter:
    def analyze_pcap(self, pcap_path: str) -> list[dict]:
        path = Path(pcap_path)
        fixture = path.with_suffix(".json")
        if fixture.exists():
            return json.loads(fixture.read_text(encoding="utf-8"))
        raise NotImplementedError(
            "nDPI runtime is not wired in this starter. Add the local nDPI reader/FFI invocation here."
        )
