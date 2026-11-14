"""Start a rescore on `engine` and wait for it. Standard library only.

Used by `seed` after loading, and by `python -m app.rescore_now` inside the
`engine` container for a manual rescore.
"""

import json
import time
import urllib.request
from collections.abc import Callable

from .models import RescoreJob

DEFAULT_TIMEOUT_S = 600.0
POLL_INTERVAL_S = 1.0


class RescoreFailed(RuntimeError):
    def __init__(self, job: RescoreJob):
        super().__init__(f"rescore job {job.id} {job.status}: {job.error or 'no error message'}")
        self.job = job


def start_rescore(engine_url: str) -> RescoreJob:
    request = urllib.request.Request(f"{engine_url}/jobs/rescore", method="POST", data=b"")
    with urllib.request.urlopen(request, timeout=10) as r:
        return RescoreJob.model_validate(json.load(r))


def get_job(engine_url: str, job_id: str) -> RescoreJob:
    with urllib.request.urlopen(f"{engine_url}/jobs/{job_id}", timeout=10) as r:
        return RescoreJob.model_validate(json.load(r))


def rescore_and_wait(
    engine_url: str,
    *,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    poll_interval_s: float = POLL_INTERVAL_S,
    sleep: Callable[[float], None] = time.sleep,
) -> RescoreJob:
    """Start a rescore and poll until it finishes.

    Returns the job when it `succeeded` or was `partial` (check `failed_indicators`).
    Raises RescoreFailed if it `failed`, TimeoutError if it doesn't finish, and
    OSError (urllib.error.URLError) if `engine` can't be reached.
    """
    job = start_rescore(engine_url)
    waited = 0.0
    while not job.done:
        if waited >= timeout_s:
            raise TimeoutError(f"rescore job {job.id} still {job.status} after {timeout_s:.0f} s")
        sleep(poll_interval_s)
        waited += poll_interval_s
        job = get_job(engine_url, job.id)
    if job.status == "failed":
        raise RescoreFailed(job)
    return job
