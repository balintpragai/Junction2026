"""Response models for the public `api` service.

These models are the contract between `api` and `web`. FastAPI turns them into
the OpenAPI spec, and `scripts/gen-api-types.sh` turns that spec into the
TypeScript types in `web/src/lib/api-types.ts`. Change a model here, then
regenerate the types.

Vocabulary follows GLOSSARY.md: Region, Gap, Target, Severity, Narrative,
Template sentence.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Severity = Literal["ok", "watch", "act"]
"""How urgently a Gap calls for action, set by fixed thresholds."""

GapDirection = Literal["above", "below", "at"]
"""Where the Region's value sits relative to the reference value."""

ReferenceKind = Literal["target", "peer_median"]
"""What a Gap is measured against: a Target, or the other Regions when the
indicator has no Target."""

NarrativeSource = Literal["llm", "template"]
"""`llm` = model output that passed the number check; `template` = a
Template sentence."""


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# --- Lookups -----------------------------------------------------------------


class Region(ContractModel):
    """One of the 23 areas THL reports on."""

    code: str = Field(description="Stable Region identifier used in URLs.")
    name: str = Field(description="Display name, e.g. 'Helsinki'.")
    kind: Literal["wellbeing_services_county", "city_of_helsinki", "aland"]


class RegionList(ContractModel):
    regions: list[Region]


class Indicator(ContractModel):
    code: str = Field(description="Sotkanet indicator id, e.g. '3621'.")
    name: str
    unit: str = Field(description="Unit of `value`, e.g. '%'.")
    higher_is_better: bool
    target: float | None = Field(
        description="National Cancer Strategy Target, or null when the indicator has none."
    )
    years: list[int] = Field(description="Years with data, ascending.")


class IndicatorList(ContractModel):
    indicators: list[Indicator]


# --- Gap summary ------------------------------------------------------------


class PeerValue(ContractModel):
    region_code: str
    value: float


class TrendPoint(ContractModel):
    year: int
    value: float


class Gap(ContractModel):
    """How far one Region's value on one indicator, in one year, sits from its
    Target (or from the other Regions when there is no Target)."""

    region_code: str
    indicator_code: str
    year: int
    value: float
    reference_kind: ReferenceKind
    reference_value: float = Field(description="The Target, or the peer median.")
    deviation: float = Field(description="value − reference_value, signed, in the indicator's unit.")
    direction: GapDirection
    severity: Severity
    rank: int = Field(ge=1, description="Position among n_regions; 1 = best performing.")
    n_regions: int = Field(ge=1)
    peer_values: list[PeerValue] = Field(
        description=(
            "Values of the other Regions in the same parent area, for the same indicator and year. "
            "Regions without a value that year are left out; empty when there are no peers (e.g. Åland)."
        )
    )
    trend_5y: float | None = Field(
        description="Change in value over the last five years, in the indicator's unit; null if too little history."
    )


class StrategyAction(ContractModel):
    """The National Cancer Strategy action matched to this Gap."""

    id: str
    title: str
    text: str
    source: str = Field(description="Document the action comes from.")


class DataQualityNote(ContractModel):
    code: str
    message: str


class Narrative(ContractModel):
    """Plain-language sentence(s) describing one Gap. Every figure comes from the Gap."""

    text: str = Field(min_length=1)
    source: NarrativeSource
    language: Literal["en", "fi"]


class GapSummary(ContractModel):
    """Everything the three-layer card needs, in one round-trip."""

    region: Region
    indicator: Indicator
    gap: Gap
    action: StrategyAction | None
    data_quality_notes: list[DataQualityNote]
    narrative: Narrative
    trend: list[TrendPoint] = Field(description="Series for the sparkline, ascending by year.")


# --- Outreach list ----------------------------------------------------------


class CovariateValue(ContractModel):
    """One structural covariate for one Region. Describes the Region, not individuals."""

    code: str = Field(description="Indicator id of the covariate, e.g. 'foreign_background_pct'.")
    name: str
    unit: str
    value: float
    year: int = Field(description="Year of the value: the latest year at or before the outreach list's year.")


class OutreachCovariates(ContractModel):
    immigrant_background_share_pct: float | None = Field(
        description=(
            "Share of the Region's population with a foreign background (Statistics Finland), %. "
            "The same value as the 'foreign_background_pct' entry in `values`; null if not loaded."
        )
    )
    values: list[CovariateValue] = Field(
        description=(
            "Every loaded covariate that has a value for this Region at or before the year, sorted by code. "
            "Region-level only: see the list's ecological_fallacy_note before reading any of them as a cause."
        )
    )


class OutreachRow(ContractModel):
    region: Region
    value: float
    deviation: float
    severity: Severity
    rank: int = Field(ge=1, description="1 = largest Gap on the wrong side of the Target.")
    covariates: OutreachCovariates


class OutreachList(ContractModel):
    """Regions on the wrong side of the indicator's Target (below it, or above it when lower is
    better), ranked by Gap, joined with covariates. Only indicators with a Target have one."""

    indicator: Indicator
    year: int
    reference_kind: ReferenceKind
    reference_value: float
    ecological_fallacy_note: str = Field(
        min_length=1,
        description="Required caveat: Region-level associations do not describe individuals. The UI must show it.",
    )
    rows: list[OutreachRow]


# --- narrative service (internal: engine -> narrative) -----------------------

NarrativeLanguage = Literal["en", "fi"]


class NarrativeRequest(ContractModel):
    """One Gap plus the context a Narrative may draw on. Every figure in the
    Narrative must come from here."""

    region_name: str
    indicator_name: str = Field(description="English indicator name, e.g. 'Breast cancer screening attendance'.")
    indicator_name_fi: str | None = Field(default=None, description="Finnish indicator name; required when language is 'fi'.")
    unit: str = Field(description="Unit of the Gap's value, e.g. '%'.")
    gap: Gap
    action_text: str | None = None
    data_quality_note: str | None = None
    language: NarrativeLanguage = Field(
        default="en", description="'fi' always returns a Template sentence; LLM Narratives are English only."
    )

    @model_validator(mode="after")
    def _finnish_needs_finnish_name(self) -> "NarrativeRequest":
        if self.language == "fi" and not self.indicator_name_fi:
            raise ValueError("indicator_name_fi is required when language is 'fi'")
        return self


class NarrativeResult(ContractModel):
    text: str = Field(min_length=1)
    source: NarrativeSource
    language: NarrativeLanguage
    numbers_checked: bool = Field(description="True when every number in `text` was found in the request.")
    prompt_version: str = Field(description="Changes whenever the prompt or the Template sentence wording changes.")
    rejected_numbers: list[str] = Field(
        default_factory=list,
        description="Numbers from a discarded LLM output that were not in the request. Empty unless the LLM output was rejected for invented numbers.",
    )


# --- engine jobs (internal: seed / operator -> engine) -----------------------

JobStatus = Literal["queued", "running", "succeeded", "partial", "failed"]
"""`partial`: some indicators failed to score and kept their previous Gaps; the rest were scored.
`failed`: nothing was scored; every previous Gap is unchanged."""


class IndicatorFailure(ContractModel):
    code: str = Field(description="Indicator id that failed to score.")
    error: str


class RescoreJob(ContractModel):
    """One run of the rescore job: score every Region × indicator × year and store the Gaps."""

    id: str
    status: JobStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    engine_version: str | None = Field(
        default=None, description="Written to every Gap the job stored. Set when the job finishes writing."
    )
    gaps_written: int | None = Field(default=None, description="Gaps upserted into fact_gap_score.")
    gaps_removed: int | None = Field(
        default=None, description="Stale Gaps deleted because their value is no longer in the data."
    )
    indicators_scored: int | None = None
    failed_indicators: list[IndicatorFailure] = Field(
        default_factory=list, description="Indicators skipped this run; each keeps its previous Gaps."
    )
    error: str | None = None

    @property
    def done(self) -> bool:
        return self.status in ("succeeded", "partial", "failed")


# --- Misc -------------------------------------------------------------------


class Health(ContractModel):
    status: Literal["ok"]
