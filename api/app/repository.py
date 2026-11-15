"""Read-only queries behind the public routes (all of them read Postgres since #16).

`PostgresRepository` reads what `seed` loaded and the rescore job (#13) scored.
Routes depend on the `Repository` protocol, so tests can swap in a fake.

`api` never calls an LLM. gap-summary returns the Narrative that `engine`
cached for the Gap after the last rescore (#17): checked LLM text or a Template
sentence. Only latest-year Gaps are cached; for any other Gap (or before the
first fill) it builds the Template sentence itself, which is exact by
construction and needs no network.
"""

from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from common.actions import action_library as build_action_library
from common.actions import candidate_actions
from common.covariates import PROFILE_COVARIATES
from common.models import (
    ActionLibrary,
    CovariateCaveat,
    CovariateMeta,
    CovariateValue,
    DataQualityNote,
    Gap,
    GapEntry,
    GapSummary,
    Indicator,
    IndicatorList,
    Narrative,
    NarrativeRequest,
    OutreachCovariates,
    OutreachList,
    OutreachRow,
    Overview,
    OverviewRow,
    PeerValue,
    ProfileSummary,
    Region,
    RegionList,
    RegionProfile,
    StrategyAction,
    TrendPoint,
)
from common.synthesis import synthesize
from common.template import template_sentence

STRATEGY_SOURCE = "National Cancer Strategy 2026–2035"

IMMIGRANT_BACKGROUND_COVARIATE = "foreign_background_pct"

# The indicators a RegionProfile shows, in reading order: the three screening
# programmes that have a Target, then the two capacity measures that do not.
#
# `engine` scores twelve indicators, including survival and incidence. The
# profile deliberately shows this five, for two reasons: /overview counts the
# same list, so the map tile and the panel agree on "indicators tracked"; and
# common/synthesis.py reads a cancer-specific indicator as a screening one,
# which is true of these five and false of survival (3625-3627) and the
# treatment measures (2475, 5395) that also carry a cancer_type.
#
# Adding an indicator here means checking that rule still holds: screening is
# pathway_stage 'detection'.
PROFILE_INDICATOR_ORDER = ("3621", "3620", "6103", "3336", "13")

# Same text on every outreach list, whatever the indicator. Grounded in
# research/covariate_correlation_analysis.md: across Regions, income correlates
# with screening in the opposite direction to the individual-level data.
# BUILD.md, Workstream 3: the plain-words form that belongs next to a covariate,
# where a paragraph would be skipped.
ECOLOGICAL_FALLACY_SHORT = (
    "These are area-level patterns. They tell you where to look, not who is affected."
)

ECOLOGICAL_FALLACY_NOTE = (
    "These figures describe Regions, not individuals. A pattern across Regions can differ from, "
    "or even reverse, the pattern among the people living in them (the ecological fallacy). For "
    "example, in 2024 breast screening, Regions with higher median income had lower attendance, "
    "yet within Regions women with more education attend more. Use the covariates to decide where "
    "to look, not to conclude who is affected or why. Before targeting a group, check "
    "individual-level data, such as Cancer Registry participation by country of birth or education."
)


class NotFound(LookupError):
    """An unknown Region or indicator, or no Gap for that year. Routes turn it into a 404."""


class Repository(Protocol):
    def list_regions(self) -> RegionList: ...
    def list_indicators(self) -> IndicatorList: ...
    def gap_summary(self, region_code: str, indicator_code: str, year: int) -> GapSummary: ...
    def outreach_list(self, indicator_code: str, year: int) -> OutreachList: ...
    def region_profile(self, region_code: str, year: int | None = None) -> RegionProfile: ...
    def overview(self, year: int | None = None) -> Overview: ...
    def action_library(self, region_code: str) -> ActionLibrary: ...


# Years come from fact_gap_score, so every year offered has a Gap behind it.
_INDICATORS = """
SELECT i.indicator_id, i.name, i.unit, i.higher_is_better, i.target_value, i.cancer_type,
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
        cancer_type=row["cancer_type"],
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

            cached = conn.execute(
                """
                SELECT text, source FROM narrative_cache
                WHERE region_id = %s AND indicator_id = %s AND year = %s AND language = 'en'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (region["region_id"], indicator_code, year),
            ).fetchone()

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
        if cached is not None:
            narrative = Narrative(text=cached["text"], source=cached["source"], language="en")
        else:
            narrative = Narrative(
                text=template_sentence(
                    NarrativeRequest(
                        region_name=region_model.name,
                        indicator_name=indicator_model.name,
                        indicator_name_fi=name_fi,
                        unit=indicator_model.unit,
                        gap=gap,
                        language="en",
                    )
                ),
                source="template",
                language="en",
            )
        return GapSummary(
            region=region_model,
            indicator=indicator_model,
            gap=gap,
            action=_strategy_action(action) if action else None,
            data_quality_notes=[DataQualityNote(**n) for n in g["data_quality_notes"]],
            narrative=narrative,
            trend=[TrendPoint(year=t["year"], value=t["value"]) for t in trend],
        )


    def outreach_list(self, indicator_code: str, year: int) -> OutreachList:
        with self._connect() as conn:
            ind = conn.execute(_INDICATORS.format(where="AND i.indicator_id = %s"), (indicator_code,)).fetchone()
            if ind is None:
                raise NotFound(f"Unknown indicator code {indicator_code!r}")
            if ind["target_value"] is None:
                raise NotFound(
                    f"Indicator {indicator_code!r} has no Target, so it has no outreach list "
                    "(only indicators with a Target do)"
                )
            if year not in ind["years"]:
                raise NotFound(f"No Gaps for indicator {indicator_code!r} in {year}")

            # Wrong side of the Target: below it, or above it when lower is better.
            wrong_side = "below" if ind["higher_is_better"] else "above"
            rows = conn.execute(
                """
                SELECT r.code, r.name_en, r.kind, g.value, g.deviation, g.severity
                FROM fact_gap_score g
                JOIN dim_region r USING (region_id)
                WHERE g.indicator_id = %s AND g.year = %s
                  AND g.reference_kind = 'target' AND g.direction = %s
                ORDER BY abs(g.deviation) DESC, r.name_en COLLATE "C"
                """,
                (indicator_code, year, wrong_side),
            ).fetchall()

            # Covariates from the list's own year only. No fallback to an earlier (or later)
            # year: a covariate whose series has no value that year is left out, rather than
            # shown with another year's figure next to this year's Gaps.
            covariates = conn.execute(
                """
                SELECT r.code AS region_code, i.indicator_id, i.name, i.unit, v.year, v.value
                FROM fact_indicator_value v
                JOIN dim_indicator i USING (indicator_id)
                JOIN dim_region r USING (region_id)
                WHERE i.pathway_stage = 'covariate' AND v.value IS NOT NULL
                  AND v.year = %s AND r.code = ANY(%s)
                ORDER BY r.code, i.indicator_id
                """,
                (year, [r["code"] for r in rows]),
            ).fetchall()

        by_region: dict[str, list[CovariateValue]] = {}
        for c in covariates:
            by_region.setdefault(c["region_code"], []).append(
                CovariateValue(code=c["indicator_id"], name=c["name"], unit=c["unit"], value=c["value"], year=c["year"])
            )
        out_rows = []
        for rank, r in enumerate(rows, start=1):
            values = by_region.get(r["code"], [])
            immigrant = next((v.value for v in values if v.code == IMMIGRANT_BACKGROUND_COVARIATE), None)
            out_rows.append(
                OutreachRow(
                    region=Region(code=r["code"], name=r["name_en"], kind=r["kind"]),
                    value=r["value"],
                    deviation=r["deviation"],
                    severity=r["severity"],
                    rank=rank,
                    covariates=OutreachCovariates(immigrant_background_share_pct=immigrant, values=values),
                )
            )
        return OutreachList(
            indicator=_indicator(ind),
            year=year,
            reference_kind="target",
            reference_value=ind["target_value"],
            ecological_fallacy_note=ECOLOGICAL_FALLACY_NOTE,
            rows=out_rows,
        )


    # --- Region profile ----------------------------------------------------
    #
    # The Decision Map's payload: every Gap this Region has in one year, the
    # covariates beside them, and the actions the rules in common.actions
    # match. One round-trip per Region, because the map lets you click through
    # all 23 and a per-click fetch would show a spinner every time.

    def _latest_gap_year(self, conn: psycopg.Connection) -> int:
        row = conn.execute("SELECT max(year) AS year FROM fact_gap_score").fetchone()
        if row is None or row["year"] is None:
            raise NotFound("No Gaps have been scored yet — run the rescore job")
        return row["year"]

    def _gap_entries(
        self, conn: psycopg.Connection, region_id: int, region_code: str, year: int
    ) -> tuple[list[GapEntry], dict[str, tuple[dict, dict]]]:
        """Every scored Gap for this Region and year, in PROFILE_INDICATOR_ORDER.

        Returns the entries and the curated strategy action matched to each
        indicator, which the candidate-action rules reuse.
        """
        rows = conn.execute(
            """
            SELECT i.indicator_id, i.name, i.name_fi, i.unit, i.higher_is_better, i.target_value,
                   i.cancer_type,
                   -- Same meaning as _INDICATORS.years: every year that has a Gap for this
                   -- indicator, in any Region. _indicator() requires it.
                   coalesce((
                       SELECT array_agg(DISTINCT y.year ORDER BY y.year)
                       FROM fact_gap_score y WHERE y.indicator_id = i.indicator_id
                   ), ARRAY[]::integer[]) AS years,
                   g.value, g.reference_kind, g.reference_value, g.deviation, g.direction,
                   g.severity, g.rank, g.n_regions, g.peer_values, g.trend_5y, g.data_quality_notes
            FROM fact_gap_score g
            JOIN dim_indicator i USING (indicator_id)
            WHERE g.region_id = %s AND g.year = %s AND g.indicator_id = ANY(%s)
            """,
            (region_id, year, list(PROFILE_INDICATOR_ORDER)),
        ).fetchall()
        if not rows:
            return [], {}

        codes = [r["indicator_id"] for r in rows]

        # Every year offered for this indicator, so the card can draw a trend
        # without another round-trip. Missing years are simply absent: the
        # series is never bridged or interpolated (BUILD.md, Workstream 1).
        trends: dict[str, list[TrendPoint]] = {}
        for t in conn.execute(
            """
            SELECT indicator_id, year, value FROM fact_indicator_value
            WHERE region_id = %s AND indicator_id = ANY(%s) AND value IS NOT NULL AND year <= %s
            ORDER BY indicator_id, year
            """,
            (region_id, codes, year),
        ).fetchall():
            trends.setdefault(t["indicator_id"], []).append(TrendPoint(year=t["year"], value=t["value"]))

        # The Narrative engine cached after the last rescore, when there is one.
        cached = {
            c["indicator_id"]: c
            for c in conn.execute(
                """
                SELECT DISTINCT ON (indicator_id) indicator_id, text, source
                FROM narrative_cache
                WHERE region_id = %s AND indicator_id = ANY(%s) AND year = %s AND language = 'en'
                ORDER BY indicator_id, created_at DESC
                """,
                (region_id, codes, year),
            ).fetchall()
        }

        actions = self._matched_actions(conn, codes)

        region_name = conn.execute(
            "SELECT name_en FROM dim_region WHERE region_id = %s", (region_id,)
        ).fetchone()["name_en"]

        entries: list[GapEntry] = []
        for row in rows:
            code = row["indicator_id"]
            indicator = _indicator(row)
            gap = Gap(
                region_code=region_code,
                indicator_code=code,
                year=year,
                value=row["value"],
                reference_kind=row["reference_kind"],
                reference_value=row["reference_value"],
                deviation=row["deviation"],
                direction=row["direction"],
                severity=row["severity"],
                rank=row["rank"],
                n_regions=row["n_regions"],
                peer_values=[PeerValue(**p) for p in row["peer_values"]],
                trend_5y=row["trend_5y"],
            )
            hit = cached.get(code)
            if hit is not None:
                narrative = Narrative(text=hit["text"], source=hit["source"], language="en")
            else:
                narrative = Narrative(
                    text=template_sentence(
                        NarrativeRequest(
                            region_name=region_name,
                            indicator_name=indicator.name,
                            indicator_name_fi=row["name_fi"],
                            unit=indicator.unit,
                            gap=gap,
                            language="en",
                        )
                    ),
                    source="template",
                    language="en",
                )
            action_row = actions.get(code)
            entries.append(
                GapEntry(
                    indicator=indicator,
                    gap=gap,
                    narrative=narrative,
                    data_quality_notes=[DataQualityNote(**n) for n in row["data_quality_notes"]],
                    action=_strategy_action(action_row[0]) if action_row else None,
                    trend=trends.get(code, []),
                )
            )

        order = {code: i for i, code in enumerate(PROFILE_INDICATOR_ORDER)}
        # Anything not in the curated order still shows, after the ones that are.
        entries.sort(key=lambda e: (order.get(e.indicator.code, len(order)), e.indicator.code))
        return entries, actions

    def _matched_actions(self, conn: psycopg.Connection, codes: list[str]) -> dict[str, tuple[dict, dict]]:
        """The curated top-ranked strategy action per indicator, with the link that justifies it."""
        rows = conn.execute(
            """
            SELECT DISTINCT ON (l.indicator_id)
                   l.indicator_id, l.source_ref, l.source_quote,
                   a.action_id, a.sub_objective_title, a.goal, a.action_text, a.strategy_page
            FROM strategy_action_indicator l
            JOIN dim_strategy_action a USING (action_id)
            WHERE l.indicator_id = ANY(%s) AND coalesce(a.action_text, '') <> ''
            ORDER BY l.indicator_id, l.rank NULLS LAST, a.action_id
            """,
            (codes,),
        ).fetchall()
        return {
            r["indicator_id"]: (
                {
                    "action_id": r["action_id"],
                    "sub_objective_title": r["sub_objective_title"],
                    "goal": r["goal"],
                    "action_text": r["action_text"],
                    "strategy_page": r["strategy_page"],
                },
                {"source_ref": r["source_ref"], "source_quote": r["source_quote"]},
            )
            for r in rows
        }

    def _covariates(
        self, conn: psycopg.Connection, region_id: int, year: int
    ) -> tuple[dict[str, float], dict[str, CovariateMeta]]:
        """This Region's covariates for `year`, each with the median across every Region that year.

        The list's own year only, as the outreach list does: a covariate with no
        value this year is left out rather than shown with another year's figure
        beside this year's Gaps.
        """
        rows = conn.execute(
            """
            SELECT i.indicator_id, i.name, i.unit,
                   max(v.value) FILTER (WHERE v.region_id = %(region_id)s) AS value,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY v.value) AS median
            FROM fact_indicator_value v
            JOIN dim_indicator i USING (indicator_id)
            WHERE i.pathway_stage = 'covariate' AND v.value IS NOT NULL
              AND v.year = %(year)s AND i.indicator_id = ANY(%(codes)s)
            GROUP BY i.indicator_id, i.name, i.unit
            """,
            {"region_id": region_id, "year": year, "codes": list(PROFILE_COVARIATES)},
        ).fetchall()
        order = {code: i for i, code in enumerate(PROFILE_COVARIATES)}
        rows.sort(key=lambda r: order.get(r["indicator_id"], len(order)))
        covariates = {r["indicator_id"]: r["value"] for r in rows if r["value"] is not None}
        meta = {
            r["indicator_id"]: CovariateMeta(name=r["name"], unit=r["unit"], median=r["median"])
            for r in rows
            if r["value"] is not None
        }
        return covariates, meta

    def region_profile(self, region_code: str, year: int | None = None) -> RegionProfile:
        with self._connect() as conn:
            region = conn.execute(
                "SELECT region_id, code, name_en, kind FROM dim_region WHERE code = %s", (region_code,)
            ).fetchone()
            if region is None:
                raise NotFound(f"Unknown region code {region_code!r}")
            year = year if year is not None else self._latest_gap_year(conn)

            entries, matched = self._gap_entries(conn, region["region_id"], region["code"], year)
            if not entries:
                raise NotFound(f"No Gaps for region {region_code!r} in {year}")
            covariates, covariate_meta = self._covariates(conn, region["region_id"], year)

            # Indicators the engine can score but that have no Gap this year.
            # Named in plain words, never interpolated (BUILD.md, Workstream 1).
            missing = conn.execute(
                """
                SELECT i.name FROM dim_indicator i
                WHERE i.pathway_stage <> 'covariate'
                  AND i.indicator_id = ANY(%s)
                  AND NOT EXISTS (
                      SELECT 1 FROM fact_gap_score g
                      WHERE g.indicator_id = i.indicator_id AND g.region_id = %s AND g.year = %s
                  )
                ORDER BY i.name
                """,
                (list(PROFILE_INDICATOR_ORDER), region["region_id"], year),
            ).fetchall()

        region_model = Region(code=region["code"], name=region["name_en"], kind=region["kind"])
        notes = [f"No {year} data for: {', '.join(m['name'] for m in missing)}."] if missing else []
        summary = ProfileSummary(
            indicators_tracked=len(entries),
            indicators_act=sum(1 for e in entries if e.gap.severity == "act"),
            indicators_watch=sum(1 for e in entries if e.gap.severity == "watch"),
        )
        return RegionProfile(
            region=region_model,
            year=year,
            gaps=entries,
            covariates=covariates,
            covariate_meta=covariate_meta,
            covariate_caveat=CovariateCaveat(
                short=ECOLOGICAL_FALLACY_SHORT, full=ECOLOGICAL_FALLACY_NOTE
            ),
            missing_data_notes=notes,
            summary=summary,
            synthesis=synthesize(region_model.name, entries, covariates, covariate_meta, notes),
            candidate_actions=candidate_actions(region_model.name, entries, covariates, covariate_meta, matched),
        )

    def overview(self, year: int | None = None) -> Overview:
        """Every Region's Gap counts — one aggregate query, not 23 profiles."""
        with self._connect() as conn:
            year = year if year is not None else self._latest_gap_year(conn)
            rows = conn.execute(
                """
                SELECT r.code, r.name_en, r.kind,
                       count(g.indicator_id) AS tracked,
                       count(*) FILTER (WHERE g.severity = 'act')   AS act,
                       count(*) FILTER (WHERE g.severity = 'watch') AS watch
                FROM dim_region r
                LEFT JOIN fact_gap_score g
                       ON g.region_id = r.region_id AND g.year = %s
                      AND g.indicator_id = ANY(%s)
                GROUP BY r.code, r.name_en, r.kind
                ORDER BY r.name_en COLLATE "C"
                """,
                (year, list(PROFILE_INDICATOR_ORDER)),
            ).fetchall()
        return Overview(
            year=year,
            rows=[
                OverviewRow(
                    region=Region(code=r["code"], name=r["name_en"], kind=r["kind"]),
                    indicators_tracked=r["tracked"],
                    indicators_act=r["act"],
                    indicators_watch=r["watch"],
                )
                for r in rows
            ],
        )

    def action_library(self, region_code: str) -> ActionLibrary:
        with self._connect() as conn:
            region = conn.execute("SELECT name_en FROM dim_region WHERE code = %s", (region_code,)).fetchone()
            if region is None:
                raise NotFound(f"Unknown region code {region_code!r}")
            rows = conn.execute(
                """
                SELECT action_id, sub_objective_title, goal, action_text, strategy_page
                FROM dim_strategy_action
                WHERE coalesce(action_text, '') <> ''
                ORDER BY action_id
                """
            ).fetchall()
        return ActionLibrary(
            region_code=region_code,
            actions=build_action_library(region["name_en"], [dict(r) for r in rows]),
        )


def _strategy_action(row: dict) -> StrategyAction:
    page = (row["strategy_page"] or "").strip()
    return StrategyAction(
        id=row["action_id"],
        title=row["sub_objective_title"] or row["goal"] or row["action_id"],
        text=row["action_text"],
        source=f"{STRATEGY_SOURCE}, p. {page}" if page else STRATEGY_SOURCE,
    )
