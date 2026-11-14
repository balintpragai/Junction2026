"""Tests for the pure Gap scoring function (ticket #8).

Scenario tests run on real THL Sotkanet values, frozen in
fixtures/sotkanet_values.json (see fixtures/build_fixture.py). Only the
threshold-edge cases at the bottom use hand-made numbers, because real data
never lands exactly on a boundary; each one says so.
"""

import json
import random
from pathlib import Path

import pytest

from app.scoring import SeverityThresholds, load_thresholds, score
from common.models import DataQualityNote, Gap, Indicator

# Peer groups as curated in data/curated/region_parent_area.csv (#4 / PR #23).
PARENT_AREA = {
    "01": "Uusimaa", "02": "Uusimaa", "03": "Uusimaa", "04": "Uusimaa", "90": "Uusimaa",
    "05": "Western Finland", "06": "Western Finland", "17": "Western Finland",
    "07": "Inland Finland", "08": "Inland Finland", "16": "Inland Finland",
    "09": "Southern Finland", "10": "Southern Finland", "11": "Southern Finland",
    "12": "Eastern Finland", "13": "Eastern Finland", "14": "Eastern Finland", "15": "Eastern Finland",
    "18": "Northern Finland", "19": "Northern Finland", "20": "Northern Finland", "21": "Northern Finland",
    "91": "Åland",
}
HELSINKI, ALAND = "90", "91"

THRESHOLDS = SeverityThresholds(target_watch_max_shortfall=3.0, z_watch=1.0, z_act=1.5)

_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "sotkanet_values.json").read_text(encoding="utf-8")
)

# Indicator metadata. Targets from the National Cancer Strategy 2026–2035: at
# least 80% participation in every screening programme, in every Region (p. 5,
# Figure 1, and p. 33). The strategy sets no Regional number for waiting times
# ("within target times", THL Guideline 21/2016), so those have no Target.
INDICATORS = {
    "3621": dict(unit="%", higher_is_better=True, target=80.0),  # breast screening
    "3620": dict(unit="%", higher_is_better=True, target=80.0),  # cervical screening
    "6103": dict(unit="%", higher_is_better=True, target=80.0),  # colorectal screening
    "3336": dict(unit="per 10,000", higher_is_better=False, target=None),  # waiting > 6 months
    "5033": dict(unit="%", higher_is_better=False, target=None),  # referrals > 21 days
}


def indicator(code: str, **overrides) -> Indicator:
    meta = {**INDICATORS[code], **overrides}
    years = sorted({int(y) for s in _FIXTURE["indicators"][code]["values"].values() for y in s})
    return Indicator(code=code, name=_FIXTURE["indicators"][code]["name"], years=years, **meta)


def values_of(code: str) -> dict[str, dict[int, float]]:
    """A fresh copy of one indicator's real values: Region code → year → value."""
    raw = _FIXTURE["indicators"][code]["values"]
    return {region: {int(y): v for y, v in series.items()} for region, series in raw.items()}


def peers_of(region: str) -> list[str]:
    return [c for c, area in PARENT_AREA.items() if area == PARENT_AREA[region] and c != region]


def score_one(ind_code, region, year=2024, *, values=None, peers=None, **ind_overrides):
    return score(
        indicator(ind_code, **ind_overrides),
        region,
        year,
        values_of(ind_code) if values is None else values,
        peers_of(region) if peers is None else peers,
        THRESHOLDS,
    )


def note_codes(result) -> list[str]:
    return [n.code for n in result.data_quality_notes]


# --- Acceptance: Helsinki breast screening 2024 -------------------------------


def test_helsinki_breast_screening_2024():
    result = score_one("3621", HELSINKI)
    gap = result.gap

    assert gap.value == 74.3
    assert gap.reference_kind == "target"
    assert gap.reference_value == 80
    assert gap.deviation == pytest.approx(-5.7)
    assert gap.direction == "below"
    assert gap.severity == "act"
    assert (gap.rank, gap.n_regions) == (22, 22)  # lowest of 22; Åland has no 3621 data
    assert [(p.region_code, p.value) for p in gap.peer_values] == [
        ("01", 79.8), ("02", 80.5), ("03", 76.1), ("04", 76.7)
    ]
    assert gap.trend_5y == pytest.approx(74.3 - 72.7)  # 2024 vs 2020
    assert result.data_quality_notes == ()


# --- Targeted thresholds, real 2024 breast screening --------------------------


@pytest.mark.parametrize(
    ("region", "value", "severity", "direction"),
    [
        ("02", 80.5, "ok", "above"),  # Central Uusimaa
        ("01", 79.8, "watch", "below"),  # East Uusimaa, 0.2 pp short
        ("04", 76.7, "act", "below"),  # Vantaa and Kerava, 3.3 pp short
    ],
)
def test_target_bands_on_real_values(region, value, severity, direction):
    gap = score_one("3621", region).gap
    assert (gap.value, gap.severity, gap.direction) == (value, severity, direction)


# --- Untargeted: z-score against the other Regions, real 2024 waiting > 6 months


@pytest.mark.parametrize(
    ("region", "value", "severity"),
    [
        ("13", 98.1, "act"),  # North Savo, z = +2.33 (bad: lower is better)
        ("19", 79.5, "watch"),  # North Ostrobothnia, z = +1.41
        ("07", 69.5, "ok"),  # Kanta-Häme, z = +0.99, just under 1
        ("11", 9.3, "ok"),  # South Karelia, z = −1.34: far off, but in the good direction
    ],
)
def test_untargeted_z_score_on_real_values(region, value, severity):
    gap = score_one("3336", region).gap
    assert gap.value == value
    assert gap.severity == severity
    assert gap.reference_kind == "peer_median"


def test_untargeted_reference_is_median_of_other_regions():
    gap = score_one("3336", "13").gap
    assert gap.reference_value == pytest.approx(38.5)
    assert gap.deviation == pytest.approx(98.1 - 38.5)
    assert gap.direction == "above"


def test_untargeted_good_direction_is_ok_when_higher_is_better():
    # Åland cervical screening 2024: 80.2%, z = +1.51 against the other Regions.
    # Real values, scored as if 3620 had no Target (no real higher-is-better
    # indicator without a Target is in the fixture).
    gap = score_one("3620", ALAND, target=None).gap
    assert (gap.reference_kind, gap.severity) == ("peer_median", "ok")


# --- trend_5y -----------------------------------------------------------------


def test_short_history_gives_null_trend_with_reason():
    # Colorectal screening only has 2022–24.
    result = score_one("6103", HELSINKI)

    assert result.gap.trend_5y is None
    [note] = result.data_quality_notes
    assert note.code == "trend_unavailable"
    assert note.message == "Data starts in 2022 (3 years up to 2024); a five-year trend needs a value for 2020."


def test_missing_middle_year_does_not_block_trend():
    # Central Ostrobothnia has no 2022 value for 5033; 2020 and 2024 are real.
    gap = score_one("5033", "18").gap
    assert gap.trend_5y == pytest.approx(2.0 - 2.0)


def test_missing_start_year_gives_null_trend_never_interpolated():
    # No real series has a hole exactly at the start year, so one real year is removed.
    values = values_of("3621")
    del values[HELSINKI][2020]
    result = score_one("3621", HELSINKI, values=values)

    assert result.gap.trend_5y is None
    [note] = result.data_quality_notes
    assert note.code == "trend_unavailable"
    assert "No value for 2020" in note.message


# --- Determinism --------------------------------------------------------------


def test_same_input_gives_same_output():
    first = score_one("3621", HELSINKI)
    second = score_one("3621", HELSINKI)
    assert first == second
    assert first.gap.model_dump_json() == second.gap.model_dump_json()


def test_input_order_does_not_change_output():
    values = values_of("3621")
    codes = list(values)
    random.Random(8).shuffle(codes)
    shuffled = {c: dict(reversed(list(values[c].items()))) for c in codes}

    assert score_one("3621", HELSINKI) == score_one(
        "3621", HELSINKI, values=shuffled, peers=list(reversed(peers_of(HELSINKI)))
    )


# --- Peers --------------------------------------------------------------------


def test_aland_has_no_peers_but_is_scored_as_usual():
    result = score_one("3620", ALAND)
    gap = result.gap

    assert peers_of(ALAND) == []
    assert gap.peer_values == []
    assert result.data_quality_notes == (
        DataQualityNote(code="no_peers", message="No peer Regions to compare with."),
    )
    assert gap.value == 80.2
    assert gap.reference_value == 80
    assert gap.deviation == pytest.approx(0.2)
    assert (gap.direction, gap.severity) == ("above", "ok")
    assert (gap.rank, gap.n_regions) == (3, 23)
    assert gap.trend_5y == pytest.approx(80.2 - 78.2)


def test_peers_without_a_value_are_left_out():
    # North Ostrobothnia 2022 on 5033: peer Central Ostrobothnia (18) has no 2022 value.
    gap = score_one("5033", "19", year=2022).gap
    assert [p.region_code for p in gap.peer_values] == ["20", "21"]


def test_peers_all_missing_gives_empty_list_and_note():
    # Helsinki 2021 on 3336: the four other Uusimaa Regions have no 3336 data at all.
    result = score_one("3336", HELSINKI, year=2021)

    assert result.gap.peer_values == []
    assert note_codes(result) == ["no_peer_values"]
    assert result.gap.value == 0.1
    assert result.gap.n_regions == 18


def test_peers_do_not_change_severity_rank_or_n_regions():
    with_peers = score_one("3621", HELSINKI).gap
    without = score_one("3621", HELSINKI, peers=[]).gap
    for field in ("severity", "rank", "n_regions", "deviation", "trend_5y"):
        assert getattr(with_peers, field) == getattr(without, field)


# --- Rank, missing values, contract shape -------------------------------------


@pytest.mark.parametrize(("region", "rank"), [("07", 1), ("09", 1), ("11", 1), ("05", 4), ("18", 12)])
def test_rank_ties_share_a_rank_lower_is_better(region, rank):
    # 5033 in 2024 is reported in whole percent: three Regions at 0, eight at 1, six at 2.
    gap = score_one("5033", region).gap
    assert (gap.rank, gap.n_regions) == (rank, 17)


def test_region_without_value_for_year_returns_none():
    # Helsinki's 3336 data stops in 2021 (data/README.md): no Gap, nothing interpolated.
    assert score_one("3336", HELSINKI, year=2024) is None


def test_output_matches_contract():
    result = score_one("3621", HELSINKI)
    assert isinstance(result.gap, Gap)
    assert set(result.gap.model_dump()) == set(Gap.model_fields)
    assert Gap.model_validate(result.gap.model_dump()) == result.gap
    assert all(isinstance(n, DataQualityNote) for n in result.data_quality_notes)


def test_shipped_thresholds_config():
    assert load_thresholds() == THRESHOLDS


# --- Threshold edges (hand-made: real data never lands exactly on a boundary) --


@pytest.mark.parametrize(
    ("value", "severity", "direction"),
    [(80.0, "ok", "at"), (77.0, "watch", "below"), (76.9, "act", "below")],
)
def test_target_boundaries(value, severity, direction):
    values = values_of("3621")
    values[HELSINKI][2024] = value
    gap = score_one("3621", HELSINKI, values=values).gap
    assert (gap.severity, gap.direction) == (severity, direction)


def test_target_shortfall_float_noise_at_the_boundary():
    # 78.3 − 75.3 is 3.0000000000000027 in floats; it must still count as 3 pp.
    values = values_of("3621")
    values[HELSINKI][2024] = 75.3
    assert score_one("3621", HELSINKI, values=values, target=78.3).gap.severity == "watch"


@pytest.mark.parametrize(("value", "severity"), [(10.0, "ok"), (12.5, "watch"), (13.5, "act")])
def test_target_lower_is_better_is_mirrored(value, severity):
    # No real indicator has a lower-is-better Target yet.
    values = {c: {2024: 10.0} for c in PARENT_AREA}
    values[HELSINKI][2024] = value
    gap = score_one("3336", HELSINKI, values=values, target=10.0).gap
    assert gap.severity == severity


@pytest.mark.parametrize(
    ("value", "higher_is_better", "severity"),
    [(10.0, True, "watch"), (7.5, True, "act"), (20.0, False, "watch"), (22.5, False, "act")],
)
def test_z_score_boundaries(value, higher_is_better, severity):
    # The 22 other Regions alternate 10 and 20: mean 15, population sd 5, so z is exact.
    others = [c for c in PARENT_AREA if c != HELSINKI]
    values = {c: {2024: 10.0 if i % 2 else 20.0} for i, c in enumerate(others)}
    values[HELSINKI] = {2024: value}
    gap = score_one("3620", HELSINKI, values=values, higher_is_better=higher_is_better, target=None).gap
    assert gap.severity == severity


def test_untargeted_without_spread_is_ok_with_note():
    values = {c: {2024: 50.0} for c in PARENT_AREA}
    values[HELSINKI][2024] = 10.0
    result = score_one("3620", HELSINKI, values=values, target=None)
    assert result.gap.severity == "ok"
    assert "z_score_undefined" in note_codes(result)


def test_nan_counts_as_missing():
    # Real data has no NaN, but a pandas loader produces it for empty cells.
    values = values_of("3621")
    values["01"][2024] = float("nan")
    gap = score_one("3621", HELSINKI, values=values).gap
    assert [p.region_code for p in gap.peer_values] == ["02", "03", "04"]
    assert gap.n_regions == 21
