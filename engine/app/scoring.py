"""Gap scoring: the pure function behind every Gap.

`score()` takes one indicator's values for every Region and returns the Gap for
one Region and year, plus any data-quality notes. It does no I/O: the engine
loads the data, the thresholds and the peer groups, calls `score()`, and writes
the rows. Same input, same output.

Vocabulary follows GLOSSARY.md: Region, Gap, Target, Severity.
"""

from __future__ import annotations

import math
import statistics
import tomllib
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path

from common.models import (
    DataQualityNote,
    Gap,
    GapDirection,
    Indicator,
    PeerValue,
    ReferenceKind,
    Severity,
)

DEFAULT_THRESHOLDS_PATH = Path(__file__).with_name("severity_thresholds.toml")

TREND_YEARS = 5
"""trend_5y spans five data years: value[year] − value[year − 4]."""

_EPS = 1e-9
"""Tolerance for float comparisons, so 80 − 77.0 counts as exactly 3 pp."""

_DECIMALS = 9
"""Derived figures are rounded here to drop float noise (−5.700000000000003 → −5.7)."""

Series = Mapping[int, float]
"""One Region's values for one indicator, keyed by year. Missing years are absent."""


@dataclass(frozen=True)
class SeverityThresholds:
    target_watch_max_shortfall: float
    z_watch: float
    z_act: float


def load_thresholds(path: Path = DEFAULT_THRESHOLDS_PATH) -> SeverityThresholds:
    """Read the Severity thresholds config. Kept apart from `score()` so scoring stays pure."""
    with open(path, "rb") as f:
        raw = tomllib.load(f)
    return SeverityThresholds(
        target_watch_max_shortfall=float(raw["targeted"]["watch_max_shortfall"]),
        z_watch=float(raw["untargeted"]["watch_z"]),
        z_act=float(raw["untargeted"]["act_z"]),
    )


@dataclass(frozen=True)
class ScoreResult:
    gap: Gap
    data_quality_notes: tuple[DataQualityNote, ...]


def score(
    indicator: Indicator,
    region_code: str,
    year: int,
    values: Mapping[str, Series],
    peer_region_codes: Iterable[str],
    thresholds: SeverityThresholds,
) -> ScoreResult | None:
    """Score one Region on one indicator in one year.

    `values` holds the indicator's series for every Region, and only Regions:
    leave out the "Whole country" row (code 358), or it counts towards rank,
    n_regions and the z-score. `peer_region_codes`
    are the other Regions in the same parent area; it may be empty (Åland).
    Returns None when the Region has no value for `year`: missing years are
    never interpolated.
    """
    year_values = {
        code: series[year]
        for code, series in values.items()
        if _present(series.get(year))
    }
    if region_code not in year_values:
        return None

    value = year_values[region_code]
    others = [v for code, v in year_values.items() if code != region_code]
    notes: list[DataQualityNote] = []

    if indicator.target is not None:
        reference_kind: ReferenceKind = "target"
        reference_value = indicator.target
        severity = _target_severity(value, indicator, thresholds)
    else:
        reference_kind = "peer_median"
        reference_value, severity, note = _z_score_severity(value, others, indicator, thresholds)
        if note:
            notes.append(note)

    deviation = _clean(value - reference_value)

    peer_values, note = _peer_values(region_code, peer_region_codes, year_values)
    if note:
        notes.append(note)

    trend_5y, note = _trend_5y(values[region_code], year, value)
    if note:
        notes.append(note)

    gap = Gap(
        region_code=region_code,
        indicator_code=indicator.code,
        year=year,
        value=value,
        reference_kind=reference_kind,
        reference_value=_clean(reference_value),
        deviation=deviation,
        direction=_direction(deviation),
        severity=severity,
        rank=_rank(value, others, indicator.higher_is_better),
        n_regions=len(year_values),
        peer_values=peer_values,
        trend_5y=trend_5y,
    )
    return ScoreResult(gap=gap, data_quality_notes=tuple(notes))


def _target_severity(value: float, indicator: Indicator, t: SeverityThresholds) -> Severity:
    assert indicator.target is not None
    shortfall = indicator.target - value if indicator.higher_is_better else value - indicator.target
    if shortfall <= _EPS:
        return "ok"
    if shortfall <= t.target_watch_max_shortfall + _EPS:
        return "watch"
    return "act"


def _z_score_severity(
    value: float, others: list[float], indicator: Indicator, t: SeverityThresholds
) -> tuple[float, Severity, DataQualityNote | None]:
    """Reference is the median of the other Regions; Severity is the z-score in the bad direction."""
    if not others:
        note = DataQualityNote(
            code="no_comparison",
            message="No other Region has a value this year, so there is nothing to compare with.",
        )
        return value, "ok", note

    reference_value = statistics.median(others)
    spread = statistics.pstdev(others) if len(others) >= 2 else 0.0
    if spread <= _EPS:
        note = DataQualityNote(
            code="z_score_undefined",
            message="The other Regions' values do not vary, so no z-score can be computed; Severity is ok.",
        )
        return reference_value, "ok", note

    z = (value - statistics.fmean(others)) / spread
    z_bad = -z if indicator.higher_is_better else z
    if z_bad >= t.z_act - _EPS:
        severity: Severity = "act"
    elif z_bad >= t.z_watch - _EPS:
        severity = "watch"
    else:
        severity = "ok"
    return reference_value, severity, None


def _peer_values(
    region_code: str, peer_region_codes: Iterable[str], year_values: Mapping[str, float]
) -> tuple[list[PeerValue], DataQualityNote | None]:
    peers = sorted(set(peer_region_codes) - {region_code})
    if not peers:
        return [], DataQualityNote(code="no_peers", message="No peer Regions to compare with.")

    peer_values = [PeerValue(region_code=c, value=year_values[c]) for c in peers if c in year_values]
    if not peer_values:
        return [], DataQualityNote(
            code="no_peer_values",
            message="None of the peer Regions has a value for this year.",
        )
    return peer_values, None


def _trend_5y(series: Series, year: int, value: float) -> tuple[float | None, DataQualityNote | None]:
    start = year - (TREND_YEARS - 1)
    start_value = series.get(start)
    if _present(start_value):
        return _clean(value - start_value), None

    years_with_data = sorted(y for y, v in series.items() if y <= year and _present(v))
    if years_with_data[0] > start:
        reason = (
            f"Data starts in {years_with_data[0]} ({len(years_with_data)} years up to {year}); "
            f"a five-year trend needs a value for {start}."
        )
    else:
        reason = f"No value for {start}, so the five-year trend cannot be computed. Missing years are never interpolated."
    return None, DataQualityNote(code="trend_unavailable", message=reason)


def _rank(value: float, others: list[float], higher_is_better: bool) -> int:
    """1 = best. Tied values share a rank (1, 2, 2, 4)."""
    if higher_is_better:
        better = sum(1 for v in others if v - value > _EPS)
    else:
        better = sum(1 for v in others if value - v > _EPS)
    return better + 1


def _direction(deviation: float) -> GapDirection:
    if deviation > _EPS:
        return "above"
    if deviation < -_EPS:
        return "below"
    return "at"


def _present(v: float | None) -> bool:
    return v is not None and not math.isnan(v)


def _clean(x: float) -> float:
    return round(x, _DECIMALS) + 0.0  # + 0.0 turns −0.0 into 0.0
