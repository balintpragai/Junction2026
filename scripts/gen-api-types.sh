#!/usr/bin/env bash
# Regenerate the TypeScript API types for `web` from the `api` OpenAPI spec.
#
#   scripts/gen-api-types.sh
#
# Needs: the Python env with api deps (pip install -r api/requirements-dev.txt)
# and Node with npx. PYTHON overrides the interpreter (default: .venv/bin/python).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
python="${PYTHON:-$root/.venv/bin/python}"

# Dump the spec straight from the app; no running server needed.
(cd "$root/api" && "$python" -c '
import json, sys
from app.main import app
json.dump(app.openapi(), sys.stdout, indent=2, ensure_ascii=False)
print()
') > "$root/web/openapi.json"

npx --yes openapi-typescript@7.4.4 "$root/web/openapi.json" -o "$root/web/src/lib/api-types.ts"
echo "Wrote web/openapi.json and web/src/lib/api-types.ts"
