"""Fixture-backed data source for Step 0 (contracts before code).

Every fixture is parsed through its Pydantic model at import time, so a fixture
that drifts from the contract stops the app from starting. Real Postgres
queries replace this module later; the routes in `main.py` stay the same.
"""

from pathlib import Path

from common.models import GapSummary, IndicatorList, OutreachList, RegionList

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load[M](model: type[M], name: str) -> M:
    return model.model_validate_json((FIXTURE_DIR / name).read_text(encoding="utf-8"))


REGIONS = _load(RegionList, "regions.json")
INDICATORS = _load(IndicatorList, "indicators.json")

# Keyed by (region_code, indicator_code, year) and (indicator_code, year).
GAP_SUMMARIES: dict[tuple[str, str, int], GapSummary] = {
    (s.region.code, s.indicator.code, s.gap.year): s
    for s in [_load(GapSummary, "gap_summary_helsinki_3621_2024.json")]
}
OUTREACH_LISTS: dict[tuple[str, int], OutreachList] = {
    (o.indicator.code, o.year): o for o in [_load(OutreachList, "outreach_list_3621_2024.json")]
}
