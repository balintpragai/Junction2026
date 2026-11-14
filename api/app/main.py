"""`api`: the public, read-only Reach Loop API.

Every data route reads Postgres (see `repository.py`). Response shapes are the Pydantic
models in `common.models`; they are the contract with `web`. `api` never calls
an LLM on a request path.
"""

import logging
import os
from typing import Annotated

import psycopg
from fastapi import Depends, FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from common.models import GapSummary, Health, IndicatorList, OutreachList, RegionList
from common.settings import Settings

from .repository import NotFound, PostgresRepository, Repository

log = logging.getLogger("api")

CACHE_CONTROL = "max-age=300"

app = FastAPI(
    title="Reach Loop API",
    version="0.1.0",
    description="Read-only public API: Regions, indicators, Gap summaries and outreach lists.",
    separate_input_output_schemas=False,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("WEB_ORIGIN", "http://localhost:3000").split(",") if o],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _cache(response: Response) -> None:
    response.headers["Cache-Control"] = CACHE_CONTROL


def get_repository() -> Repository:
    return PostgresRepository(Settings.from_env().require("database_url").database_url)


Repo = Annotated[Repository, Depends(get_repository)]


@app.exception_handler(NotFound)
def _not_found(request: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(psycopg.OperationalError)
def _db_unavailable(request: Request, exc: psycopg.OperationalError) -> JSONResponse:
    log.error("database unavailable: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable, try again shortly."})


@app.get("/health", response_model=Health, tags=["meta"])
def health() -> Health:
    return Health(status="ok")


@app.get("/regions", response_model=RegionList, tags=["lookups"])
def list_regions(response: Response, repo: Repo) -> RegionList:
    result = repo.list_regions()
    _cache(response)
    return result


@app.get("/indicators", response_model=IndicatorList, tags=["lookups"])
def list_indicators(response: Response, repo: Repo) -> IndicatorList:
    result = repo.list_indicators()
    _cache(response)
    return result


@app.get(
    "/regions/{code}/gap-summary",
    response_model=GapSummary,
    tags=["gaps"],
    responses={404: {"description": "No Gap for this Region, indicator and year"}},
)
def gap_summary(
    code: str,
    response: Response,
    repo: Repo,
    indicator: str = Query(description="Indicator code, e.g. '3621'"),
    year: int = Query(description="Year, e.g. 2024"),
) -> GapSummary:
    summary = repo.gap_summary(code, indicator, year)  # NotFound -> 404
    _cache(response)
    return summary


@app.get(
    "/outreach-list",
    response_model=OutreachList,
    tags=["gaps"],
    responses={404: {"description": "No outreach list for this indicator and year"}},
)
def outreach_list(
    response: Response,
    repo: Repo,
    indicator: str = Query(description="Indicator code, e.g. '3621'"),
    year: int = Query(description="Year, e.g. 2024"),
) -> OutreachList:
    result = repo.outreach_list(indicator, year)  # NotFound -> 404
    _cache(response)
    return result
