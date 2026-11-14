# api

Public, read-only Reach Loop API (FastAPI). Step 0 serves fixtures from
`app/fixtures/`; every fixture is validated against its model in
`common/common/models.py` when the app starts.

| Route | Response model |
|---|---|
| `GET /health` | `Health` |
| `GET /regions` | `RegionList` |
| `GET /indicators` | `IndicatorList` |
| `GET /regions/{code}/gap-summary?indicator=&year=` | `GapSummary` |
| `GET /outreach-list?indicator=&year=` | `OutreachList` |

Fixtures cover one case: Helsinki, breast-screening attendance (`3621`), 2024.
Any other region, indicator or year returns 404. Only Helsinki's 74.3% is real;
every other figure in the fixtures is a placeholder.

## Run locally

```sh
python3 -m venv .venv
.venv/bin/pip install -r api/requirements-dev.txt   # run from api/, or adjust paths
cd api && ../.venv/bin/uvicorn app.main:app --reload
cd api && ../.venv/bin/python -m pytest
```

`WEB_ORIGIN` (comma-separated) sets the allowed CORS origins; default
`http://localhost:3000`.

## Container

```sh
docker build -f api/Dockerfile -t reach-loop-api .
docker run -p 8000:8000 reach-loop-api
```

## Regenerate the TypeScript types for `web`

After changing a model in `common/common/models.py`:

```sh
scripts/gen-api-types.sh
```

This writes `web/openapi.json` and `web/src/lib/api-types.ts`. Commit both.
