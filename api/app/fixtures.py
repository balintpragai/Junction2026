"""Fixture data for routes that don't read Postgres yet.

Only `/outreach-list` is still fixture-backed; it moves to real data in #16.
The fixture is parsed through its Pydantic model at import time, so a fixture
that drifts from the contract stops the app from starting.
"""

from pathlib import Path

from common.models import OutreachList

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load[M](model: type[M], name: str) -> M:
    return model.model_validate_json((FIXTURE_DIR / name).read_text(encoding="utf-8"))


OUTREACH_LISTS: dict[tuple[str, int], OutreachList] = {
    (o.indicator.code, o.year): o for o in [_load(OutreachList, "outreach_list_3621_2024.json")]
}
