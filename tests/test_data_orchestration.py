"""Tests for the data orchestration layer: pipeline and job runner."""
from __future__ import annotations

import asyncio
import pytest


# ---------------------------------------------------------------------------
# Minimal flow fixture
# ---------------------------------------------------------------------------

def _make_flows(n: int = 5) -> list[dict]:
    flows = []
    for i in range(n):
        flows.append({
            "flow_id": f"F-{i:04d}",
            "source_ip": f"10.0.0.{i + 1}",
            "destination_ip": "8.8.8.8",
            "source_port": 50000 + i,
            "destination_port": 53,
            "protocol": "UDP",
            "application": "DNS",
            "bytes_sent": 100 * (i + 1),
            "bytes_received": 50 * (i + 1),
            "packets_sent": 5,
            "packets_received": 3,
            "duration": 0.5 + i * 0.1,
            "timestamp": "2026-09-13T10:00:00Z",
            "metadata": {},
        })
    return flows


# ---------------------------------------------------------------------------
# Pipeline tests
# ---------------------------------------------------------------------------

class TestPipeline:
    def test_pipeline_returns_result(self):
        from backend.app.orchestration.pipeline import run_pipeline
        flows = _make_flows(3)
        result = run_pipeline(flows)
        assert result.flow_count == 3

    def test_pipeline_populates_store(self):
        from backend.app.orchestration.pipeline import run_pipeline
        from backend.app.services.store import store
        flows = _make_flows(5)
        run_pipeline(flows)
        assert len(store.flows) == 5

    def test_pipeline_computes_summary(self):
        from backend.app.orchestration.pipeline import run_pipeline
        flows = _make_flows(4)
        result = run_pipeline(flows)
        assert "total_flows" in result.summary
        assert result.summary["total_flows"] == 4

    def test_pipeline_reports_timings(self):
        from backend.app.orchestration.pipeline import run_pipeline
        flows = _make_flows(3)
        result = run_pipeline(flows)
        assert "detection" in result.stage_timings
        assert result.stage_timings["detection"] >= 0

    def test_pipeline_skips_flows_without_id(self):
        from backend.app.orchestration.pipeline import run_pipeline
        flows = _make_flows(3)
        flows[1].pop("flow_id")  # remove ID from middle flow
        result = run_pipeline(flows)
        assert result.flow_count == 2  # skipped one
        assert len(result.errors) == 1

    def test_pipeline_with_progress_callback(self):
        from backend.app.orchestration.pipeline import run_pipeline
        events = []

        def cb(stage, current, total):
            events.append((stage, current, total))

        flows = _make_flows(5)
        run_pipeline(flows, progress_cb=cb)
        assert len(events) > 0
        stage_names = [e[0] for e in events]
        assert "starting" in stage_names or "detecting" in stage_names

    def test_pipeline_reset_store(self):
        from backend.app.orchestration.pipeline import run_pipeline
        from backend.app.services.store import store
        # First run
        run_pipeline(_make_flows(5))
        first_count = len(store.flows)
        # Second run with reset
        run_pipeline(_make_flows(3), reset_store=True)
        assert len(store.flows) == 3  # store was reset

    def test_pipeline_no_reset(self):
        from backend.app.orchestration.pipeline import run_pipeline
        from backend.app.services.store import store
        store.reset()
        run_pipeline(_make_flows(3), reset_store=False)
        run_pipeline([{
            "flow_id": "F-EXTRA",
            "source_ip": "10.0.0.99",
            "destination_ip": "1.1.1.1",
            "source_port": 1234,
            "destination_port": 80,
            "protocol": "TCP",
            "application": "HTTP",
            "bytes_sent": 100,
            "bytes_received": 200,
            "packets_sent": 2,
            "packets_received": 3,
            "duration": 0.1,
            "timestamp": "2026-09-13T10:00:00Z",
            "metadata": {},
        }], reset_store=False)
        assert "F-EXTRA" in store.flows

    def test_analyse_flows_compat(self):
        """Backward compat: analyse_flows() returns summary dict."""
        from backend.app.orchestration.pipeline import analyse_flows
        flows = _make_flows(3)
        result = analyse_flows(flows)
        assert isinstance(result, dict)
        assert "total_flows" in result

    def test_summary_compat(self):
        from backend.app.orchestration.pipeline import run_pipeline, summary
        run_pipeline(_make_flows(4))
        s = summary()
        assert s["total_flows"] == 4
        assert "risk_distribution" in s
        assert "protocol_distribution" in s


# ---------------------------------------------------------------------------
# Job runner tests
# ---------------------------------------------------------------------------

class TestJobRunner:
    def setup_method(self):
        from backend.app.orchestration.job_runner import JobRunner
        self.runner = JobRunner()

    def test_create_job_returns_id(self):
        job_id = self.runner.create_job("test.pcap")
        assert isinstance(job_id, str)
        assert len(job_id) > 0

    def test_job_starts_as_pending(self):
        job_id = self.runner.create_job("test.pcap")
        job = self.runner.get_job(job_id)
        assert job["status"] == "pending"
        assert job["progress"] == 0

    def test_job_not_found_returns_none(self):
        assert self.runner.get_job("nonexistent-id") is None

    def test_list_jobs_empty(self):
        assert self.runner.list_jobs() == []

    def test_list_jobs_after_create(self):
        self.runner.create_job("a.pcap")
        self.runner.create_job("b.pcap")
        jobs = self.runner.list_jobs()
        assert len(jobs) == 2

    def test_run_sync_completes(self):
        flows = _make_flows(3)
        job = asyncio.run(self.runner.run_sync(flows, "test_fixture"))
        assert job["status"] == "complete"
        assert job["progress"] == 100

    def test_run_sync_summary_in_job(self):
        flows = _make_flows(5)
        job = asyncio.run(self.runner.run_sync(flows, "fixture"))
        assert "summary" in job
        assert job["summary"].get("total_flows", 0) == 5

    def test_run_sync_has_timing(self):
        flows = _make_flows(3)
        job = asyncio.run(self.runner.run_sync(flows, "fixture"))
        assert job["elapsed_seconds"] is not None
        assert job["elapsed_seconds"] >= 0

    def test_run_sync_message_describes_result(self):
        flows = _make_flows(4)
        job = asyncio.run(self.runner.run_sync(flows, "demo"))
        assert "flows" in job["message"].lower()

    def test_job_status_constants(self):
        from backend.app.orchestration.job_runner import (
            JOB_PENDING, JOB_RUNNING, JOB_COMPLETE, JOB_FAILED
        )
        assert JOB_PENDING == "pending"
        assert JOB_COMPLETE == "complete"
        assert JOB_FAILED == "failed"
