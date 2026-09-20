"""Async background job runner for analysis tasks.

Manages PCAP and demo analysis jobs as background tasks with:
  - real-time stage tracking (parsing → detecting → complete)
  - progress percentage (0-100)
  - duration and error capture
  - in-memory job store with full history

Usage:
    from backend.app.orchestration.job_runner import job_runner

    job_id = await job_runner.submit_pcap(pcap_path, filename)
    status  = job_runner.get_job(job_id)
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

# Job lifecycle states
JOB_PENDING   = "pending"
JOB_RUNNING   = "running"
JOB_COMPLETE  = "complete"
JOB_FAILED    = "failed"

# Stage label → progress percentage
_STAGE_PROGRESS = {
    "starting":       5,
    "parsing_pcap":   10,
    "normalizing":    20,
    "detecting":      60,
    "ml_scoring":     70,
    "fusing":         80,
    "graph_building": 90,
    "store_update":   95,
    "complete":       100,
}


class JobRunner:
    """Manages async analysis jobs with live progress tracking."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_job(self, filename: str, kind: str = "pcap") -> str:
        """Create a new job record and return its ID."""
        job_id = str(uuid4())
        self._jobs[job_id] = {
            "job_id": job_id,
            "filename": filename,
            "kind": kind,
            "status": JOB_PENDING,
            "stage": "queued",
            "progress": 0,
            "message": "Job queued",
            "summary": {},
            "errors": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
            "elapsed_seconds": None,
        }
        return job_id

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[dict[str, Any]]:
        return sorted(
            self._jobs.values(),
            key=lambda j: j["created_at"],
            reverse=True,
        )

    async def submit_pcap(self, pcap_path: str, filename: str) -> str:
        """Submit a PCAP analysis job and return the job ID."""
        job_id = self.create_job(filename, kind="pcap")
        asyncio.create_task(self._run_pcap_job(job_id, pcap_path))
        return job_id

    async def submit_flows(self, flows: list[dict], filename: str) -> str:
        """Submit a flow list analysis job and return the job ID."""
        job_id = self.create_job(filename, kind="flows")
        asyncio.create_task(self._run_flows_job(job_id, flows))
        return job_id

    async def run_sync(self, flows: list[dict], filename: str) -> dict[str, Any]:
        """Run a flow analysis synchronously and return the job record."""
        job_id = self.create_job(filename, kind="flows")
        await self._run_flows_job(job_id, flows)
        return self._jobs[job_id]

    async def run_pcap_sync(self, pcap_path: str, filename: str) -> dict[str, Any]:
        """Run PCAP analysis synchronously and return the job record."""
        job_id = self.create_job(filename, kind="pcap")
        await self._run_pcap_job(job_id, pcap_path)
        return self._jobs[job_id]

    # ------------------------------------------------------------------
    # Internal async runners
    # ------------------------------------------------------------------

    def _progress_cb(self, job_id: str):
        """Return a progress callback bound to this job."""
        def cb(stage: str, current: int, total: int) -> None:
            job = self._jobs.get(job_id)
            if job is None:
                return
            pct = _STAGE_PROGRESS.get(stage, 50)
            if total > 0 and stage == "detecting":
                pct = 20 + int((current / total) * 50)
            job["stage"] = stage
            job["progress"] = pct
            job["message"] = f"{stage.replace('_', ' ').title()} ({current}/{total})"
        return cb

    def _mark_started(self, job_id: str) -> float:
        job = self._jobs[job_id]
        job["status"] = JOB_RUNNING
        job["started_at"] = datetime.now(timezone.utc).isoformat()
        return time.monotonic()

    def _mark_complete(self, job_id: str, t0: float, summary: dict, message: str) -> None:
        job = self._jobs[job_id]
        job["status"] = JOB_COMPLETE
        job["stage"] = "complete"
        job["progress"] = 100
        job["summary"] = summary
        job["message"] = message
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["elapsed_seconds"] = round(time.monotonic() - t0, 3)

    def _mark_failed(self, job_id: str, t0: float, error: str) -> None:
        job = self._jobs[job_id]
        job["status"] = JOB_FAILED
        job["stage"] = "failed"
        job["progress"] = 0
        job["message"] = f"Analysis failed: {error}"
        job["errors"].append(error)
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["elapsed_seconds"] = round(time.monotonic() - t0, 3)

    async def _run_pcap_job(self, job_id: str, pcap_path: str) -> None:
        t0 = self._mark_started(job_id)
        try:
            from backend.app.orchestration.pipeline import run_pcap_pipeline
            cb = self._progress_cb(job_id)
            result = await asyncio.to_thread(run_pcap_pipeline, pcap_path, cb)
            if result.errors and not result.flow_count:
                self._mark_failed(job_id, t0, "; ".join(result.errors))
            else:
                self._mark_complete(
                    job_id, t0, result.summary,
                    f"Analysed {result.flow_count} flows, {result.alert_count} alerts",
                )
        except Exception as exc:
            logger.exception("PCAP job %s failed", job_id)
            self._mark_failed(job_id, t0, str(exc))

    async def _run_flows_job(self, job_id: str, flows: list[dict]) -> None:
        t0 = self._mark_started(job_id)
        try:
            from backend.app.orchestration.pipeline import run_pipeline
            cb = self._progress_cb(job_id)
            result = await asyncio.to_thread(run_pipeline, flows, cb)
            self._mark_complete(
                job_id, t0, result.summary,
                f"Analysed {result.flow_count} flows, {result.alert_count} alerts",
            )
        except Exception as exc:
            logger.exception("Flows job %s failed", job_id)
            self._mark_failed(job_id, t0, str(exc))


# Singleton instance
job_runner = JobRunner()
