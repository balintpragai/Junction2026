"""`engine` (internal): owns scoring and the rescore job.

`POST /jobs/rescore` starts a job that scores every Region × indicator × year,
upserts `fact_gap_score`, then fills the Narrative cache for the latest-year
Gaps (#17); `GET /jobs/{id}` reports its status. `seed`
triggers one after every load. There is no cron: the data only changes when
`seed` runs.
"""

import dataclasses
import logging
from collections.abc import Callable

from fastapi import Depends, FastAPI, HTTPException

from common.models import Health, RescoreJob
from common.settings import Settings

from . import narratives, rescore
from .jobs import JobRegistry

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")

settings = Settings.from_env().require("database_url", "narrative_url")

app = FastAPI(title="Reach Loop engine", version=rescore.ENGINE_VERSION)

log = logging.getLogger("engine")


def run_job(
    score: Callable[[str], rescore.RescoreResult] = rescore.run,
    fill: Callable[..., narratives.FillResult] = narratives.fill_cache,
) -> rescore.RescoreResult:
    """Score, then fill the Narrative cache. A Narrative problem never fails the job: the Gaps are scored."""
    result = score(settings.database_url)
    try:
        filled = fill(settings.database_url, narratives.HttpNarrativeClient(settings.narrative_url))  # type: ignore[arg-type]
    except Exception as e:
        log.exception("narrative step failed; Gaps are scored, cached Narratives unchanged")
        return dataclasses.replace(result, narrative_error=f"{type(e).__name__}: {e}")
    return dataclasses.replace(result, narratives=filled)


_jobs = JobRegistry(run_job)


def get_jobs() -> JobRegistry:
    return _jobs


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


@app.post("/jobs/rescore", response_model=RescoreJob, status_code=202)
def start_rescore(jobs: JobRegistry = Depends(get_jobs)) -> RescoreJob:
    """Queue a rescore. Poll `GET /jobs/{id}` until `status` is `succeeded` or `failed`."""
    return jobs.submit()


@app.get("/jobs/{job_id}", response_model=RescoreJob)
def get_job(job_id: str, jobs: JobRegistry = Depends(get_jobs)) -> RescoreJob:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id (job history is lost when engine restarts).")
    return job
