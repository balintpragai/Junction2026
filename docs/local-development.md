# Local development: running and testing the API

This is the reference for running the Reach Loop services locally, testing them, and building `web` against them. Keep it up to date when a service, route or command changes.

## Current state

All six services from BUILD.md run under `docker compose` (see [Run the whole stack](#run-the-whole-stack-docker-compose)). `seed` fills Postgres with the schema and every value in `data/processed/` (see [`seed`: schema and data](#seed-schema-and-data)), but `api` still serves **fixtures**, not database data (Step 0 in BUILD.md, "contracts before code"). `engine` and `web` are stubs that later tickets fill in.

| Route | Response type | Fixture coverage |
|---|---|---|
| `GET /health` | `Health` | always `{"status":"ok"}` |
| `GET /regions` | `RegionList` | all 23 Regions |
| `GET /indicators` | `IndicatorList` | 4 indicators; only `3621` has a Target (80%) |
| `GET /regions/{code}/gap-summary?indicator=&year=` | `GapSummary` | only `helsinki`, `3621`, `2024` |
| `GET /outreach-list?indicator=&year=` | `OutreachList` | only `3621`, `2024` |

Any other region, indicator or year returns **404** with a JSON `detail` message. Both query parameters are required. Leaving one out returns **422**.

> **Fixture numbers are placeholders.** Only Helsinki's 2024 breast-screening value (74.3% against the 80% Target, deviation −5.7, Severity `act`) comes from the brief. Peer values, trend, covariates and the strategy action text are invented so the UI has something to render. Never quote them as real figures. The gap-summary response carries a `fixture_data` note in `data_quality_notes` that says so.

## Prerequisites

- Python 3.12 or newer
- Node.js with `npm` (only to run `web` outside Docker)
- Docker (to run the stack, and to regenerate the TypeScript types)

## One-time setup

From the repo root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r api/requirements-dev.txt
```

`requirements-dev.txt` installs FastAPI, Uvicorn, pytest, and the shared `common/` package in editable mode, so model changes take effect without reinstalling. It installs the same pinned versions as the api image (`api/constraints.txt`), so the tests see the same OpenAPI spec the image produces.

On Windows the venv's Python is `.venv\Scripts\python` instead of `.venv/bin/python`.

## Run the API

```sh
cd api
../.venv/bin/uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive docs (Swagger UI): http://localhost:8000/docs
- OpenAPI spec: http://localhost:8000/openapi.json

The app checks every fixture against its model at startup. If a fixture no longer matches the contract, the server won't start, and the error names the bad field.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `WEB_ORIGIN` | `http://localhost:3000` | Allowed CORS origins, comma-separated. Set it if `web` runs on another port. |

Example: `WEB_ORIGIN=http://localhost:3000,http://localhost:5173 ../.venv/bin/uvicorn app.main:app --reload`

### Response headers

Successful data routes send `Cache-Control: max-age=300`. While developing, a hard refresh or the browser devtools "Disable cache" option avoids stale responses.

## Try it with curl

With the server running:

```sh
curl -s localhost:8000/health
curl -s localhost:8000/regions
curl -s localhost:8000/indicators
curl -s 'localhost:8000/regions/helsinki/gap-summary?indicator=3621&year=2024'
curl -s 'localhost:8000/outreach-list?indicator=3621&year=2024'

# Expected 404 (no fixture for this combination)
curl -s -w '\n%{http_code}\n' 'localhost:8000/regions/lappi/gap-summary?indicator=3621&year=2024'
```

Pipe through `jq` (or `python3 -m json.tool`) for readable output.

## Run the tests

```sh
cd api
../.venv/bin/python -m pytest
```

The suite (`api/tests/test_contract.py`, `api/tests/test_openapi_drift.py`) checks that:

- every route returns 200 and its body validates against its Pydantic model
- `/openapi.json` points each route at its typed schema
- the Helsinki case has the right numbers: 74.3 against a Target of 80, deviation −5.7, `below`, `act`
- the Gap fixture is internally consistent: deviation, rank, peer count, trend and Narrative all agree
- the outreach list can't validate without a non-empty `ecological_fallacy_note`
- outreach rows are below target and ranked by Gap
- unknown combinations return 404
- `Cache-Control` is set
- the committed `web/openapi.json` matches what the app generates. If it fails, the message shows the diff and tells you to run `scripts/gen-api-types.sh`.

Run the tests after any change to `common/common/models.py` or to the fixtures.

## Run the whole stack (docker compose)

Needs Docker with the compose plugin (Arch: `sudo pacman -S docker-compose docker-buildx`). From the repo root:

```sh
docker compose up --build        # add -d to run in the background
docker compose ps                # every service should be "healthy"; seed shows "exited (0)"
docker compose down              # stop; add -v to also delete the database volume
```

| Service | What it is now | Port on your machine |
|---|---|---|
| `db` | Postgres 16, data in the `db-data` volume | none |
| `narrative` | `POST /narrative`: LLM Narrative with number-check, or Template sentence | none |
| `engine` | FastAPI stub, `/health` only | none |
| `seed` | One-shot: applies `db/*.sql`, loads Regions, indicators and values, checks `engine`, exits 0 | none |
| `api` | The fixture API | `8000` (`API_PORT`) |
| `web` | Next.js placeholder page, `/health` | `3000` (`WEB_PORT`) |

Startup order: `db` → `narrative` → `engine` → `seed` (must exit 0) → `api` → `web`. Each step waits for the one before it to be healthy.

Then open http://localhost:3000. It should say "API reachable: 23 Regions loaded."

### `seed`: schema and data

`seed` runs on every `docker compose up` and is safe to run again: it reloads the data and applies only the schema files it hasn't applied yet. `docker compose logs seed` shows what it loaded, as counts only (never data rows).

| What | Where | Notes |
|---|---|---|
| Schema | `db/001_schema.sql`, … | Plain SQL, applied in file-name order and recorded in `schema_migrations`. Never edit a shipped file; add the next number. |
| Regions | `data/raw/sotkanet_regions.json` | The 23 `HYVINVOINTIALUE` entries. `parent_area` comes from `data/curated/region_parent_area.csv` when present. |
| Indicators | `data/curated/indicators.csv` | One row per indicator: stage, unit, Target, direction, and the processed file (and column, for wide files) its values come from. A new indicator is a new row here, not new code. |
| Values | `data/processed/*.csv` | Only the 23 Regions; the "Whole country" row is skipped. Empty cells are stored as NULL with a `missing_value` note, never zero. |
| Known missing years | `data/curated/known_missing_values.csv` | Stored as NULL with the reason, e.g. Helsinki on 3336 for 2022–24. |
| Strategy actions | `data/curated/strategy_action.csv`, `strategy_action_indicator.csv` | Loaded when present; skipped (not an error) when missing. |

Data-quality notes live in `fact_indicator_value.data_quality_notes` as a list of `{"code", "message"}`, the shape of `DataQualityNote`. Every covariate row carries `ecological_fallacy`; every colorectal-screening (6103) row carries `short_history`.

To start from an empty database: `docker compose down -v`, then `docker compose up --build`.

Run the loader's tests without Docker:

```sh
.venv/bin/pip install -r seed/requirements-dev.txt     # from the repo root
cd seed && ../.venv/bin/python -m pytest
```

### Configuration

Everything comes from environment variables. `.env.example` lists them all. Each has a working default in `compose.yaml`, so a clean clone runs without a `.env`. To override values, `cp .env.example .env` and edit it. Compose reads `.env` on its own, and it's gitignored. Never commit real keys.

| Variable | Used by | Default |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `db` | `reachloop` |
| `DATABASE_URL` | `engine`, `seed`, `api` | `postgresql://reachloop:reachloop@db:5432/reachloop` |
| `ENGINE_URL` | `seed` | `http://engine:8000` |
| `NARRATIVE_URL` | `engine` | `http://narrative:8000` |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | `narrative` | empty (Template sentences only) |
| `WEB_ORIGIN` | `api` (CORS) | `http://localhost:3000` |
| `API_PORT`, `WEB_PORT` | published ports | `8000`, `3000` |
| `BIND_ADDRESS` | which host address `api` and `web` publish on | `127.0.0.1` (this machine only; `0.0.0.0` exposes them to your network) |
| `COMPOSE_PROFILES`, `RESTART_POLICY`, `WEB_DOMAIN`, `API_DOMAIN` | demo host only, see [demo-host.md](demo-host.md) | empty / `no` |

Python services read these through `common.settings.Settings`. A service that needs a variable calls `.require(...)` at startup and stops with the names of any missing ones.

### Build one image

Each image builds from the **repo root**, because the Python images need `common/`. All images target `linux/amd64`:

```sh
docker build --platform linux/amd64 -f api/Dockerfile -t reach-loop-api .
docker run --rm -p 8000:8000 reach-loop-api
```

## `narrative` service

Internal only: `engine` calls it, and it publishes no port. `POST /narrative` takes a `NarrativeRequest` (one Gap plus Region and indicator names, unit, optional action text and data-quality note, and `language`). It returns a `NarrativeResult`: `text`, `source` (`llm` | `template`), `language`, `numbers_checked`, `prompt_version` and `rejected_numbers`. Both models are in `common/common/models.py`.

How it decides:
1. If an LLM is configured (`LLM_BASE_URL` and `LLM_MODEL`; `LLM_API_KEY` is optional) and `language` is `en`, it calls `{LLM_BASE_URL}/chat/completions` at temperature 0 with the strict prompt in `narrative/app/prompt.py`.
2. **Number-check:** every number in the reply must match a figure from the facts sent to the LLM. `5,7` and `5.7` match, and units and signs are ignored (`%` and `pp`). Rounded or invented numbers fail. So does a reply over 60 words, or an LLM error.
3. If anything fails, or no LLM is configured, or `language` is `fi`, it returns the **Template sentence**. It never returns an error to the caller.

`prompt_version` is a hash of the prompt and the Template sentence wording. It changes whenever either changes, so cached Narratives can be invalidated exactly.

Run and test it without Docker:

```sh
.venv/bin/pip install -r narrative/requirements-dev.txt     # from the repo root
cd narrative && ../.venv/bin/python -m pytest
cd narrative && ../.venv/bin/uvicorn app.main:app --port 8001   # no LLM: Template sentences only
```

To try a real LLM, set the three variables before starting it, for example `LLM_BASE_URL=https://api.openai.com/v1 LLM_MODEL=... LLM_API_KEY=...`. Any OpenAI-compatible endpoint works (vLLM, Ollama, Gemini's OpenAI-compatible API, Verda).

The Finnish Template sentence wording is pending native-speaker review (#21).

## Run `web` without Docker

```sh
cd web
npm ci
API_URL=http://localhost:8000 npm run dev    # http://localhost:3000
npm run typecheck
```

## Frontend (`web`): using the contract

### TypeScript types

The types are generated from the API's OpenAPI spec and committed:

- `web/openapi.json`: the spec
- `web/src/lib/api-types.ts`: the generated types (`paths`, `components`)

Pull response types from `components["schemas"]`:

```ts
import type { components } from "@/lib/api-types"; // or a relative path

type GapSummary = components["schemas"]["GapSummary"];
type OutreachList = components["schemas"]["OutreachList"];
type Severity = GapSummary["gap"]["severity"]; // "ok" | "watch" | "act"

const res = await fetch(
  `${API_URL}/regions/${code}/gap-summary?indicator=${indicator}&year=${year}`,
);
if (res.status === 404) {
  /* no Gap for this combination */
}
const summary: GapSummary = await res.json();
```

`paths` also describes each route's parameters, so a typed client such as `openapi-fetch` can use the same file without extra setup.

### Rules for the UI

- **Show `ecological_fallacy_note`** wherever the outreach list appears. It is required in the contract, so the UI can't drop it without anyone noticing.
- **Show `narrative.text` as given.** `narrative.source` is `llm` or `template` (a Template sentence). Use it for a badge if you like. Don't rewrite the text.
- `gap.reference_kind` is `target` when the indicator has a Target and `peer_median` when it doesn't. Label the reference accordingly.
- `indicator.target` is `null` for most indicators.
- Use the GLOSSARY.md terms in UI copy (Region, Gap, Target, Severity).

### Regenerate the types after a contract change

Whenever `common/common/models.py` changes:

```sh
scripts/gen-api-types.sh
```

It needs only Docker, and works the same on Linux, macOS and Windows (Git Bash). Both steps run in containers:

1. It builds the api image, which installs the pinned versions from `api/constraints.txt`, and dumps `app.openapi()` to `web/openapi.json` (UTF-8, LF line endings).
2. It runs `openapi-typescript@7.4.4` in `node:24-slim` to write `web/src/lib/api-types.ts`.

It ends by printing `git diff --stat` for the two files. On an unchanged contract that diff is empty. Commit both files in the same PR as the model change. The drift test fails until you do.

On Linux and macOS the files are written as your user, not root. On Windows the script converts the mount path for Docker Desktop (`pwd -W`, `MSYS_NO_PATHCONV=1`), so run it from Git Bash, not PowerShell.

### Bump the pinned versions

`api/constraints.txt` pins every Python package in the api image, so the same commit always produces the same spec. `api/requirements.txt` and `common/pyproject.toml` keep the allowed ranges; the constraints file says what is actually installed. To move to newer versions, or after changing a range:

```sh
scripts/update-api-constraints.sh                    # 1. resolves fresh in python:3.12-slim (linux/amd64), rewrites api/constraints.txt
.venv/bin/pip install -r api/requirements-dev.txt    # 2. update your venv to the new pins
scripts/gen-api-types.sh                             # 3. a new FastAPI or pydantic can change the spec
cd api && ../.venv/bin/python -m pytest              # 4.
```

`update-api-constraints.sh` needs only Docker, mounts the repo read-only, and replaces `api/constraints.txt` only after resolving succeeds. If the spec changes, check that `git diff web/` is only the library's doing, then commit `api/constraints.txt` and `web/` together. To bump a single package, edit its line in `api/constraints.txt` by hand and run steps 2 to 4.

Run both scripts as yourself, not with `sudo`. Under `sudo` the containers run as root, and regenerated files in `web/` end up owned by root. If you can't use Docker without `sudo`, add yourself to the `docker` group (see Troubleshooting).

## Changing the contract: checklist

1. Edit the models in `common/common/models.py`.
2. Update the matching fixture in `api/app/fixtures/`.
3. `cd api && ../.venv/bin/python -m pytest`
4. `scripts/gen-api-types.sh`
5. Commit the models, fixtures, `web/openapi.json` and `web/src/lib/api-types.ts` together.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `../common is not a valid editable requirement` (or `./common`) | Run the pip install from the **repo root**. pip resolves the `-e ./common` path against the current directory. |
| `ModuleNotFoundError: No module named 'common'` | Run `.venv/bin/pip install -r api/requirements-dev.txt` again from the repo root. |
| `ModuleNotFoundError: No module named 'app'` | Run uvicorn and pytest from inside `api/`. |
| Server fails at startup with a `ValidationError` | A fixture doesn't match its model. The error names the file's field. |
| Browser blocks requests (CORS) | Add the `web` origin to `WEB_ORIGIN`. |
| `docker build`: `lstat .../api/api: no such file or directory` | Run `docker build -f api/Dockerfile -t reach-loop-api .` from the **repo root**, not from `api/`. |
| `docker: unknown command: docker compose` | Install the compose plugin: `sudo pacman -S docker-compose`. |
| `permission denied ... /var/run/docker.sock` | `sudo usermod -aG docker $USER`, then log out and back in. |
| `Bind for 0.0.0.0:8000 failed: port is already allocated` | Something else (often an old `docker run` of `api`) holds the port. Stop it, or set `API_PORT` / `WEB_PORT`. |
| `seed` exits non-zero | `docker compose logs seed`. It needs `db` and `engine` healthy and `DATABASE_URL` / `ENGINE_URL` set. |
| `test_committed_openapi_matches_app` fails | A model changed without regenerating. Run `scripts/gen-api-types.sh` and commit `web/`. If you didn't change a model, reinstall the dev env so it has the pinned versions: `.venv/bin/pip install -r api/requirements-dev.txt`. |
| `gen-api-types.sh` on Windows: `invalid mount config` or files land in a strange path | Run it from Git Bash. The script handles the path conversion there. |
| `web/` files owned by root after regenerating | The script ran under `sudo`. Fix with `sudo chown -R $USER web/`, then run it as yourself (in the `docker` group). For a one-off without re-logging in: `sudo -u $USER -g docker scripts/gen-api-types.sh`. |
| `seed` exits non-zero | `docker compose logs seed`. It needs `db` and `engine` healthy and `DATABASE_URL` / `ENGINE_URL` set. A `SeedInputError` names the input file, line and column that is malformed; nothing is written until every file reads cleanly. |
| `npx: command not found` in `gen-api-types.sh` | Install Node.js with npm. |
| 404 from gap-summary or outreach-list | Only the fixture combinations in the table at the top exist. |
