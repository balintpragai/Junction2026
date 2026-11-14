"""Tests for the rescore job's pure step, compute_gaps() (ticket #13).

Runs on the same frozen THL Sotkanet values as test_scoring.py. The database
steps (load_inputs, write_gaps) are checked end to end by `docker compose up`;
see the PR for #13.
"""

import pytest

from app.rescore import (
    ENGINE_VERSION,
    RegionInfo,
    ScoringInputs,
    compute_gaps,
    engine_version,
    peer_groups,
)
from app.scoring import SeverityThresholds, score
from common.models import DataQualityNote
from test_scoring import ALAND, HELSINKI, INDICATORS, PARENT_AREA, THRESHOLDS, indicator, values_of

# Sorted as load_inputs() returns them: Regions by code, indicators by id.
REGIONS = [RegionInfo(region_id=1000 + int(code), code=code, parent_area=PARENT_AREA[code]) for code in sorted(PARENT_AREA)]


def inputs(**overrides) -> ScoringInputs:
    base = dict(
        regions=REGIONS,
        indicators=[indicator(code) for code in sorted(INDICATORS)],
        values={code: values_of(code) for code in INDICATORS},
    )
    return ScoringInputs(**{**base, **overrides})


def find(rows, indicator_code, region_code, year):
    [row] = [r for r in rows if (r.gap.indicator_code, r.gap.region_code, r.gap.year) == (indicator_code, region_code, year)]
    return row


@pytest.fixture(scope="module")
def rows():
    return compute_gaps(inputs(), THRESHOLDS)


def test_helsinki_breast_screening_2024_matches_the_scoring_test(rows):
    row = find(rows, "3621", HELSINKI, 2024)
    assert row.region_id == 1090
    assert row.gap.deviation == pytest.approx(-5.7)
    assert (row.gap.severity, row.gap.direction) == ("act", "below")
    assert [p.region_code for p in row.gap.peer_values] == ["01", "02", "03", "04"]


def test_one_row_per_region_indicator_year_with_a_value(rows):
    expected = {
        (code, region, year)
        for code in INDICATORS
        for region, series in values_of(code).items()
        for year, value in series.items()
        if value is not None
    }
    got = [(r.gap.indicator_code, r.gap.region_code, r.gap.year) for r in rows]
    assert len(got) == len(set(got))
    assert set(got) == expected


def test_every_row_equals_calling_score_directly(rows):
    peers = peer_groups(REGIONS)
    for row in rows:
        code, region, year = row.gap.indicator_code, row.gap.region_code, row.gap.year
        direct = score(indicator(code), region, year, values_of(code), peers[region], THRESHOLDS)
        assert row.gap == direct.gap
        assert row.data_quality_notes == direct.data_quality_notes


def test_aland_is_written_with_empty_peers_and_a_note_not_skipped(rows):
    row = find(rows, "3620", ALAND, 2024)
    assert row.gap.peer_values == []
    assert "no_peers" in [n.code for n in row.data_quality_notes]


def test_missing_years_produce_no_row(rows):
    # Helsinki's 3336 data stops in 2021: no Gap for 2022-24, nothing interpolated.
    assert not [r for r in rows if (r.gap.indicator_code, r.gap.region_code) == ("3336", HELSINKI) and r.gap.year > 2021]


def test_stored_value_notes_come_first_then_scoring_notes():
    stored = DataQualityNote(code="short_history", message="Only 2022-24.")
    rows = compute_gaps(inputs(value_notes={("6103", HELSINKI, 2024): [stored]}), THRESHOLDS)
    notes = find(rows, "6103", HELSINKI, 2024).data_quality_notes
    assert [n.code for n in notes] == ["short_history", "trend_unavailable"]


def test_output_is_deterministic_and_ordered(rows):
    assert compute_gaps(inputs(), THRESHOLDS) == rows
    keys = [(r.gap.indicator_code, r.gap.year, r.gap.region_code) for r in rows]
    assert keys == sorted(keys)


def test_peer_groups_follow_parent_area():
    peers = peer_groups(REGIONS)
    assert peers[HELSINKI] == ["01", "02", "03", "04"]
    assert peers[ALAND] == []
    assert peers["13"] == ["12", "14", "15"]


def test_no_parent_area_means_no_peers():
    assert peer_groups([RegionInfo(1, "01", None), RegionInfo(2, "02", None)]) == {"01": [], "02": []}


def test_engine_version_changes_with_thresholds():
    other = SeverityThresholds(target_watch_max_shortfall=2.0, z_watch=1.0, z_act=1.5)
    assert engine_version(THRESHOLDS).startswith(f"{ENGINE_VERSION}+t")
    assert engine_version(THRESHOLDS) == engine_version(THRESHOLDS)
    assert engine_version(THRESHOLDS) != engine_version(other)
