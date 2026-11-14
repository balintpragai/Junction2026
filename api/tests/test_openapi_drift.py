"""The committed web/openapi.json must match what the app produces.

`web` builds its TypeScript types from that file, so a contract change in
common/common/models.py that isn't regenerated would leave `web` on stale types
without anyone noticing.
"""

import json
from pathlib import Path

from app.main import app

COMMITTED_SPEC = Path(__file__).resolve().parents[2] / "web" / "openapi.json"


def _differing_paths(a, b, path="") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        return [
            p
            for key in sorted(a.keys() | b.keys())
            for p in _differing_paths(a.get(key), b.get(key), f"{path}/{key}")
        ]
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [p for i, (x, y) in enumerate(zip(a, b)) for p in _differing_paths(x, y, f"{path}/{i}")]
    return [] if a == b else [path or "/"]


def test_committed_openapi_matches_app():
    committed = json.loads(COMMITTED_SPEC.read_text(encoding="utf-8"))
    current = app.openapi()

    # Compared as data, not text, so line endings and indentation don't matter.
    diffs = _differing_paths(committed, current)
    assert not diffs, (
        "web/openapi.json is out of date with the api contract. Run "
        "scripts/gen-api-types.sh and commit web/openapi.json and "
        "web/src/lib/api-types.ts. If only package versions changed, check "
        "that your venv was installed from api/requirements-dev.txt (which "
        "uses api/constraints.txt).\nDiffering paths:\n  "
        + "\n  ".join(diffs[:10])
        + (f"\n  ... and {len(diffs) - 10} more" if len(diffs) > 10 else "")
    )
