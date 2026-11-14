"""Route tests run against an in-memory repository built from the contract
fixtures, so they need no database. The SQL itself is tested against a real
Postgres in test_repository_postgres.py."""

from pathlib import Path

import pytest

from app.main import app, get_repository
from app.repository import NotFound
from common.models import GapSummary, IndicatorList, OutreachList, RegionList

FIXTURES = Path(__file__).parent / "fixtures"


def _load(model, name):
    return model.model_validate_json((FIXTURES / name).read_text(encoding="utf-8"))


class FakeRepository:
    def __init__(self) -> None:
        self.regions = _load(RegionList, "regions.json")
        self.indicators = _load(IndicatorList, "indicators.json")
        s = _load(GapSummary, "gap_summary_helsinki_3621_2024.json")
        self.summaries = {(s.region.code, s.indicator.code, s.gap.year): s}
        o = _load(OutreachList, "outreach_list_3621_2024.json")
        self.outreach = {(o.indicator.code, o.year): o}

    def list_regions(self) -> RegionList:
        return self.regions

    def list_indicators(self) -> IndicatorList:
        return self.indicators

    def gap_summary(self, region_code: str, indicator_code: str, year: int) -> GapSummary:
        if region_code not in {r.code for r in self.regions.regions}:
            raise NotFound(f"Unknown region code {region_code!r}")
        if indicator_code not in {i.code for i in self.indicators.indicators}:
            raise NotFound(f"Unknown indicator code {indicator_code!r}")
        try:
            return self.summaries[(region_code, indicator_code, year)]
        except KeyError:
            raise NotFound(f"No Gap for region {region_code!r}, indicator {indicator_code!r} in {year}") from None

    def outreach_list(self, indicator_code: str, year: int) -> OutreachList:
        try:
            return self.outreach[(indicator_code, year)]
        except KeyError:
            raise NotFound(f"No outreach list for indicator {indicator_code!r} in {year}") from None


@pytest.fixture(autouse=True)
def fake_repository():
    app.dependency_overrides[get_repository] = FakeRepository
    yield
    app.dependency_overrides.pop(get_repository, None)
