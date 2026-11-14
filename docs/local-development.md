# Local development: running and testing the API

This is the reference for running the Reach Loop services locally, testing them, and building `web` against them. Keep it up to date when a service, route or command changes.

## Current state

Only `api` exists. It serves **fixtures**, not database data (Step 0 in BUILD.md, "contracts before code"). `db`, `seed`, `engine` and `narrative` don't exist yet, so there is no `docker compose` file yet.

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
- Node.js with `npm`/`npx` (only to regenerate the TypeScript types and run `web`)
- Docker (optional, only to run the container)

## One-time setup

From the repo root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r api/requirements-dev.txt
```

`requirements-dev.txt` installs FastAPI, Uvicorn, pytest, and the shared `common/` package in editable mode, so model changes take effect without reinstalling.

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

The suite (`api/tests/test_contract.py`) checks that:

- every route returns 200 and its body validates against its Pydantic model
- `/openapi.json` points each route at its typed schema
- the Helsinki case has the right numbers: 74.3 against a Target of 80, deviation −5.7, `below`, `act`
- the Gap fixture is internally consistent: deviation, rank, peer count, trend and Narrative all agree
- the outreach list can't validate without a non-empty `ecological_fallacy_note`
- outreach rows are below target and ranked by Gap
- unknown combinations return 404
- `Cache-Control` is set

Run the tests after any change to `common/common/models.py` or to the fixtures.

## Run in Docker

The image builds from the **repo root** because it needs both `common/` and `api/`:

```sh
docker build -f api/Dockerfile -t reach-loop-api .
docker run --rm -p 8000:8000 -e WEB_ORIGIN=http://localhost:3000 reach-loop-api
```

The image targets `linux/amd64` and has a `HEALTHCHECK` on `/health`.

> The Docker image has not been build-tested yet. Report any failure.

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

This dumps the spec straight from the app, so no running server is needed. It then runs `openapi-typescript` (pinned to 7.4.4) through `npx`. Commit both `web/openapi.json` and `web/src/lib/api-types.ts` in the same PR as the model change. To use a Python other than `.venv/bin/python`, set `PYTHON=/path/to/python`.

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
| `npx: command not found` in `gen-api-types.sh` | Install Node.js with npm. |
| 404 from gap-summary or outreach-list | Only the fixture combinations in the table at the top exist. |
