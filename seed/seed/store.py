"""Write the seed rows to Postgres. Safe to run again on a seeded database.

Regions and indicators are upserted, because Gaps and Narratives refer to them.
Values are replaced wholesale. Strategy actions and their links are replaced
when the curated files are present, and left alone when they are not.
"""

from dataclasses import asdict

import psycopg
from psycopg.types.json import Jsonb

from .load import FactRow, IndicatorSpec, Region


def upsert_regions(conn: psycopg.Connection, regions: list[Region]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO dim_region (region_id, code, name_en, name_fi, name_sv, kind,
                                    parent_area, parent_area_basis, parent_area_note)
            VALUES (%(region_id)s, %(code)s, %(name_en)s, %(name_fi)s, %(name_sv)s, %(kind)s,
                    %(parent_area)s, %(parent_area_basis)s, %(parent_area_note)s)
            ON CONFLICT (region_id) DO UPDATE SET
                code = EXCLUDED.code, name_en = EXCLUDED.name_en, name_fi = EXCLUDED.name_fi,
                name_sv = EXCLUDED.name_sv, kind = EXCLUDED.kind, parent_area = EXCLUDED.parent_area,
                parent_area_basis = EXCLUDED.parent_area_basis, parent_area_note = EXCLUDED.parent_area_note
            """,
            [asdict(r) for r in regions],
        )


def upsert_indicators(conn: psycopg.Connection, specs: list[IndicatorSpec]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO dim_indicator (indicator_id, name, name_fi, source, unit, pathway_stage,
                                       cancer_type, has_named_target, target_value, higher_is_better)
            VALUES (%(indicator_id)s, %(name)s, %(name_fi)s, %(source)s, %(unit)s, %(pathway_stage)s,
                    %(cancer_type)s, %(has_named_target)s, %(target_value)s, %(higher_is_better)s)
            ON CONFLICT (indicator_id) DO UPDATE SET
                name = EXCLUDED.name, name_fi = EXCLUDED.name_fi, source = EXCLUDED.source,
                unit = EXCLUDED.unit, pathway_stage = EXCLUDED.pathway_stage,
                cancer_type = EXCLUDED.cancer_type, has_named_target = EXCLUDED.has_named_target,
                target_value = EXCLUDED.target_value, higher_is_better = EXCLUDED.higher_is_better
            """,
            [
                {
                    "indicator_id": s.indicator_id, "name": s.name, "name_fi": s.name_fi,
                    "source": s.source, "unit": s.unit, "pathway_stage": s.pathway_stage,
                    "cancer_type": s.cancer_type, "has_named_target": s.has_named_target,
                    "target_value": s.target_value, "higher_is_better": s.higher_is_better,
                }
                for s in specs
            ],
        )


def replace_values(conn: psycopg.Connection, facts: list[FactRow], regions: list[Region]) -> None:
    region_id = {r.code: r.region_id for r in regions}
    conn.execute("DELETE FROM fact_indicator_value")
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO fact_indicator_value (region_id, indicator_id, year, value, data_quality_notes)
            VALUES (%s, %s, %s, %s, %s)
            """,
            [(region_id[f.region_code], f.indicator_id, f.year, f.value, Jsonb(f.notes)) for f in facts],
        )


def replace_strategy_actions(
    conn: psycopg.Connection,
    actions: list[dict],
    links: list[dict] | None,
    indicator_ids: set[str],
) -> int:
    """Replace actions and links. Returns how many links were skipped for naming an unknown indicator or action."""
    conn.execute("DELETE FROM strategy_action_indicator")
    conn.execute("DELETE FROM dim_strategy_action")
    if actions:
        columns = list(actions[0])
        with conn.cursor() as cur:
            cur.executemany(
                f"INSERT INTO dim_strategy_action ({', '.join(columns)}) "  # columns come from load.py, not the file
                f"VALUES ({', '.join('%(' + c + ')s' for c in columns)})",
                actions,
            )
    if not links:
        return 0
    action_ids = {a["action_id"] for a in actions}
    usable = [l for l in links if l["indicator_id"] in indicator_ids and l["action_id"] in action_ids]
    if usable:
        columns = list(usable[0])
        with conn.cursor() as cur:
            cur.executemany(
                f"INSERT INTO strategy_action_indicator ({', '.join(columns)}) "
                f"VALUES ({', '.join('%(' + c + ')s' for c in columns)})",
                usable,
            )
    return len(links) - len(usable)


TABLES = (
    "dim_region",
    "dim_indicator",
    "fact_indicator_value",
    "dim_strategy_action",
    "strategy_action_indicator",
    "fact_gap_score",
    "narrative_cache",
)


def table_counts(conn: psycopg.Connection) -> dict[str, int]:
    """Row count per table. Counts only, never rows."""
    return {t: conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in TABLES}  # type: ignore[index]
