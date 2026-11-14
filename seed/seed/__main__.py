"""`seed` (one-shot): create the schema, load the data, exit.

1. Reads and checks every input file first, so a bad file fails before the
   database is touched.
2. In one transaction: applies pending `db/*.sql` files, then loads the 23
   Regions, the indicator registry, every value, and the curated strategy
   actions when present.
3. Prints counts only (never data rows), then checks `engine` is up.
   Triggering the rescore comes in #13.

Run with `python -m seed`. Paths resolve from the repo root (or /srv in the image).
"""

import sys
import urllib.request
from pathlib import Path

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

    with urllib.request.urlopen(f"{settings.engine_url}/health", timeout=5) as r:
        print(f"seed: engine /health -> {r.status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
