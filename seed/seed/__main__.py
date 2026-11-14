"""`seed` (one-shot): create the schema, load the data, exit.

1. Reads and checks every input file first, so a bad file fails before the
   database is touched.
2. In one transaction: applies pending `db/*.sql` files, then loads the 23
   Regions, the indicator registry, every value, and the curated strategy
   actions when present.
3. Prints counts only (never data rows).
4. Asks `engine` to rescore and waits, so `fact_gap_score` is filled before
   `api` starts. A failed or partial rescore is a loud warning, not an error:
   seed still exits 0, because the previous Gaps stay in place.

Run with `python -m seed`. Paths resolve from the repo root (or /srv in the image).
"""

import sys
from pathlib import Path

from common import engine_client
from common.db import connect
from common.settings import Settings

from . import load, schema, store

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "db"
PROCESSED_DIR = ROOT / "data" / "processed"
CURATED_DIR = ROOT / "data" / "curated"
REGIONS_FILE = ROOT / "data" / "raw" / "sotkanet_regions.json"

ADVISORY_LOCK_KEY = 7_000_007
"""Keeps two seeds from loading at once."""


def main() -> int:
    settings = Settings.from_env().require("database_url", "engine_url")

    # --- Read and check every input --------------------------------------
    regions = load.read_regions(REGIONS_FILE)
    regions, has_parent_areas = load.apply_parent_areas(regions, CURATED_DIR / "region_parent_area.csv")
    region_codes = {r.code for r in regions}

    specs = load.read_indicator_registry(CURATED_DIR / "indicators.csv")
    facts: list[load.FactRow] = []
    reports: dict[str, load.LoadReport] = {}
    for spec in specs:
        rows, reports[spec.indicator_id] = load.read_indicator_values(spec, PROCESSED_DIR, region_codes)
        facts.extend(rows)
    missing = load.apply_known_missing(facts, load.read_known_missing(CURATED_DIR / "known_missing_values.csv"), region_codes)

    actions = load.read_strategy_actions(CURATED_DIR / "strategy_action.csv")
    links = load.read_strategy_links(CURATED_DIR / "strategy_action_indicator.csv")

    # --- Write, all or nothing --------------------------------------------
    with connect(settings.database_url) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(%s)", (ADVISORY_LOCK_KEY,))
        applied = schema.apply_migrations(conn, SCHEMA_DIR)
        store.upsert_regions(conn, regions)
        store.upsert_indicators(conn, specs)
        store.replace_values(conn, facts, regions)
        skipped_links = 0
        if actions is not None:
            skipped_links = store.replace_strategy_actions(conn, actions, links, {s.indicator_id for s in specs})
        counts = store.table_counts(conn)

    # --- Report: counts only ----------------------------------------------
    print(f"seed: schema files applied this run: {', '.join(applied) or 'none (already up to date)'}")
    print("seed: per indicator: rows, Regions, skipped non-Region rows (e.g. Whole country)")
    for spec in specs:
        r = reports[spec.indicator_id]
        print(f"  {spec.indicator_id:<30} {spec.pathway_stage:<21} {r.rows:>5} {r.regions:>3} {r.skipped_non_region_rows:>4}")
    print(
        f"seed: known missing years: {missing.added} added as NULL, {missing.already_null} already empty, "
        f"{missing.nulled} had a value and were set to NULL"
    )
    print(f"seed: parent areas: {'loaded' if has_parent_areas else 'file not present, skipped'}")
    if actions is None:
        print("seed: strategy actions: file not present, skipped")
    else:
        print(f"seed: strategy actions: loaded; {skipped_links} link(s) skipped for an unknown indicator or action")
    print("seed: table row counts")
    for table, n in counts.items():
        print(f"  {table:<26} {n:>6}")

    rescore(settings.engine_url)  # type: ignore[arg-type]
    return 0


def rescore(engine_url: str) -> None:
    """Score so a fresh `docker compose up` ends fully scored.

    A rescore problem is a warning, not a failure: the data above is loaded and
    consistent, and a failed rescore leaves the previous Gaps in place, so the
    stack should still come up. Only a load error stops it.
    """
    print("seed: rescore: started, waiting for engine")
    try:
        job = engine_client.rescore_and_wait(engine_url)
    except engine_client.RescoreFailed as e:
        _warn(f"rescore failed; previous Gaps kept\n{e.job.model_dump_json(indent=2)}")
        return
    except (TimeoutError, OSError) as e:  # OSError covers urllib's URLError: engine unreachable
        _warn(f"rescore did not finish ({type(e).__name__}: {e}); previous Gaps kept")
        return
    print(f"seed: rescore: {job.status}, {job.gaps_written} Gaps written, {job.gaps_removed} stale removed")
    if job.status == "partial":
        _warn(f"rescore partial: {len(job.failed_indicators)} indicator(s) kept their previous Gaps")
    print(job.model_dump_json(indent=2))


def _warn(message: str) -> None:
    sys.stdout.flush()  # keep the log in order: stdout is block-buffered in the container, stderr is not
    print(f"seed: WARNING: {message}", file=sys.stderr)
    print("seed: WARNING: the stack starts anyway. Fix, then: docker compose exec engine python -m app.rescore_now", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
