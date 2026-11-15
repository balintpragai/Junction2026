"""The candidate-action rules: deterministic, and never fired by a covariate
that has no value for the year."""

from common.actions import action_library, candidate_actions, strategy_source
from common.covariates import BROADBAND_GIGABIT, FOREIGN_BACKGROUND, KELA_TRAVEL_PER_CAPITA
from common.models import CovariateMeta, Gap, GapEntry, Indicator, Narrative

META = {
    FOREIGN_BACKGROUND: CovariateMeta(name="People with a foreign background", unit="% of population", median=7.0),
    KELA_TRAVEL_PER_CAPITA: CovariateMeta(
        name="Kela medical travel reimbursements per inhabitant", unit="EUR per inhabitant", median=20.0
    ),
    BROADBAND_GIGABIT: CovariateMeta(name="Gigabit broadband available", unit="% of households", median=60.0),
}

ACTION_2_4_1 = {
    "action_id": "2.4.1",
    "sub_objective_title": "Raise screening participation",
    "goal": "Earlier detection",
    "action_text": "Extend screening invitations with targeted reminders.",
    "strategy_page": "41",
}
LINK = {"source_ref": "Strategy §2.4", "source_quote": "participation must rise in every region"}


def entry(code="3621", *, severity="act", cancer_type="breast", name="Breast cancer screening attendance"):
    indicator = Indicator(
        code=code, name=name, unit="%", higher_is_better=True, target=80.0, cancer_type=cancer_type, years=[2024]
    )
    gap = Gap(
        region_code="90",
        indicator_code=code,
        year=2024,
        value=74.3,
        reference_kind="target",
        reference_value=80.0,
        deviation=-5.7,
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
        data_quality_notes=[],
        action=None,
        trend=[],
    )


def ids(actions):
    return [a.id for a in actions]


def test_an_ok_gap_matches_no_strategy_action():
    out = candidate_actions("City of Helsinki", [entry(severity="ok")], {}, {}, {"3621": (ACTION_2_4_1, LINK)})
    assert ids(out) == []


def test_matched_strategy_action_leads_with_what_to_do():
    out = candidate_actions("City of Helsinki", [entry()], {}, {}, {"3621": (ACTION_2_4_1, LINK)})
    assert out[0].id == "strategy-2.4.1"
    assert out[0].title == ACTION_2_4_1["action_text"]
    assert out[0].kind == "strategy"
    assert out[0].recommended is True
    assert "Matched to the breast Gap." in out[0].why
    assert out[0].workflow.type == "stakeholder_message"
    assert out[0].workflow.target == "City of Helsinki wellbeing services county — screening programme lead"


def test_indicators_sharing_one_action_merge_into_a_single_card():
    """2.4.1 is rank 1 for breast, cervical and colorectal — one card, not three."""
    gaps = [
        entry("3621", cancer_type="breast"),
        entry("3620", cancer_type="cervical"),
        entry("6103", cancer_type="colorectal"),
    ]
    matched = {c: (ACTION_2_4_1, LINK) for c in ("3621", "3620", "6103")}
    out = candidate_actions("City of Helsinki", gaps, {}, {}, matched)
    strategy = [a for a in out if a.kind == "strategy"]
    assert len(strategy) == 1
    assert "breast, cervical and colorectal screening Gaps" in strategy[0].why


def test_an_indicator_with_no_curated_action_is_skipped_not_invented():
    out = candidate_actions("City of Helsinki", [entry("3336", cancer_type=None)], {}, {}, {})
    assert "strategy-3336" not in ids(out)


def test_multilingual_outreach_fires_above_median_with_a_screening_gap():
    out = candidate_actions("City of Helsinki", [entry()], {FOREIGN_BACKGROUND: 20.4}, META, {})
    action = next(a for a in out if a.id == "multilingual-outreach")
    assert "20.4%" in action.why and "7.0%" in action.why
    assert action.workflow.type == "patient_message"


def test_multilingual_outreach_does_not_fire_without_a_screening_gap():
    capacity_only = [entry("3336", cancer_type=None, name="Patients waiting over 6 months")]
    out = candidate_actions("Lapland", capacity_only, {FOREIGN_BACKGROUND: 20.4}, META, {})
    assert "multilingual-outreach" not in ids(out)


def test_multilingual_outreach_does_not_fire_at_or_below_median():
    out = candidate_actions("Kainuu", [entry()], {FOREIGN_BACKGROUND: 7.0}, META, {})
    assert "multilingual-outreach" not in ids(out)


def test_a_missing_covariate_fires_nothing():
    """No value this year must not be read as "at the median" either way."""
    out = candidate_actions("Åland", [entry()], {}, {}, {})
    assert ids(out) == []


def test_low_bandwidth_channel_fires_below_median():
    out = candidate_actions("Lapland", [entry()], {BROADBAND_GIGABIT: 31.2}, META, {})
    action = next(a for a in out if a.id == "low-bandwidth-channel")
    assert "31.2%" in action.why and "60.0%" in action.why


def test_capacity_review_fires_only_for_a_non_cancer_indicator():
    screening_only = candidate_actions("City of Helsinki", [entry()], {}, {}, {})
    assert "capacity-review" not in ids(screening_only)
    with_capacity = candidate_actions("Lapland", [entry("3336", cancer_type=None)], {}, {}, {})
    assert "capacity-review" in ids(with_capacity)
    action = next(a for a in with_capacity if a.id == "capacity-review")
    assert action.workflow.target == "Lapland wellbeing services county board"


def test_travel_awareness_fires_on_travel_alone_without_a_screening_gap():
    capacity_only = [entry("3336", cancer_type=None)]
    out = candidate_actions("Lapland", capacity_only, {KELA_TRAVEL_PER_CAPITA: 48.6}, META, {})
    assert "travel-reimbursement-awareness" in ids(out)
    assert "mobile-screening" not in ids(out)


def test_strategy_source_quotes_the_link_when_there_is_one():
    assert strategy_source(ACTION_2_4_1) == "National Cancer Strategy 2026–2035, p.41 (action 2.4.1)"
    assert 'linked via Strategy §2.4: "participation must rise in every region"' in strategy_source(
        ACTION_2_4_1, LINK
    )


def test_action_library_is_the_whole_strategy_marked_not_recommended():
    out = action_library("City of Helsinki", [ACTION_2_4_1])
    assert len(out) == 1
    assert out[0].recommended is False
    assert out[0].id == "strategy-2.4.1"
    assert "was not matched to a Gap" in out[0].why
