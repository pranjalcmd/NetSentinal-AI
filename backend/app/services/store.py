from dataclasses import dataclass, field
from threading import Lock
from typing import Any

@dataclass
class MemoryStore:
    flows: dict[str, dict[str, Any]] = field(default_factory=dict)
    alerts: dict[str, dict[str, Any]] = field(default_factory=dict)
    findings: dict[str, dict[str, Any]] = field(default_factory=dict)
    incidents: dict[str, dict[str, Any]] = field(default_factory=dict)
    ai: dict[str, dict[str, Any]] = field(default_factory=dict)
    jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    lock: Lock = field(default_factory=Lock)
    # Which stored job this working set came from, so an AI explanation can be
    # filed against the right capture in the database. None until one completes.
    current_job_id: str | None = None

    def reset(self) -> None:
        """Clear analysis results. Job history is kept on purpose."""
        with self.lock:
            self.flows.clear(); self.alerts.clear(); self.ai.clear()
            self.findings.clear(); self.incidents.clear()
            self.current_job_id = None

store = MemoryStore()
