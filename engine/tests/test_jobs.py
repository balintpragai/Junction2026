"""Tests for the job registry and the /jobs endpoints (ticket #13). No database: the job body is a fake."""

import threading

import pytest
from fastapi.testclient import TestClient

from app.jobs import JobRegistry
from app.main import app, get_jobs
from app.rescore import RescoreResult
from common.models import IndicatorFailure

RESULT = RescoreResult(engine_version="0.2.0+tabc", gaps_written=1234, gaps_removed=2, indicators_scored=12, failures=[])
BROKEN = IndicatorFailure(code="3336", error="ZeroDivisionError: division by zero")


def succeed() -> RescoreResult:
    return RESULT


def fail() -> RescoreResult:
    raise RuntimeError("database is down")


@pytest.fixture
def client():
    registry = JobRegistry(succeed)
    app.dependency_overrides[get_jobs] = lambda: registry
    yield TestClient(app), registry
    app.dependency_overrides.clear()


def test_successful_job_reports_counts_and_version():
    registry = JobRegistry(succeed)
    job = registry.submit()
    assert job.status == "queued"

    done = registry.wait(job.id, timeout=5)
    assert done.status == "succeeded"
    assert (done.gaps_written, done.gaps_removed, done.engine_version) == (1234, 2, "0.2.0+tabc")
    assert done.created_at <= done.started_at <= done.finished_at
    assert done.error is None


def test_failed_job_reports_the_error_and_the_next_job_still_runs():
    registry = JobRegistry(fail)
    done = registry.wait(registry.submit().id, timeout=5)
    assert done.status == "failed"
    assert done.error == "RuntimeError: database is down"
    assert done.gaps_written is None
    assert registry.wait(registry.submit().id, timeout=5).status == "failed"  # worker survived


def test_some_indicators_failing_is_partial():
    result = RescoreResult(engine_version="v", gaps_written=1700, gaps_removed=0, indicators_scored=11, failures=[BROKEN])
    registry = JobRegistry(lambda: result)
    done = registry.wait(registry.submit().id, timeout=5)

    assert done.status == "partial"
    assert done.failed_indicators == [BROKEN]
    assert (done.gaps_written, done.indicators_scored) == (1700, 11)
    assert "1 indicator(s) failed" in done.error


def test_every_indicator_failing_is_failed():
    result = RescoreResult(engine_version="v", gaps_written=0, gaps_removed=0, indicators_scored=0, failures=[BROKEN])
    registry = JobRegistry(lambda: result)
    done = registry.wait(registry.submit().id, timeout=5)

    assert done.status == "failed"
    assert done.failed_indicators == [BROKEN]


def test_jobs_run_one_at_a_time_in_order():
    release = threading.Event()
    order: list[str] = []

    def slow() -> RescoreResult:
        order.append("start")
        release.wait(5)
        order.append("end")
        return RESULT

    registry = JobRegistry(slow)
    first, second = registry.submit(), registry.submit()
    assert registry.get(second.id).status == "queued"
    release.set()
    registry.wait(first.id, timeout=5)
    registry.wait(second.id, timeout=5)
    assert order == ["start", "end", "start", "end"]


def test_post_then_get(client):
    http, registry = client
    r = http.post("/jobs/rescore")
    assert r.status_code == 202
    job_id = r.json()["id"]
    registry.wait(job_id, timeout=5)

    r = http.get(f"/jobs/{job_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "succeeded"
    assert body["gaps_written"] == 1234


def test_unknown_job_is_404(client):
    http, _ = client
    assert http.get("/jobs/nope").status_code == 404
