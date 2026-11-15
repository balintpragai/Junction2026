# `mock/` — superseded

> **This mock no longer matches `web`. Do not run it for the demo.**
>
> Run the real stack instead: `docker compose up --build`, then open
> http://localhost:3000. See [`docs/local-development.md`](../docs/local-development.md).

This was a zero-dependency stand-in that served the three endpoints `web` needed
before the real `api` had them. All three now exist in `api`, reading Postgres:

| Endpoint | Then | Now |
|---|---|---|
| `GET /regions` | mock + real `api` | real `api` |
| `GET /overview` | mock only | **real `api`** |
| `GET /regions/{code}/profile` | mock only | **real `api`** |
| `GET /regions/{code}/action-library` | mock only | **real `api`** |

## Why running it now breaks the map

Two things changed when the routes moved into `api`, and this file was not
updated with them:

1. **Region codes.** The mock keys everything on slugs (`helsinki`). `api` uses
   Sotkanet codes from `dim_region.code` (`90`), which is what `web` now sends
   and what the map's geometry lookup expects. Against this mock the map draws
   nothing.
2. **Covariate ids.** The mock invented `immigrant_background_pct`,
   `kela_travel_eur_per_capita` and `broadband_gigabit_pct`. The real ids are
   `foreign_background_pct`, `3213` and `broadband_1000mbit_pct` — see
   [`common/covariates.py`](../common/common/covariates.py).

## Where its logic went

Nothing was thrown away. The parts that were genuinely new here are now in the
shared package, as pure functions with tests:

| Was in `mock_api.py` | Now |
|---|---|
| `synthesize()` | [`common/common/synthesis.py`](../common/common/synthesis.py), tested in `common/tests/test_synthesis.py` |
| `candidate_actions()`, `COVARIATE_ACTIONS`, `action_library()` | [`common/common/actions.py`](../common/common/actions.py), tested in `common/tests/test_actions.py` |
| the `profile` response shape | `RegionProfile` and friends in `common/common/models.py` |
| its severity and z-score port | nothing — `engine/app/scoring.py` already does this, and `api` reads `fact_gap_score` |
| its `template_sentence()` copy | nothing — `common/common/template.py` already existed |

The real `api` also serves two things this mock could not: the **LLM Narratives**
that `engine` caches in `narrative_cache` (the mock only ever produced Template
sentences), and the proper Finnish names — **Kanta-Häme**, **Päijät-Häme** and
**Åland**, which the mock's hardcoded table had stripped of diacritics.

## Things the web app still adds on top

Two product concepts live in the browser (`web/src/lib/program.tsx`), not in the
api, because they are about *workflow state* rather than data:

- **Accounts.** A State Decision Maker and three Regional Decision Makers,
  switched from the header. Real auth would come from Suomi.fi.
- **Directives.** What a State account issues and a Regional account works.
  Persisted to `localStorage`, so the handoff survives a reload and an account
  switch. Replacing that module with real api calls is the whole migration.

## Keeping or deleting this directory

It is dead code: nothing imports it and no test covers it. It is kept only as a
record of where the profile shape came from. Deleting `mock/` is safe once
nobody wants that history.
