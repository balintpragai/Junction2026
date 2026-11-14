"""Fill `narrative_cache` after a rescore (#17).

For every latest-year Gap (the latest scored year of each indicator, about
275 Gaps), build the Narrative request: the Gap, the Region and indicator
names, the matched strategy-action text and the data-quality notes. Ask
`narrative` only for requests whose inputs changed:

- `input_hash` = SHA-256 of the request plus the configured LLM model;
- a cached row is kept when its `input_hash` and `prompt_version` both match.

So a rescore with unchanged inputs makes no `narrative` (and no LLM) calls.
A Narrative that fails to generate never fails the job. Its outdated row, if
any, is deleted, so gap-summary falls back to the Template sentence built from
the current Gap instead of showing a Narrative with old numbers. Rows for Gaps
that are no longer latest-year Gaps are deleted too.

Narratives are generated outside any transaction (LLM calls can be slow), then
written in one short transaction. Only English is cached: LLM Narratives are
English only, and a Finnish Template sentence is cheap to build on request.
"""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.request
from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Protocol

import psycopg
from psycopg.rows import dict_row

from common.db import connect
from common.models import DataQualityNote, Gap, NarrativeConfig, NarrativeRequest, NarrativeResult, PeerValue

log = logging.getLogger(__name__)

LANGUAGE = "en"
MAX_WORKERS = 8
"""Concurrent requests to `narrative`. With an LLM, ~275 calls take about a minute."""
REQUEST_TIMEOUT_S = 60.0


class NarrativeClient(Protocol):
    def config(self) -> NarrativeConfig: ...
    def narrative(self, request: NarrativeRequest) -> NarrativeResult: ...


class HttpNarrativeClient:
    """Talks to the `narrative` service. Standard library only, like common.engine_client."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def config(self) -> NarrativeConfig:
        with urllib.request.urlopen(f"{self.base_url}/config", timeout=10) as r:
            return NarrativeConfig.model_validate_json(r.read())

    def narrative(self, request: NarrativeRequest) -> NarrativeResult:
        req = urllib.request.Request(
            f"{self.base_url}/narrative",
            data=request.model_dump_json().encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as r:
            return NarrativeResult.model_validate_json(r.read())


@dataclass(frozen=True)
class NarrativeInput:
    region_id: int
    request: NarrativeRequest

    @property
    def key(self) -> tuple[int, str, int]:
        return (self.region_id, self.request.gap.indicator_code, self.request.gap.year)


@dataclass(frozen=True)
class FillResult:
    generated: int
    kept: int
    failed: int
    """Could not be generated; their outdated rows were removed (gap-summary shows the Template sentence)."""
    removed: int
    sources: dict[str, int] = field(default_factory=dict)
    """Cached latest-year Narratives by source after the run."""


def input_hash(request: NarrativeRequest, model: str) -> str:
    payload = json.dumps({"request": request.model_dump(mode="json"), "model": model}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


# --- Load ------------------------------------------------------------------------

_LATEST_GAPS = """
WITH latest AS (
    SELECT indicator_id, max(year) AS year FROM fact_gap_score GROUP BY indicator_id
)
SELECT g.region_id, r.code AS region_code, r.name_en AS region_name,
       g.indicator_id, i.name AS indicator_name, i.name_fi AS indicator_name_fi, i.unit,
       g.year, g.value, g.reference_kind, g.reference_value, g.deviation, g.direction, g.severity,
       g.rank, g.n_regions, g.peer_values, g.trend_5y, g.data_quality_notes,
       (SELECT a.action_text
          FROM strategy_action_indicator l
          JOIN dim_strategy_action a USING (action_id)
         WHERE l.indicator_id = g.indicator_id AND coalesce(a.action_text, '') <> ''
         ORDER BY l.rank NULLS LAST, a.action_id
         LIMIT 1) AS action_text
FROM fact_gap_score g
JOIN latest USING (indicator_id, year)
JOIN dim_region r USING (region_id)
JOIN dim_indicator i USING (indicator_id)
ORDER BY g.indicator_id, r.code
"""


def load_inputs(conn: psycopg.Connection) -> list[NarrativeInput]:
    """One request per latest-year Gap. The action is the same one gap-summary shows (lowest rank with text)."""
    cur = conn.cursor(row_factory=dict_row)
    inputs = []
    for row in cur.execute(_LATEST_GAPS):
        notes = [DataQualityNote(**n) for n in row["data_quality_notes"]]
        gap = Gap(
            region_code=row["region_code"],
            indicator_code=row["indicator_id"],
            year=row["year"],
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
        request = NarrativeRequest(
            region_name=row["region_name"],
            indicator_name=row["indicator_name"],
            indicator_name_fi=row["indicator_name_fi"],
            unit=row["unit"],
            gap=gap,
            action_text=row["action_text"],
            data_quality_note="; ".join(n.message for n in notes) or None,
            language=LANGUAGE,
        )
        inputs.append(NarrativeInput(region_id=row["region_id"], request=request))
    return inputs


def cached_keys(conn: psycopg.Connection) -> dict[tuple[int, str, int], tuple[str, str]]:
    """(region_id, indicator_id, year) → (input_hash, prompt_version) of the current English row."""
    return {
        (rid, iid, year): (h, pv)
        for rid, iid, year, h, pv in conn.execute(
            "SELECT region_id, indicator_id, year, input_hash, prompt_version FROM narrative_cache WHERE language = %s",
            (LANGUAGE,),
        )
    }


# --- Generate ----------------------------------------------------------------------


def generate(
    todo: list[NarrativeInput], client: NarrativeClient, max_workers: int = MAX_WORKERS
) -> tuple[list[tuple[NarrativeInput, NarrativeResult]], list[NarrativeInput]]:
    """Ask `narrative` for each input, a few at a time. Returns (results, failed inputs)."""

    def one(item: NarrativeInput) -> tuple[NarrativeInput, NarrativeResult | None]:
        try:
            return item, client.narrative(item.request)
        except Exception as e:  # one failure must not stop the others
            log.warning("narrative for %s failed; its outdated row is dropped: %s: %s", item.key, type(e).__name__, e)
            return item, None

    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="narrative") as pool:
        outcomes = list(pool.map(one, todo))
    results = [(item, res) for item, res in outcomes if res is not None]
    return results, [item for item, res in outcomes if res is None]


# --- Write -------------------------------------------------------------------------


def write(
    conn: psycopg.Connection,
    results: list[tuple[NarrativeInput, NarrativeResult]],
    model: str,
    hashes: dict[tuple[int, str, int], str],
    current: set[tuple[int, str, int]],
    failed: list[NarrativeInput] = (),
) -> int:
    """Replace the row of every generated Narrative. Delete the outdated rows of failed ones, and rows
    that are no longer latest-year Gaps. Returns rows removed."""
    with conn.cursor() as cur:
        for item, res in results:
            rid, iid, year = item.key
            cur.execute(
                "DELETE FROM narrative_cache WHERE region_id = %s AND indicator_id = %s AND year = %s AND language = %s",
                (rid, iid, year, LANGUAGE),
            )
            cur.execute(
                """
                INSERT INTO narrative_cache
                    (region_id, indicator_id, year, language, model, prompt_version, text, source, numbers_checked, input_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (rid, iid, year, res.language, model if res.source == "llm" else "", res.prompt_version,
                 res.text, res.source, res.numbers_checked, hashes[item.key]),
            )
    failed_keys = {item.key for item in failed}
    stale = [key for key in cached_keys(conn) if key not in current or key in failed_keys]
    with conn.cursor() as cur:
        for rid, iid, year in stale:
            cur.execute(
                "DELETE FROM narrative_cache WHERE region_id = %s AND indicator_id = %s AND year = %s AND language = %s",
                (rid, iid, year, LANGUAGE),
            )
    return len(stale)


def source_counts(conn: psycopg.Connection) -> dict[str, int]:
    return dict(
        conn.execute(
            "SELECT source, count(*) FROM narrative_cache WHERE language = %s GROUP BY source ORDER BY source", (LANGUAGE,)
        ).fetchall()
    )


# --- All together --------------------------------------------------------------------


def fill_cache(
    database_url: str,
    client: NarrativeClient,
    connect_: Callable[[str], object] = connect,
) -> FillResult:
    config = client.config()
    with connect_(database_url) as conn:  # type: ignore[attr-defined]
        inputs = load_inputs(conn)
        cached = cached_keys(conn)

    hashes = {item.key: input_hash(item.request, config.model) for item in inputs}
    todo = [item for item in inputs if cached.get(item.key) != (hashes[item.key], config.prompt_version)]
    results, failed = generate(todo, client)

    with connect_(database_url) as conn:  # type: ignore[attr-defined]
        removed = write(conn, results, config.model, hashes, {item.key for item in inputs}, failed)
        sources = source_counts(conn)

    result = FillResult(
        generated=len(results), kept=len(inputs) - len(todo), failed=len(failed), removed=removed,
        sources=dict(Counter(sources)),
    )
    log.info(
        "narrative cache: %d latest-year Gaps; %d generated, %d kept (inputs unchanged), %d failed, %d removed; by source %s; "
        "prompt_version %s, model %r",
        len(inputs), result.generated, result.kept, result.failed, result.removed, result.sources,
        config.prompt_version, config.model,
    )
    return result
