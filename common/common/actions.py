"""Which actions a Region's Gaps call for, decided by stated rules.

Two kinds, both deterministic:

* **strategy** — the National Cancer Strategy action curated against an
  indicator in `data/curated/strategy_action_indicator.csv`, surfaced for every
  Gap in this Region that is not `ok`. The link, its rank and the quote that
  justifies it are all curated by hand; nothing is inferred here.
* **covariate** — a rule in `COVARIATE_RULES` below, each one a condition on a
  covariate plus the finding from `research/covariate_correlation_analysis.md`
  that makes it defensible. A rule fires only when its covariate has a value
  this year; a missing covariate never counts as "at the median".

No LLM decides any of this, and `recommended` is True only where a rule
matched. `action_library` returns the whole strategy in the same shape with
`recommended=False`, so a decision-maker can add an action the rules missed.

Pure: no database, no network. `api` passes the rows it has already read.
"""

from collections.abc import Callable
from dataclasses import dataclass

from common.covariates import BROADBAND_GIGABIT, FOREIGN_BACKGROUND, KELA_TRAVEL_PER_CAPITA
from common.models import (
    CandidateAction,
    CovariateMeta,
    GapEntry,
    PatientWorkflow,
    StakeholderWorkflow,
)

STRATEGY_SOURCE = "National Cancer Strategy 2026–2035"


def strategy_source(action: dict, link: dict | None = None) -> str:
    """Where this action came from, and — for a matched action — why it was linked."""
    page = (action.get("strategy_page") or "").strip()
    base = f"{STRATEGY_SOURCE}, p.{page} (action {action['action_id']})" if page else STRATEGY_SOURCE
    ref, quote = (link or {}).get("source_ref"), (link or {}).get("source_quote")
    if ref and quote:
        return f'{base} — linked via {ref}: "{quote}"'
    return base


def _screening_gap(entry: GapEntry) -> bool:
    """A cancer-specific indicator outside the ok range."""
    return entry.gap.severity != "ok" and entry.indicator.cancer_type is not None


def _capacity_gap(entry: GapEntry) -> bool:
    """A non-cancer-specific indicator (waits, referrals) outside the ok range."""
    return entry.gap.severity != "ok" and entry.indicator.cancer_type is None


@dataclass(frozen=True)
class CovariateRule:
    """One covariate-driven action, with the covariate whose figures fill its `why`."""

    id: str
    title: str
    description: str
    why: str
    workflow: StakeholderWorkflow | PatientWorkflow
    covariate: str | None
    applies: Callable[[list[GapEntry], dict[str, float], dict[str, CovariateMeta]], bool]


def _above_median(covariate: str) -> Callable[[dict[str, float], dict[str, CovariateMeta]], bool]:
    def test(covariates: dict[str, float], meta: dict[str, CovariateMeta]) -> bool:
        value, m = covariates.get(covariate), meta.get(covariate)
        return value is not None and m is not None and value > m.median

    return test


def _below_median(covariate: str) -> Callable[[dict[str, float], dict[str, CovariateMeta]], bool]:
    def test(covariates: dict[str, float], meta: dict[str, CovariateMeta]) -> bool:
        value, m = covariates.get(covariate), meta.get(covariate)
        return value is not None and m is not None and value < m.median

    return test


COVARIATE_RULES: tuple[CovariateRule, ...] = (
    CovariateRule(
        id="multilingual-outreach",
        title="Multilingual, community-based screening outreach",
        description=(
            "Targeted invitations and reminders in the Region's most common non-Finnish/Swedish "
            "languages, run with community organisations rather than a generic translation."
        ),
        why=(
            "Foreign background share here ({value:.1f}%) is above the national median "
            "({median:.1f}%), and this is the one covariate that predicts lower screening "
            "attendance at both the Region and individual level (see methodology) — a "
            "double-confirmed, defensible targeting signal."
        ),
        workflow=PatientWorkflow(
            type="patient_message",
            profile="invitees whose recorded native language is not Finnish or Swedish",
        ),
        covariate=FOREIGN_BACKGROUND,
        applies=lambda gaps, cov, meta: _above_median(FOREIGN_BACKGROUND)(cov, meta)
        and any(_screening_gap(g) for g in gaps),
    ),
    CovariateRule(
        id="mobile-screening",
        title="Mobile screening unit / local transport partnership",
        description=(
            "Bring the screening van to outlying municipalities, or subsidise a shared-ride service "
            "to the nearest screening site, instead of asking residents to travel alone."
        ),
        why=(
            "Kela medical-travel reimbursement here is EUR {value:.1f}/capita, above the "
            "EUR {median:.1f}/capita national median — this Region's residents already claim well "
            "above the typical travel cost, consistent with real distance being a barrier, not just "
            "a preference."
        ),
        workflow=StakeholderWorkflow(
            type="stakeholder_message",
            target="{region} wellbeing services county — transport & logistics",
        ),
        covariate=KELA_TRAVEL_PER_CAPITA,
        applies=lambda gaps, cov, meta: _above_median(KELA_TRAVEL_PER_CAPITA)(cov, meta)
        and any(_screening_gap(g) for g in gaps),
    ),
    CovariateRule(
        id="travel-reimbursement-awareness",
        title="Travel-reimbursement awareness campaign",
        description=(
            "Make sure patients already know Kela covers most of the trip cost before they decide "
            "not to go — a lot of the real barrier may be not knowing the reimbursement exists."
        ),
        why=(
            "This Region's travel-reimbursement spend per capita is already above median — the "
            "programme is used, but awareness of it (rather than just its existence) is worth "
            "checking before assuming distance alone explains any remaining gap."
        ),
        workflow=PatientWorkflow(type="patient_message", profile="all invitees in this Region"),
        covariate=None,
        applies=lambda gaps, cov, meta: _above_median(KELA_TRAVEL_PER_CAPITA)(cov, meta),
    ),
    CovariateRule(
        id="low-bandwidth-channel",
        title="SMS/voice-first reminder channel",
        description=(
            "Default to SMS and a voice-narrated message rather than a My Kanta app push, for "
            "Regions where fast home broadband is less available."
        ),
        why=(
            "Gigabit broadband reaches only {value:.1f}% of households here, below the "
            "{median:.1f}% national median — an app-first reminder is more likely to be missed "
            "than in a better-connected Region."
        ),
        workflow=PatientWorkflow(
            type="patient_message", profile="all invitees in this Region (SMS/voice channel)"
        ),
        covariate=BROADBAND_GIGABIT,
        applies=lambda gaps, cov, meta: _below_median(BROADBAND_GIGABIT)(cov, meta),
    ),
    CovariateRule(
        id="capacity-review",
        title="Primary-care / specialist capacity review",
        description=(
            "A direct staffing and scheduling review with the Region's own specialised-care "
            "management — not an outreach fix, because the data here doesn't point to a "
            "demand-side cause."
        ),
        why=(
            "The long-wait/referral figures here are outside the ok range, and none of the "
            "covariates we track explain which Regions have this problem (all |r| <= 0.27 against "
            "this measure) — that pattern points at capacity, not access, so an outreach campaign "
            "is the wrong tool."
        ),
        workflow=StakeholderWorkflow(
            type="stakeholder_message", target="{region} wellbeing services county board"
        ),
        covariate=None,
        applies=lambda gaps, cov, meta: any(_capacity_gap(g) for g in gaps),
    ),
)


def _fill_workflow(
    workflow: StakeholderWorkflow | PatientWorkflow, region_name: str
) -> StakeholderWorkflow | PatientWorkflow:
    if isinstance(workflow, StakeholderWorkflow):
        return StakeholderWorkflow(type="stakeholder_message", target=workflow.target.format(region=region_name))
    return PatientWorkflow(type="patient_message", profile=workflow.profile.format(region=region_name))


def _screening_lead(region_name: str) -> StakeholderWorkflow:
    return StakeholderWorkflow(
        type="stakeholder_message",
        target=f"{region_name} wellbeing services county — screening programme lead",
    )


def candidate_actions(
    region_name: str,
    gaps: list[GapEntry],
    covariates: dict[str, float],
    covariate_meta: dict[str, CovariateMeta],
    matched: dict[str, tuple[dict, dict]],
) -> list[CandidateAction]:
    """Strategy actions matched to this Region's Gaps, then the covariate rules that fire.

    `matched` maps an indicator code to (action row, link row) — the curated
    top-ranked action for that indicator, as read from the database.
    """
    out: list[CandidateAction] = []

    # Several screening indicators often share the same top-ranked action (2.4.1
    # is rank 1 for breast, cervical AND colorectal), so merge by action id
    # rather than repeating an identical card per indicator.
    by_action: dict[str, dict] = {}
    for entry in gaps:
        if entry.gap.severity == "ok":
            continue
        pair = matched.get(entry.indicator.code)
        if pair is None:
            continue
        action, link = pair
        merged = by_action.setdefault(action["action_id"], {"action": action, "link": link, "labels": []})
        merged["labels"].append(entry.indicator.cancer_type or entry.indicator.name.lower())

    for action_id, merged in by_action.items():
        action, link, labels = merged["action"], merged["link"], merged["labels"]
        if len(labels) > 1:
            label = f"{', '.join(labels[:-1])} and {labels[-1]} screening Gaps"
        else:
            label = f"{labels[0]} Gap"
        out.append(
            CandidateAction(
                id=f"strategy-{action_id}",
                kind="strategy",
                recommended=True,
                # The action text is what someone would actually DO, so it leads;
                # the sub-objective is the context it sits under.
                title=action["action_text"],
                description=f"Sub-objective {action_id}: {action['sub_objective_title']}",
                why=f"Matched to the {label}. {strategy_source(action, link)}",
                workflow=_screening_lead(region_name),
            )
        )

    for rule in COVARIATE_RULES:
        if not rule.applies(gaps, covariates, covariate_meta):
            continue
        why = rule.why
        if rule.covariate and "{value" in why:
            why = why.format(value=covariates[rule.covariate], median=covariate_meta[rule.covariate].median)
        out.append(
            CandidateAction(
                id=rule.id,
                kind="covariate",
                recommended=True,
                title=rule.title,
                description=rule.description,
                why=why,
                workflow=_fill_workflow(rule.workflow, region_name),
            )
        )

    return out


def action_library(region_name: str, actions: list[dict]) -> list[CandidateAction]:
    """Every curated strategy action, in CandidateAction shape, `recommended=False`."""
    return [
        CandidateAction(
            id=f"strategy-{action['action_id']}",
            kind="strategy",
            recommended=False,
            title=action["action_text"],
            description=f"Sub-objective {action['action_id']}: {action['sub_objective_title']}",
            why=(
                "Added from the National Cancer Strategy by hand — this one was not matched to a "
                f"Gap in this Region by the rules. {strategy_source(action)}"
            ),
            workflow=_screening_lead(region_name),
        )
        for action in sorted(actions, key=lambda a: a["action_id"])
    ]
