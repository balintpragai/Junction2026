"""Route tests run against an in-memory repository built from the contract
fixtures, so they need no database. The SQL itself is tested against a real
Postgres in test_repository_postgres.py."""

from pathlib import Path

import pytest

from app.main import app, get_repository
from app.repository import ECOLOGICAL_FALLACY_NOTE, ECOLOGICAL_FALLACY_SHORT, NotFound
from common.models import (
    ActionLibrary,
    CovariateCaveat,
    CovariateMeta,
    GapEntry,
    GapSummary,
    IndicatorList,
    OutreachList,
    Overview,
    OverviewRow,
    ProfileSummary,
    RegionList,
    RegionProfile,
)
from common.actions import action_library as build_action_library
from common.actions import candidate_actions
from common.covariates import FOREIGN_BACKGROUND
from common.synthesis import synthesize

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
        # The profile is built from the same gap-summary fixture, so the fake and
        # the real repository agree on shape without a second fixture to keep in step.
        self.year = s.gap.year
        self.covariates = {FOREIGN_BACKGROUND: 20.4}
        self.covariate_meta = {
            FOREIGN_BACKGROUND: CovariateMeta(
                name="People with a foreign background", unit="% of population", median=7.0
            )
        }
        self.strategy_actions = [
            {
                "action_id": "2.4.1",
                "sub_objective_title": "Raise screening participation",
                "goal": "Earlier detection",
                "action_text": "Extend screening invitations with targeted reminders.",
                "strategy_page": "41",
            }
        ]

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

    def _entries(self, region_code: str, year: int) -> list[GapEntry]:
        return [
            GapEntry(
                indicator=s.indicator,
                gap=s.gap,
                narrative=s.narrative,
                data_quality_notes=s.data_quality_notes,
                action=s.action,
                trend=s.trend,
            )
            for (code, _, y), s in self.summaries.items()
            if code == region_code and y == year
        ]

    def region_profile(self, region_code: str, year: int | None = None) -> RegionProfile:
        region = next((r for r in self.regions.regions if r.code == region_code), None)
        if region is None:
            raise NotFound(f"Unknown region code {region_code!r}")
        year = self.year if year is None else year
        entries = self._entries(region_code, year)
        if not entries:
            raise NotFound(f"No Gaps for region {region_code!r} in {year}")
        notes: list[str] = []
        return RegionProfile(
            region=region,
            year=year,
            gaps=entries,
            covariates=self.covariates,
            covariate_meta=self.covariate_meta,
            covariate_caveat=CovariateCaveat(
                short=ECOLOGICAL_FALLACY_SHORT, full=ECOLOGICAL_FALLACY_NOTE
            ),
            missing_data_notes=notes,
            summary=ProfileSummary(
                indicators_tracked=len(entries),
                indicators_act=sum(1 for e in entries if e.gap.severity == "act"),
                indicators_watch=sum(1 for e in entries if e.gap.severity == "watch"),
            ),
            synthesis=synthesize(region.name, entries, self.covariates, self.covariate_meta, notes),
            candidate_actions=candidate_actions(
                region.name, entries, self.covariates, self.covariate_meta, {}
            ),
        )

    def overview(self, year: int | None = None) -> Overview:
        year = self.year if year is None else year
        rows = []
        for region in self.regions.regions:
            entries = self._entries(region.code, year)
            rows.append(
                OverviewRow(
                    region=region,
                    indicators_tracked=len(entries),
                    indicators_act=sum(1 for e in entries if e.gap.severity == "act"),
                    indicators_watch=sum(1 for e in entries if e.gap.severity == "watch"),
                )
            )
        return Overview(year=year, rows=rows)

    def action_library(self, region_code: str) -> ActionLibrary:
        region = next((r for r in self.regions.regions if r.code == region_code), None)
        if region is None:
            raise NotFound(f"Unknown region code {region_code!r}")
        return ActionLibrary(
            region_code=region_code, actions=build_action_library(region.name, self.strategy_actions)
        )


@pytest.fixture(autouse=True)
def fake_repository():
    app.dependency_overrides[get_repository] = FakeRepository
    yield
    app.dependency_overrides.pop(get_repository, None)
