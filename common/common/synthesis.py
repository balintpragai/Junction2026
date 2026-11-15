"""The plain-language reading of one Region's Gaps and covariates.

Deterministic and rule-based, in the same "exact by construction" spirit as
`common.template`'s single-Gap sentences, extended across every Gap and
covariate a Region has. There is no LLM call here and nothing to hallucinate
from: every sentence is a stated rule over figures that are already in the
profile, and every claim about what a covariate does or does not explain comes
from `research/covariate_correlation_analysis.md` and
`research/cancer_registry_screening_reports.md`.

`api` calls this when it builds a RegionProfile. Pure: no database, no network.
"""

from common.covariates import FOREIGN_BACKGROUND, KELA_TRAVEL_PER_CAPITA
from common.models import CovariateMeta, GapEntry


def _is_screening(entry: GapEntry) -> bool:
    """Screening indicators are cancer-specific; capacity and referral ones are not."""
    return entry.indicator.cancer_type is not None


def synthesize(
    region_name: str,
    gaps: list[GapEntry],
    covariates: dict[str, float],
    covariate_meta: dict[str, CovariateMeta],
    missing_data_notes: list[str],
) -> list[str]:
    """One paragraph per finding, in the order a decision-maker reads them.

    A covariate with no value this year is simply left out of the reasoning —
    it never becomes an assumed median or a silent zero.
    """
    out: list[str] = []

    screening = [g for g in gaps if _is_screening(g)]
    capacity = [g for g in gaps if not _is_screening(g)]
    bad_screening = [g for g in screening if g.gap.severity != "ok"]
    bad_capacity = [g for g in capacity if g.gap.severity != "ok"]

    if not bad_screening and not bad_capacity:
        out.append(
            f"{region_name} is at or ahead of target on every tracked indicator this year — no Gap needs action."
        )
    else:
        if bad_screening:
            types = [g.indicator.cancer_type for g in bad_screening]
            out.append(
                f"Screening attendance is below target for {', '.join(types)} cancer"
                f"{'s' if len(types) > 1 else ''}."
            )
            value = covariates.get(FOREIGN_BACKGROUND)
            meta = covariate_meta.get(FOREIGN_BACKGROUND)
            if value is not None and meta is not None:
                if value > meta.median:
                    out.append(
                        f"This Region's foreign-background share ({value:.1f}%) is above the national "
                        f"median ({meta.median:.1f}%) — the one covariate that predicts lower attendance "
                        f"at both the Region and individual level, confirmed two independent ways "
                        f"(see methodology)."
                    )
                else:
                    out.append(
                        "This Region's foreign-background share is at or below the national median, so that "
                        "covariate doesn't explain the gap here — worth checking the local screening "
                        "programme's own delivery rather than assuming it's an outreach problem."
                    )
        if bad_capacity:
            out.append(
                "Specialised-care access (long waits and/or referral processing) is also outside the ok range, "
                "and none of the structural factors this project checked (migration, income, travel distance, "
                "broadband) explain which Regions have this problem — that null result points at a capacity "
                "constraint on the supply side, not a demand-side access problem, so outreach alone won't fix it."
            )

    travel = covariates.get(KELA_TRAVEL_PER_CAPITA)
    travel_meta = covariate_meta.get(KELA_TRAVEL_PER_CAPITA)
    if travel is not None and travel_meta is not None and travel > travel_meta.median:
        out.append(
            f"Kela medical-travel reimbursement here runs EUR{travel:.1f}/capita, above the "
            f"EUR{travel_meta.median:.1f} national median — consistent with real distance to care, "
            f"not just a preference not to go."
        )

    if missing_data_notes:
        out.append(" ".join(missing_data_notes))

    return out
