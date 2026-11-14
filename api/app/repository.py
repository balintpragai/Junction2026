"""Read-only queries behind the public routes.

`PostgresRepository` reads what `seed` loaded and the rescore job (#13) scored.
Routes depend on the `Repository` protocol, so tests can swap in a fake.

`api` never calls an LLM. Until the Narrative cache (#17) is filled, every
gap-summary carries the Template sentence for its Gap, which is exact by
construction and needs no network.
"""

from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from common.models import (
    DataQualityNote,
    Gap,
    GapSummary,
    Indicator,
    IndicatorList,
    Narrative,
    NarrativeRequest,
    PeerValue,
    Region,
    RegionList,
    StrategyAction,
    TrendPoint,
)
from common.template import template_sentence

STRATEGY_SOURCE = "National Cancer Strategy 2026–2035"


class NotFound(LookupError):
    """An unknown Region or indicator, or no Gap for that year. Routes turn it into a 404."""


class Repository(Protocol):
    def list_regions(self) -> RegionList: ...
    def list_indicators(self) -> IndicatorList: ...
    def gap_summary(self, region_code: str, indicator_code: str, year: int) -> GapSummary: ...


# Years come from fact_gap_score, so every year offered has a Gap behind it.
_INDICATORS = """
SELECT i.indicator_id, i.name, i.unit, i.higher_is_better, i.target_value,
       coalesce(array_agg(DISTINCT g.year ORDER BY g.year) FILTER (WHERE g.year IS NOT NULL), ARRAY[]::integer[]) AS years
FROM dim_indicator i
LEFT JOIN fact_gap_score g USING (indicator_id)
WHERE i.pathway_stage <> 'covariate' {where}
GROUP BY i.indicator_id
ORDER BY i.indicator_id
"""


def _indicator(row: dict) -> Indicator:
    return Indicator(
        code=row["indicator_id"],
        name=row["name"],
        unit=row["unit"],
        higher_is_better=row["higher_is_better"],
        target=row["target_value"],
        years=list(row["years"]),
    )


class PostgresRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self.database_url, connect_timeout=5, row_factory=dict_row)

    def list_regions(self) -> RegionList:
        # Byte order: the same on every database locale, and Åland after Z as in the Finnish alphabet.
        with self._connect() as conn:
            rows = conn.execute('SELECT code, name_en, kind FROM dim_region ORDER BY name_en COLLATE "C"').fetchall()
        return RegionList(regions=[Region(code=r["code"], name=r["name_en"], kind=r["kind"]) for r in rows])

    def list_indicators(self) -> IndicatorList:
        with self._connect() as conn:
            rows = conn.execute(_INDICATORS.format(where="")).fetchall()
        return IndicatorList(indicators=[_indicator(r) for r in rows])

    def gap_summary(self, region_code: str, indicator_code: str, year: int) -> GapSummary:
        with self._connect() as conn:
            region = conn.execute(
                "SELECT region_id, code, name_en, kind FROM dim_region WHERE code = %s", (region_code,)
            ).fetchone()
            if region is None:
                raise NotFound(f"Unknown region code {region_code!r}")

            ind = conn.execute(_INDICATORS.format(where="AND i.indicator_id = %s"), (indicator_code,)).fetchone()
            if ind is None:
                raise NotFound(f"Unknown indicator code {indicator_code!r}")
            name_fi = conn.execute(
                "SELECT name_fi FROM dim_indicator WHERE indicator_id = %s", (indicator_code,)
            ).fetchone()["name_fi"]

            g = conn.execute(
                """
                SELECT value, reference_kind, reference_value, deviation, direction, severity,
                       rank, n_regions, peer_values, trend_5y, data_quality_notes
                FROM fact_gap_score
                WHERE region_id = %s AND indicator_id = %s AND year = %s
                """,
                (region["region_id"], indicator_code, year),
            ).fetchone()
            if g is None:
                raise NotFound(f"No Gap for region {region_code!r}, indicator {indicator_code!r} in {year}")

            trend = conn.execute(
                """
                SELECT year, value FROM fact_indicator_value
                WHERE region_id = %s AND indicator_id = %s AND value IS NOT NULL AND year <= %s
                ORDER BY year
                """,
                (region["region_id"], indicator_code, year),
            ).fetchall()

            action = conn.execute(
                """
                SELECT a.action_id, a.sub_objective_title, a.goal, a.action_text, a.strategy_page
                FROM strategy_action_indicator l
                JOIN dim_strategy_action a USING (action_id)
                WHERE l.indicator_id = %s AND coalesce(a.action_text, '') <> ''
                ORDER BY l.rank NULLS LAST, a.action_id
                LIMIT 1
                """,
                (indicator_code,),
            ).fetchone()

        region_model = Region(code=region["code"], name=region["name_en"], kind=region["kind"])
        indicator_model = _indicator(ind)
        gap = Gap(
            region_code=region["code"],
            indicator_code=indicator_code,
            year=year,
            value=g["value"],
            reference_kind=g["reference_kind"],
            reference_value=g["reference_value"],
            deviation=g["deviation"],
            direction=g["direction"],
            severity=g["severity"],
            rank=g["rank"],
            n_regions=g["n_regions"],
            peer_values=[PeerValue(**p) for p in g["peer_values"]],
            trend_5y=g["trend_5y"],
        )
        narrative_text = template_sentence(
            NarrativeRequest(
                region_name=region_model.name,
                indicator_name=indicator_model.name,
                indicator_name_fi=name_fi,
                unit=indicator_model.unit,
                gap=gap,
                language="en",
            )
        )
        return GapSummary(
            region=region_model,
            indicator=indicator_model,
            gap=gap,
            action=_strategy_action(action) if action else None,
            data_quality_notes=[DataQualityNote(**n) for n in g["data_quality_notes"]],
            narrative=Narrative(text=narrative_text, source="template", language="en"),
            trend=[TrendPoint(year=t["year"], value=t["value"]) for t in trend],
        )


def _strategy_action(row: dict) -> StrategyAction:
    page = (row["strategy_page"] or "").strip()
    return StrategyAction(
        id=row["action_id"],
        title=row["sub_objective_title"] or row["goal"] or row["action_id"],
        text=row["action_text"],
        source=f"{STRATEGY_SOURCE}, p. {page}" if page else STRATEGY_SOURCE,
    )
