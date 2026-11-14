# `mock/` — the demo's API

The `web` demo reads three endpoints that **the real `api` does not serve yet**:

| Endpoint | Status |
|---|---|
| `GET /regions` | real `api` serves this too |
| `GET /overview` | **mock only** |
| `GET /regions/{code}/profile` | **mock only** |
| `GET /regions/{code}/action-library` | **mock only** |

`mock_api.py` is a zero-dependency stand-in that serves all four, so the UI can be
built and demoed before those routes exist in `api`. It is **not** a fake: the
scoring is ported from the real engine (`engine/app/scoring.py`'s severity
thresholds including the z-score branch for untargeted indicators), the wording
from `common/template.py`, and the strategy matches and peer groups are read
live out of `data/curated/`. The indicator values are the real 2024 figures.

What is genuinely new here — and the thing to port into `api` when these routes
are built — is the `profile` shape and the deterministic candidate-action rules.

## Running it

```sh
python3 mock/mock_api.py          # serves on 127.0.0.1:8000
cd web && API_URL=http://localhost:8000 npm run dev
```

No dependencies beyond the standard library.

## Things the web app adds on top

Two product concepts live entirely in the browser (`web/src/lib/program.tsx`),
not in this mock, because they are about *workflow state* rather than data:

- **Accounts.** A State Decision Maker and three Regional Decision Makers,
  switched from the header. Real auth would come from Suomi.fi.
- **Directives.** What a State account issues and a Regional account works.
  Persisted to `localStorage`, so the handoff survives a reload and an account
  switch. Replacing that module with real api calls is the whole migration.
