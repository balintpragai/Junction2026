"""`engine` (internal): owns scoring and the rescore job.

`POST /jobs/rescore` starts a job that scores every Region × indicator × year
and upserts `fact_gap_score`; `GET /jobs/{id}` reports its status. `seed`
triggers one after every load. There is no cron: the data only changes when
`seed` runs.
"""

import logging

from fastapi import Depends, FastAPI, HTTPException

from common.models import Health, RescoreJob
from common.settings import Settings

from . import rescore
from .jobs import JobRegistry

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")

settings = Settings.from_env().require("database_url", "narrative_url")

app = FastAPI(title="Reach Loop engine", version=rescore.ENGINE_VERSION)

_jobs = JobRegistry(lambda: rescore.run(settings.database_url))  # type: ignore[arg-type]


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
