from dataclasses import dataclass, field
from threading import Lock
from typing import Any

@dataclass
class MemoryStore:
    flows: dict[str, dict[str, Any]] = field(default_factory=dict)
    alerts: dict[str, dict[str, Any]] = field(default_factory=dict)
    ai: dict[str, dict[str, Any]] = field(default_factory=dict)
    jobs: dict[str, dict[str, Any]] = field(default_factory=dict)
    lock: Lock = field(default_factory=Lock)

    def reset(self) -> None:
        with self.lock:
            self.flows.clear(); self.alerts.clear(); self.ai.clear(); self.jobs.clear()

store = MemoryStore()
