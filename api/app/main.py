"""`api`: the public, read-only Reach Loop API.

Step 0 serves fixtures (see `fixtures.py`). Response shapes are the Pydantic
models in `common.models`; they are the contract with `web`.
"""

import os

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from common.models import GapSummary, Health, IndicatorList, OutreachList, RegionList

from . import fixtures

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


@app.get("/health", response_model=Health, tags=["meta"])
def health() -> Health:
    return Health(status="ok")


@app.get("/regions", response_model=RegionList, tags=["lookups"])
def list_regions(response: Response) -> RegionList:
    _cache(response)
    return fixtures.REGIONS


@app.get("/indicators", response_model=IndicatorList, tags=["lookups"])
def list_indicators(response: Response) -> IndicatorList:
    _cache(response)
    return fixtures.INDICATORS


@app.get(
    "/regions/{code}/gap-summary",
    response_model=GapSummary,
    tags=["gaps"],
    responses={404: {"description": "No Gap for this Region, indicator and year"}},
)
def gap_summary(
    code: str,
    response: Response,
    indicator: str = Query(description="Indicator code, e.g. '3621'"),
    year: int = Query(description="Year, e.g. 2024"),
) -> GapSummary:
    summary = fixtures.GAP_SUMMARIES.get((code, indicator, year))
    if summary is None:
        raise HTTPException(404, f"No Gap for region={code!r}, indicator={indicator!r}, year={year}")
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
    indicator: str = Query(description="Indicator code, e.g. '3621'"),
    year: int = Query(description="Year, e.g. 2024"),
) -> OutreachList:
    result = fixtures.OUTREACH_LISTS.get((indicator, year))
    if result is None:
        raise HTTPException(404, f"No outreach list for indicator={indicator!r}, year={year}")
    _cache(response)
    return result
