"""The committed web/openapi.json must match what the app generates.

`web` builds against web/openapi.json and the TypeScript types generated from
it, so a model change without regenerating would leave the frontend on a stale
contract.
"""

import difflib
import json
from pathlib import Path

from app.main import app

COMMITTED_SPEC = Path(__file__).resolve().parents[2] / "web" / "openapi.json"

FIX = "web/openapi.json is stale: run scripts/gen-api-types.sh and commit web/openapi.json and web/src/lib/api-types.ts."


def _render(spec: dict) -> list[str]:
    # Same formatting as scripts/gen-api-types.sh writes.
    return json.dumps(spec, indent=2, ensure_ascii=False).splitlines()


def test_committed_openapi_matches_app():
    # Compare line by line, ignoring line endings (a Windows checkout may have CRLF).
    committed = COMMITTED_SPEC.read_text(encoding="utf-8").splitlines()
    generated = _render(app.openapi())
    if committed != generated:
        diff = "\n".join(list(difflib.unified_diff(committed, generated, "committed", "generated", lineterm=""))[:40])
        raise AssertionError(f"{FIX}\n\n{diff}")
