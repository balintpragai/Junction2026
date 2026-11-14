"""The rescore job: score every Region × indicator × year and store the Gaps.

Three steps, so the middle one can be tested without a database:

1. `load_inputs()` reads Regions, scoreable indicators and their values.
2. `compute_gaps()` calls the pure `score()` for every Region × indicator × year.
3. `write_gaps()` upserts `fact_gap_score` and deletes Gaps whose value is gone.

`run()` does all three in one transaction under an advisory lock, so two
rescores never interleave and readers never see a half-written table. If the
job fails, the transaction rolls back and the previous Gaps stay.

One indicator that fails to score does not stop the others: it is skipped,
reported on the job, and keeps its previous Gaps.

Vocabulary follows GLOSSARY.md: Region, Gap, Target, Severity.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass, field

import psycopg
from psycopg.types.json import Jsonb

from common.db import connect
from common.models import DataQualityNote, Gap, Indicator, IndicatorFailure

from .scoring import SeverityThresholds, load_thresholds, score

log = logging.getLogger(__name__)

ENGINE_VERSION = "0.2.0"
"""Bump when scoring logic changes. Threshold changes are tracked automatically (see engine_version())."""

ADVISORY_LOCK_KEY = 7_000_013
"""Serializes rescores. (seed uses 7_000_007.)"""


def engine_version(thresholds: SeverityThresholds) -> str:
    """ENGINE_VERSION plus a short hash of the thresholds, so a config change shows up in every Gap row."""
    digest = hashlib.sha256(json.dumps(asdict(thresholds), sort_keys=True).encode()).hexdigest()[:8]
    return f"{ENGINE_VERSION}+t{digest}"


@dataclass(frozen=True)
class RegionInfo:
    region_id: int
    code: str
    parent_area: str | None


@dataclass(frozen=True)
class ScoringInputs:
    regions: list[RegionInfo]
    indicators: list[Indicator]
    """Scoreable indicators only (no covariates); `years` = years with at least one value."""
    values: Mapping[str, Mapping[str, Mapping[int, float]]]
    """indicator code → Region code → year → value. Missing (NULL) values are absent."""
    value_notes: Mapping[tuple[str, str, int], list[dict]] = field(default_factory=dict)
    """(indicator code, Region code, year) → notes stored with the value, as stored ({"code", "message"}).
    Parsed per indicator in compute_gaps(), so one malformed note fails only its indicator."""


@dataclass(frozen=True)
class GapRow:
    region_id: int
    gap: Gap
    data_quality_notes: tuple[DataQualityNote, ...]


@dataclass(frozen=True)
class ComputeResult:
    rows: list[GapRow]
    failures: list[IndicatorFailure]
    indicators_scored: int


@dataclass(frozen=True)
class RescoreResult:
    engine_version: str
    gaps_written: int
    gaps_removed: int
    indicators_scored: int
    failures: list[IndicatorFailure]


# --- 1. Load -------------------------------------------------------------------


def load_inputs(conn: psycopg.Connection) -> ScoringInputs:
    regions = [
        RegionInfo(region_id=rid, code=code, parent_area=area)
        for rid, code, area in conn.execute(
            "SELECT region_id, code, parent_area FROM dim_region ORDER BY code"
        )
    ]

    values: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    value_notes: dict[tuple[str, str, int], list[dict]] = {}
    for indicator_id, region_code, year, value, notes in conn.execute(
        """
        SELECT v.indicator_id, r.code, v.year, v.value, v.data_quality_notes
        FROM fact_indicator_value v
        JOIN dim_region r USING (region_id)
        JOIN dim_indicator i USING (indicator_id)
        WHERE i.pathway_stage <> 'covariate'
        """
    ):
        if value is not None:
            values[indicator_id][region_code][year] = value
        if notes:
            value_notes[(indicator_id, region_code, year)] = notes

    indicators = [
        Indicator(
            code=indicator_id,
            name=name,
            unit=unit,
            higher_is_better=higher_is_better,
            target=target_value,
            years=sorted({y for series in values.get(indicator_id, {}).values() for y in series}),
        )
        for indicator_id, name, unit, higher_is_better, target_value in conn.execute(
            """
            SELECT indicator_id, name, unit, higher_is_better, target_value
            FROM dim_indicator
            WHERE pathway_stage <> 'covariate'
            ORDER BY indicator_id
            """
        )
    ]
    return ScoringInputs(regions=regions, indicators=indicators, values=values, value_notes=value_notes)


# --- 2. Compute (pure) ---------------------------------------------------------


def peer_groups(regions: list[RegionInfo]) -> dict[str, list[str]]:
    """Region code → the other Regions with the same parent_area. Empty for Åland or when parent_area is unset."""
    by_area: dict[str, list[str]] = defaultdict(list)
    for r in regions:
        if r.parent_area is not None:
            by_area[r.parent_area].append(r.code)
    return {
        r.code: sorted(c for c in by_area[r.parent_area] if c != r.code) if r.parent_area else []
        for r in regions
    }


def compute_gaps(inputs: ScoringInputs, thresholds: SeverityThresholds) -> ComputeResult:
    """One GapRow per Region × indicator × year that has a value, in a fixed order.

    An indicator that raises is skipped whole (none of its rows are kept) and
    reported in `failures`; the other indicators are scored as usual.
    """
    peers = peer_groups(inputs.regions)
    rows: list[GapRow] = []
    failures: list[IndicatorFailure] = []
    for indicator in inputs.indicators:
        try:
            rows.extend(_score_indicator(indicator, inputs, peers, thresholds))
        except Exception as e:
            log.exception("indicator %s failed to score; it keeps its previous Gaps", indicator.code)
            failures.append(IndicatorFailure(code=indicator.code, error=f"{type(e).__name__}: {e}"))
    return ComputeResult(rows=rows, failures=failures, indicators_scored=len(inputs.indicators) - len(failures))


def _score_indicator(
    indicator: Indicator,
    inputs: ScoringInputs,
    peers: Mapping[str, list[str]],
    thresholds: SeverityThresholds,
) -> list[GapRow]:
    values = inputs.values.get(indicator.code, {})
    rows: list[GapRow] = []
    for year in indicator.years:
        for region in inputs.regions:
            result = score(indicator, region.code, year, values, peers[region.code], thresholds)
            if result is None:
                continue
            stored = inputs.value_notes.get((indicator.code, region.code, year), [])
            rows.append(
                GapRow(
                    region_id=region.region_id,
                    gap=result.gap,
                    data_quality_notes=(*(DataQualityNote(**n) for n in stored), *result.data_quality_notes),
                )
            )
    return rows


# --- 3. Write ------------------------------------------------------------------

_UPSERT = """
INSERT INTO fact_gap_score (
    region_id, indicator_id, year, value, reference_kind, reference_value, deviation,
    direction, severity, rank, n_regions, peer_values, trend_5y, data_quality_notes,
    engine_version, scored_at
)
VALUES (
    %(region_id)s, %(indicator_id)s, %(year)s, %(value)s, %(reference_kind)s, %(reference_value)s,
    %(deviation)s, %(direction)s, %(severity)s, %(rank)s, %(n_regions)s, %(peer_values)s,
    %(trend_5y)s, %(data_quality_notes)s, %(engine_version)s, now()
)
ON CONFLICT (region_id, indicator_id, year) DO UPDATE SET
    value = EXCLUDED.value, reference_kind = EXCLUDED.reference_kind,
    reference_value = EXCLUDED.reference_value, deviation = EXCLUDED.deviation,
    direction = EXCLUDED.direction, severity = EXCLUDED.severity, rank = EXCLUDED.rank,
    n_regions = EXCLUDED.n_regions, peer_values = EXCLUDED.peer_values,
    trend_5y = EXCLUDED.trend_5y, data_quality_notes = EXCLUDED.data_quality_notes,
    engine_version = EXCLUDED.engine_version, scored_at = EXCLUDED.scored_at
"""


def write_gaps(
    conn: psycopg.Connection, rows: list[GapRow], version: str, keep_indicators: Sequence[str] = ()
) -> tuple[int, int]:
    """Upsert every row, then delete rows this run did not write. Returns (written, removed).

    Every row gets scored_at = now(), the transaction's start time, so anything
    older was not produced by this run: its value was removed from the data.
    Indicators in `keep_indicators` (the ones that failed to score) are not
    touched, so they keep their previous Gaps.
    """
    with conn.cursor() as cur:
        cur.executemany(
            _UPSERT,
            [
                {
                    "region_id": row.region_id,
                    "indicator_id": row.gap.indicator_code,
                    "year": row.gap.year,
                    "value": row.gap.value,
                    "reference_kind": row.gap.reference_kind,
                    "reference_value": row.gap.reference_value,
                    "deviation": row.gap.deviation,
                    "direction": row.gap.direction,
                    "severity": row.gap.severity,
                    "rank": row.gap.rank,
                    "n_regions": row.gap.n_regions,
                    "peer_values": Jsonb([p.model_dump() for p in row.gap.peer_values]),
                    "trend_5y": row.gap.trend_5y,
                    "data_quality_notes": Jsonb([n.model_dump() for n in row.data_quality_notes]),
                    "engine_version": version,
                }
                for row in rows
            ],
        )
    removed = conn.execute(
        "DELETE FROM fact_gap_score WHERE scored_at < now() AND NOT (indicator_id = ANY(%s))",
        (list(keep_indicators),),
    ).rowcount
    return len(rows), removed


# --- All together --------------------------------------------------------------


def run(database_url: str) -> RescoreResult:
    """Load, score and write in one transaction. Thresholds are re-read each run, so a config change needs no restart."""
    thresholds = load_thresholds()
    version = engine_version(thresholds)
    with connect(database_url) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(%s)", (ADVISORY_LOCK_KEY,))
        computed = compute_gaps(load_inputs(conn), thresholds)
        written, removed = write_gaps(conn, computed.rows, version, [f.code for f in computed.failures])
    return RescoreResult(
        engine_version=version,
        gaps_written=written,
        gaps_removed=removed,
        indicators_scored=computed.indicators_scored,
        failures=computed.failures,
    )
