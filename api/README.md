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

## Running, testing and regenerating types

See [docs/local-development.md](../docs/local-development.md), the reference for local running, testing, and building `web` against the API.
