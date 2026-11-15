"""`synthesize` must state only what the figures support, and stay silent when a
covariate has no value for the year."""

import pytest

from common.covariates import BROADBAND_GIGABIT, FOREIGN_BACKGROUND, KELA_TRAVEL_PER_CAPITA
from common.models import (
    CovariateMeta,
    DataQualityNote,
    Gap,
    GapEntry,
    Indicator,
    Narrative,
)
from common.synthesis import synthesize

META = {
    FOREIGN_BACKGROUND: CovariateMeta(name="People with a foreign background", unit="% of population", median=7.0),
    KELA_TRAVEL_PER_CAPITA: CovariateMeta(
        name="Kela medical travel reimbursements per inhabitant", unit="EUR per inhabitant", median=20.0
    ),
    BROADBAND_GIGABIT: CovariateMeta(name="Gigabit broadband available", unit="% of households", median=60.0),
}


def entry(code="3621", *, severity="act", cancer_type="breast", value=74.3, notes=()):
    indicator = Indicator(
        code=code,
        name="Breast cancer screening attendance",
        unit="%",
        higher_is_better=True,
        target=80.0,
        cancer_type=cancer_type,
        years=[2024],
    )
    gap = Gap(
        region_code="90",
        indicator_code=code,
        year=2024,
        value=value,
        reference_kind="target",
        reference_value=80.0,
        deviation=value - 80.0,
        direction="below",
        severity=severity,
        rank=21,
        n_regions=23,
        peer_values=[],
        trend_5y=None,
    )
    return GapEntry(
        indicator=indicator,
        gap=gap,
        narrative=Narrative(text="x", source="template", language="en"),
        data_quality_notes=[DataQualityNote(**n) for n in notes],
        action=None,
        trend=[],
    )


def test_no_gaps_says_so_and_nothing_else():
    out = synthesize("City of Helsinki", [entry(severity="ok")], {FOREIGN_BACKGROUND: 20.0}, META, [])
    assert out[0] == (
        "City of Helsinki is at or ahead of target on every tracked indicator this year — no Gap needs action."
    )
    assert not any("foreign-background" in s for s in out)


def test_screening_gap_names_every_cancer_type():
    gaps = [entry("3621", cancer_type="breast"), entry("3620", cancer_type="cervical")]
    out = synthesize("City of Helsinki", gaps, {FOREIGN_BACKGROUND: 20.0}, META, [])
    assert out[0] == "Screening attendance is below target for breast, cervical cancers."


def test_single_cancer_type_is_singular():
    out = synthesize("City of Helsinki", [entry()], {FOREIGN_BACKGROUND: 20.0}, META, [])
    assert out[0] == "Screening attendance is below target for breast cancer."


def test_foreign_background_above_median_is_called_out_with_both_figures():
    out = synthesize("City of Helsinki", [entry()], {FOREIGN_BACKGROUND: 20.4}, META, [])
    assert "20.4%" in out[1] and "7.0%" in out[1]
    assert "above the national median" in out[1]


def test_foreign_background_at_or_below_median_does_not_explain_the_gap():
    out = synthesize("Kainuu", [entry()], {FOREIGN_BACKGROUND: 2.1}, META, [])
    assert "doesn't explain the gap here" in out[1]


def test_a_missing_covariate_is_never_treated_as_at_the_median():
    """No value for the year means no sentence about it — not an assumed median."""
    out = synthesize("Åland", [entry()], {}, {}, [])
    assert len(out) == 1
    assert not any("foreign-background" in s or "median" in s for s in out)


def test_capacity_gap_reports_the_null_covariate_result():
    out = synthesize("Lapland", [entry("3336", cancer_type=None)], {}, {}, [])
    assert "capacity constraint on the supply side" in " ".join(out)


def test_travel_above_median_is_reported_once_gaps_exist():
    out = synthesize("Lapland", [entry()], {KELA_TRAVEL_PER_CAPITA: 48.6}, META, [])
    assert any("EUR48.6/capita" in s and "EUR20.0" in s for s in out)


def test_travel_at_or_below_median_is_silent():
    out = synthesize("City of Helsinki", [entry()], {KELA_TRAVEL_PER_CAPITA: 9.0}, META, [])
    assert not any("medical-travel" in s for s in out)


def test_missing_data_notes_are_appended_verbatim():
    notes = ["No 2024 data for: Referrals processed within 3 days."]
    out = synthesize("City of Helsinki", [entry()], {}, {}, notes)
    assert out[-1] == notes[0]


@pytest.mark.parametrize("severity", ["watch", "act"])
def test_watch_counts_as_a_gap_not_just_act(severity):
    out = synthesize("City of Helsinki", [entry(severity=severity)], {}, {}, [])
    assert out[0].startswith("Screening attendance is below target")
