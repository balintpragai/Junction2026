"""Postgres access shared by the Python services (psycopg 3, no ORM)."""

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from .settings import Settings


@contextmanager
def connect(database_url: str | None = None) -> Iterator[psycopg.Connection]:
    """Open a connection; commits on success, rolls back on error, always closes.

    Defaults to `DATABASE_URL` from the environment.
    """
    url = database_url or Settings.from_env().require("database_url").database_url
    with psycopg.connect(url, connect_timeout=5) as conn:
        yield conn


def ping(database_url: str | None = None) -> None:
    """Raise if the database can't answer `SELECT 1`."""
    with connect(database_url) as conn:
        conn.execute("SELECT 1")
