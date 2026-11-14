"""Apply the ordered SQL files in `db/` that have not been applied yet.

Each file is applied once and recorded in `schema_migrations`. Never edit a
shipped file; add the next numbered one.
"""

from pathlib import Path

import psycopg

_CREATE_LEDGER = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
)
"""


def migration_files(schema_dir: Path) -> list[Path]:
    files = sorted(schema_dir.glob("*.sql"))
    if not files:
        raise FileNotFoundError(f"No .sql files in {schema_dir}")
    return files


def apply_migrations(conn: psycopg.Connection, schema_dir: Path) -> list[str]:
    """Apply pending files in name order, inside the caller's transaction. Returns their names."""
    conn.execute(_CREATE_LEDGER)
    done = {row[0] for row in conn.execute("SELECT filename FROM schema_migrations")}
    applied = []
    for path in migration_files(schema_dir):
        if path.name in done:
            continue
        # No parameters, so psycopg sends the file as one simple query: several statements are fine.
        conn.execute(path.read_text(encoding="utf-8"))  # type: ignore[arg-type]
        conn.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,))
        applied.append(path.name)
    return applied
