"""In-memory job registry for the rescore job.

One worker thread runs jobs one at a time, in the order they were submitted.
Job history lives in memory only: it is lost when `engine` restarts, which is
fine, because the result of every job is in `fact_gap_score`.
"""

from __future__ import annotations

import logging
import threading
import uuid
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime

from common.models import RescoreJob

from .rescore import RescoreResult

log = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


class JobRegistry:
    def __init__(self, run: Callable[[], RescoreResult]):
        self._run = run
        self._jobs: dict[str, RescoreJob] = {}
        self._futures: dict[str, Future[None]] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rescore")

    def submit(self) -> RescoreJob:
        job = RescoreJob(id=uuid.uuid4().hex, status="queued", created_at=_now())
        with self._lock:
            self._jobs[job.id] = job
            self._futures[job.id] = self._executor.submit(self._execute, job.id)
        return job

    def get(self, job_id: str) -> RescoreJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def wait(self, job_id: str, timeout: float | None = None) -> RescoreJob:
        """Block until the job finishes. For tests and callers inside the process."""
        self._futures[job_id].result(timeout)
        job = self.get(job_id)
        assert job is not None
        return job

    def _update(self, job_id: str, **changes) -> None:
        with self._lock:
            self._jobs[job_id] = self._jobs[job_id].model_copy(update=changes)

    def _execute(self, job_id: str) -> None:
        self._update(job_id, status="running", started_at=_now())
        try:
            result = self._run()
        except Exception as e:  # report any failure on the job instead of losing it in the thread
            log.exception("rescore job %s failed", job_id)
            self._update(job_id, status="failed", finished_at=_now(), error=f"{type(e).__name__}: {e}")
            return
        log.info(
            "rescore job %s succeeded: %d Gaps written, %d removed, engine_version %s",
            job_id, result.gaps_written, result.gaps_removed, result.engine_version,
        )
        self._update(
            job_id,
            status="succeeded",
            finished_at=_now(),
            engine_version=result.engine_version,
            gaps_written=result.gaps_written,
            gaps_removed=result.gaps_removed,
        )
