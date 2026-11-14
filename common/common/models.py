"""Response models for the public `api` service.

These models are the contract between `api` and `web`. FastAPI turns them into
the OpenAPI spec, and `scripts/gen-api-types.sh` turns that spec into the
TypeScript types in `web/src/lib/api-types.ts`. Change a model here, then
regenerate the types.

Vocabulary follows GLOSSARY.md: Region, Gap, Target, Severity, Narrative,
Template sentence.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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


class OutreachCovariates(ContractModel):
    immigrant_background_share_pct: float | None = Field(
        description="Share of the Region's population with an immigrant background, %."
    )


class OutreachRow(ContractModel):
    region: Region
    value: float
    deviation: float
    severity: Severity
    rank: int = Field(ge=1, description="1 = largest Gap below the reference.")
    covariates: OutreachCovariates


class OutreachList(ContractModel):
    """Regions below the reference, ranked by Gap, joined with covariates."""

    indicator: Indicator
    year: int
    reference_kind: ReferenceKind
    reference_value: float
    ecological_fallacy_note: str = Field(
        min_length=1,
        description="Required caveat: Region-level associations do not describe individuals. The UI must show it.",
    )
    rows: list[OutreachRow]


# --- Misc -------------------------------------------------------------------


class Health(ContractModel):
    status: Literal["ok"]
