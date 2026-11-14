#!/usr/bin/env bash
# Regenerate the TypeScript API types for `web` from the `api` OpenAPI spec.
#
#   scripts/gen-api-types.sh
#
# Needs only Docker; no local Python or Node. Works from Git Bash on Windows too.
#   1. Builds the api image (pinned versions from api/constraints.txt) and dumps
#      app.openapi() from it to web/openapi.json. No running server needed.
#   2. Runs openapi-typescript in a Node container to write web/src/lib/api-types.ts.
# The result is the same on every machine. api/tests/test_openapi_drift.py fails
# when the committed web/openapi.json no longer matches the app.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

api_image="reach-loop-api"
node_image="node:24-slim"
openapi_typescript="openapi-typescript@7.4.4"

# Git Bash: keep MSYS from rewriting /paths in docker arguments, and hand
# docker a Windows path for the mount.
export MSYS_NO_PATHCONV=1
mount_root="$root"
if pwd -W >/dev/null 2>&1; then mount_root="$(pwd -W)"; fi

# Write files as the calling user on Linux, not as root. Docker Desktop
# (macOS, Windows) maps ownership itself.
user_args=()
if [ "$(uname -s)" = "Linux" ]; then user_args=(--user "$(id -u):$(id -g)"); fi

echo "Building $api_image ..."
docker build --quiet --platform linux/amd64 -f api/Dockerfile -t "$api_image" . >/dev/null

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

docker run --rm --platform linux/amd64 "$api_image" python -c '
import json, sys
from app.main import app
json.dump(app.openapi(), sys.stdout, indent=2, ensure_ascii=False)
print()
' > "$tmp"
mv "$tmp" web/openapi.json

# ${arr[@]+...} keeps an empty array safe under `set -u` on macOS's bash 3.2.
docker run --rm ${user_args[@]+"${user_args[@]}"} \
  -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
  -v "$mount_root/web:/web" -w /web \
  "$node_image" npx --yes "$openapi_typescript" openapi.json -o src/lib/api-types.ts

echo "Wrote web/openapi.json and web/src/lib/api-types.ts"
