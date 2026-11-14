# Build plan: Reach Loop, productionized (rev. 2 — containerized services)

**This file is the single entry point for the build.** Everything else in this repo — `data/`, `research/`, `zeneca_resources_en/` — is reference material the build consumes; this document is the plan itself, and where "where does X live" questions get answered first.

## Where everything actually lives

| Looking for... | Go to |
|---|---|
| The plan (this file) | `BUILD.md` |
| Source data, cleaned and ready to load | `data/processed/*.csv` — see `data/README.md` for what each file is, its exact source URL/method, and known caveats |
| Original/raw pulls (JSON API responses, images, ODS) | `data/raw/` — kept for traceability, not for the build to read directly |
| Fact-checked claims, citations, the covariate analysis | `research/*.md` — four files: `gemini_research.md`, `additional_data_sources.md`, `cancer_registry_screening_reports.md`, `covariate_correlation_analysis.md` |
| Original source PDFs (national strategy, roadmap, mentor deck) | `zeneca_resources_en/` |
| The two working mockup artifacts | Pathway Atlas — `https://claude.ai/artifact/TU4EHV8eV2jcgEva3NTG3X`; Reach Loop — `https://claude.ai/artifact/3M444xDbCuB55BPASLbWwY` |

---

## Context

Everything up to this point — `data/` (12 THL Sotkanet indicators, Kela flows, Cancer Registry per-cancer delay/equity data, NORDCAN, OECD, 4 structural covariates), `research/` (fact-checked strategy citations, the covariate correlation analysis with its ecological-fallacy correction), and the two HTML mockup artifacts — has been research and static-mockup work. Nothing runs yet; nothing reads from a real database; the "AI narrative" in Reach Loop is a hand-written JS string, not a model call.

**Decision:** productionize Reach Loop end-to-end — a real Postgres database seeded from `data/processed/`, a deterministic scoring engine, a real (bounded) LLM call for the narrative, and all three tabs (decision-maker / outreach / patient) reading live from that database. Extending something that already works, rather than starting over, is the safest path to a guaranteed working demo for Sunday's judging.

**Team:** a data scientist, a software developer, a UX/UI designer (working with AI tools), and the user coordinating and building alongside. The plan below is split into four workstreams along those lines.

**Explicit product directive:** the decision-maker dashboard leads with plain-language words — sentences and deductions, not just numbers — backed by graphs and maps that are easy to read and work from. That reshapes the Workstream 3 spec; it is not a polish item.

**Resolved before this plan was written down:** the schema design below originally flagged "check whether Finland has 21, 22, or 23 regions in our data." Checked directly against `data/raw/sotkanet_regions.json` (category `HYVINVOINTIALUE`): **23** — the 21 numbered wellbeing services counties (codes 01–21) plus City of Helsinki (90, split out of the old HUS catchment) plus Åland (91, included by THL/Sotkanet for regional comparison though not technically a mainland hyvinvointialue). **Correction (2026-11-14):** the source hierarchy does have parent links, just not a usable peer grouping. Each Region's `memberOf` points to its YTA (collaborative area: Southern, Eastern, Inland, Western, Northern Finland, plus Åland), and its `maakunta` can be derived through its municipalities. Neither works alone as a peer group: by maakunta only Uusimaa has more than one Region, and by YTA Helsinki's peers would include Päijät-Häme, Kymenlaakso and South Karelia. So `dim_region.parent_area` (used for peer comparisons) is still a curated mapping, loaded in the seed step from `data/curated/region_parent_area.csv`: the five Uusimaa Regions (01–04, 90) form `Uusimaa`, every other Region takes its YTA (Southern Finland minus Uusimaa), and Åland (91) is its own group with no peers. The file is keyed on `region_code` as text (keep the leading zeros) and records the basis and reasoning for each row.

## What changed from rev. 1

| Area | Rev. 1 | Rev. 2 (this plan) |
|---|---|---|
| Architecture | One Next.js app on Vercel; backend as Route Handlers | Each logical part is its own container; services talk over HTTP via FastAPI |
| Database | Postgres via Vercel Marketplace | Postgres container (same schema; host-agnostic) |
| Scheduling | Vercel Cron, nightly | On-demand `POST /jobs/rescore` + run-on-seed; schedule optional |
| LLM access | `ai` SDK + Vercel AI Gateway + OIDC | Narrative service with an OpenAI-compatible client; provider set by env vars |
| Hosting | Vercel | `docker compose` on one VM for the demo; Verda as the planned next target |

The rev. 1 correction still stands in spirit: a dedicated time-series database ("Tiger Data") was recommended for sponsor-track fit, but at our actual data volume (≈23 regions × ~20 indicators × 10–34 years ≈ low thousands of rows) that solves a problem we don't have. Plain Postgres is the right call.

---

## Architecture

```
                 ┌──────────────┐
  browser ──────▶│ web (Next.js)│
                 └──────┬───────┘
                        │ HTTP (public)
          ┌─────────────▼───────┐        ┌──────────────────┐
          │ api (FastAPI)       │───────▶│ narrative         │──▶ LLM provider
          │ read-only           │  HTTP   │ (FastAPI)         │   (env-configured;
          └─────────────┬───────┘        └────────▲──────────┘    Verda later)
                        │ SQL                      │ HTTP
          ┌─────────────▼───────┐        ┌─────────┴──────────┐
          │ db (Postgres)       │◀───────│ engine (FastAPI)   │
          └─────────────▲───────┘  SQL   │ scoring + jobs     │
                        │                └────────────────────┘
          ┌─────────────┴───────┐
          │ seed (1-shot)        │  loads data/processed/ → tables
          └──────────────────────┘
```

| Container | Role | Exposed? |
|---|---|---|
| `db` | Postgres 16, named volume, healthcheck | Internal only |
| `seed` | One-shot Python job: create schema, load CSVs + curated tables, then call `engine` to score. Exits. | — |
| `engine` | FastAPI. Owns the deterministic scoring function and `POST /jobs/rescore`; after scoring, asks `narrative` to fill the cache | Internal only |
| `narrative` | FastAPI. The only component that touches an LLM. Templated prompt, number-check, deterministic fallback | Internal only |
| `api` | FastAPI. Read-only public API the frontend uses. Reads from Postgres only; never calls the LLM on a request path | Yes |
| `web` | Next.js (`output: "standalone"`), the three tabs | Yes |

**Design rules:**
- Only `api` and `web` are exposed. Everything else stays on the internal compose network — no inter-service credentials to manage for the demo.
- One repo, one shared Python package (`common/`: DB session, Pydantic models, settings). Each FastAPI service is a thin app on top of it. If time runs short, merging `engine` into `api` is an `include_router` change, not a rewrite.
- Every service has `GET /health`. Compose `depends_on: condition: service_healthy` orders startup.
- Configuration via env vars only (`DATABASE_URL`, `ENGINE_URL`, `NARRATIVE_URL`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`). The same images then run locally, on the demo VM, and on Verda without code changes.

---

## Workstream 1 — Data (owner: data scientist)

**Goal:** turn the CSVs in `data/processed/` into a clean, loadable schema, and formalize the gap-scoring logic that currently lives in ad-hoc Python scripts (the deviation-from-target math behind the Pathway Atlas/Reach Loop charts, and the correlation work in `research/covariate_correlation_analysis.md`).

**Schema (Postgres) — 7 tables:**

| Table | Contents |
|---|---|
| `dim_region` | The 23 regions (see resolved question above), seeded from `data/raw/sotkanet_regions.json`. Add `parent_area` (e.g. `Uusimaa`) for peer comparisons — curated by hand in `data/curated/region_parent_area.csv`, not derived. |
| `dim_indicator` | One row per indicator: `id`, `name`, `source`, `unit`, `pathway_stage` [`detection`\|`referral`\|`treatment_initiation`\|`outcome`\|`covariate`], `cancer_type`, `has_named_target`, `target_value`, `higher_is_better`. The registry of what the engine can score — a new indicator is a new row, not new code. Covariates are indicators with `pathway_stage = covariate`, so they need no separate table. |
| `fact_indicator_value` | `(region_id, indicator_id, year, value, data_quality_note)`. Every CSV in `data/processed/` unioned into one long table — use `combined_cancer_indicators_by_wellbeing_county.csv` as the column template. |
| `dim_strategy_action` | The National Cancer Strategy's "Proposals for action" text, keyed by sub-objective (e.g. `2.5`, `3.1.1`), sourced from `research/gemini_research.md` §2 and the roadmap PDF extracts in `zeneca_resources_en/`. A curated lookup the data scientist edits directly, no code change needed. |
| `strategy_action_indicator` | Link table: which action(s) address which indicator(s). |
| `fact_gap_score` | Output of the scoring function, plus `scored_at` and `engine_version`. |
| `narrative_cache` | `(region_id, indicator_id, year, model, prompt_version) → text, source [llm\|fallback], numbers_checked, created_at`. |

Ship the schema as plain, ordered SQL files (`db/001_schema.sql`, …). Alembic isn't worth the setup time this weekend.

**Gap-scoring contract (formalize, don't rewrite):**

```
score(indicator_id, region_id, year) ->
  { value, target_or_reference, deviation, direction [above|below|on],
    severity [ok|watch|act], rank, n_regions, peer_values,
    trend_5y, data_quality_note }
```

- **Write down the severity thresholds** (e.g. targeted indicators: `act` if more than X pp from target; untargeted: `act` if `|z| ≥ 1.5`). Pick them once, put them in `dim_indicator` or a config file, and have the number ready for "why is this red?"
- **`peer_values` and `trend_5y` are new and required**, not nice-to-haves. A narrative like *"Helsinki is 5.7 points below target, and other Uusimaa areas sit in the same range"* can only be written without hallucinating if the peer comparison is already in the input. The scoring function computes it; the LLM only phrases it.
- **Pure and tested:** no DB access inside `score()`. The engine loads data, calls `score()`, writes rows. Add pytest cases using known values already established this session (e.g. Helsinki breast-screening 2024 = 74.3%, target 80%, deviation −5.7) so "same input → same output" is checked, not just claimed.

**Data-quality flags** — load the `data/README.md` caveats as `data_quality_note` values so the frontend shows them inline, not in a footnote nobody reads:
- Helsinki's 2022–24 gap on indicator 3336 → stored as missing years, never interpolated. The sparkline shows a visible break.
- The ecological-fallacy warning on county-level income/covariates → a note on every covariate indicator, surfaced wherever covariates appear in the outreach tab.
- Colorectal's thin 2022–24-only history → trend fields return `null` with a reason, not a fake 2-point "trend."

---

## Workstream 2 — Backend services (owner: software developer)

**Stack:** Python 3.12, FastAPI + Uvicorn, SQLAlchemy Core or `psycopg` (no ORM needed for seven tables), Pydantic v2, Docker + `docker compose`.

**Step 0 — contracts before code (first 2 hours):**
1. Write the Pydantic response models for the three public endpoints; stand up `api` returning fixture JSON from those models.
2. FastAPI generates the OpenAPI spec; generate TypeScript types from it (`openapi-typescript`) for `web`.
3. The frontend builds against fixtures while the real queries are written — this takes the backend off the frontend's critical path.

**`api` (public, read-only):**
- `GET /regions/{code}/gap-summary?indicator=X&year=Y` → precomputed gap score + matched strategy action + data-quality notes + cached narrative + the trend series for the sparkline, in one round-trip. Replaces the hardcoded `regions` array and `actionText` object in Reach Loop's `<script>`.
- `GET /outreach-list?indicator=X&year=Y` → regions below target, ranked by gap, joined with covariates (immigrant-background share). This is where "target by covariate, not just county" (`research/covariate_correlation_analysis.md`) becomes a feature instead of a footnote. **The response carries the ecological-fallacy note** so the UI can't silently drop it.
- `GET /indicators`, `GET /regions` → lookups for dropdowns and the tile map.
- CORS restricted to the `web` origin. `Cache-Control: max-age=300` — data only changes when a rescore runs.

**`engine` (internal):**
- `POST /jobs/rescore` → loads `fact_indicator_value`, runs `score()` for every region × indicator × year, upserts `fact_gap_score`, then calls `narrative` for the latest year only (≈23 regions × ~12 scoreable indicators ≈ 275 narratives) and invalidates cache rows whose input hash changed.
- `GET /jobs/{id}` → status, for the manual trigger during setup.
- **No nightly cron.** The source data is static CSVs — a nightly job would just recompute identical numbers. Rescore runs on seed and on demand. A cron sidecar hitting `/jobs/rescore` is enough if a schedule is wanted later.

**`narrative` (internal; the only LLM touchpoint):**
- `POST /narrative` with `{gap_score, peer_values, trend_5y, action_text, data_quality_note}` → `{text, source, numbers_checked}`.
- **Provider-agnostic client:** the OpenAI-compatible chat API via `LLM_BASE_URL` + `LLM_MODEL` + `LLM_API_KEY`. Gemini, Nemotron, Gemma, or a self-hosted vLLM endpoint are then a config change, not a code change.
- **Strict template:** the model gets only the numbers and the action text, is told to use only those figures, and is limited to 2–3 sentences, ≤60 words, temperature 0.
- **Automatic number-check:** extract every number in the output and confirm each appears in the input payload (allowing formatting differences like `5.7` vs `5,7`, `%` vs `pp`). If any number fails, discard the output and store a deterministic template sentence instead (`"{region} is {abs_dev} pp {direction} the {target}% target for {indicator} in {year}, ranking {rank} of {n}."`), with `source = fallback`. The dashboard never shows an empty or unverified sentence — even with no network at all during judging.
- Store `prompt_version` with every cache row, so a prompt change invalidates exactly the right entries.

**Local and demo runtime:**
- `docker compose up` from a clean clone must bring the whole stack up, seed it, and score it with no manual steps. Test this on a second laptop before relying on it.
- Demo host: one Linux VM running the same compose file, Caddy in front of `web`/`api` for HTTPS. Deploy early, redeploy often (`git pull && docker compose up -d --build`).
- Build images for `linux/amd64` from the start, so they also run unchanged on Verda.

---

## Workstream 3 — Frontend & the dashboard redesign (owner: UX/UI designer, with dev support)

**Port, don't rewrite.** Reach Loop's three tabs, the tile-map SVG renderer, and its design tokens (Fraunces / Public Sans / IBM Plex Mono, the color system) are the starting point. Convert the vanilla-JS rendering into React components in Next.js that fetch from `api` using the generated TypeScript types. The visual language is already validated across two artifacts — don't redesign it.

**Cut line:** if the React port isn't rendering live data by the agreed checkpoint, stop and serve the existing Reach Loop HTML from a static nginx container, swapping the hardcoded arrays for `fetch()` calls against the same `api`. Same architecture, much less porting risk.

**Decision-maker tab — the three-layer card (the user's explicit brief).** The current detail card shows one number and one paragraph. Restructure it into three stacked layers, each answering a different question in under 10 seconds:

1. **The sentence.** One plain-language deduction at the top, from the narrative cache — e.g. *"Helsinki is 5.7 points below the screening target, and other Uusimaa areas sit in the same range."* This is the "words, sentences, deductions" directive. A small "how this was written" disclosure shows whether it came from the model or the template.
2. **The number, with direction.** The existing stat (74.3%, "below target by 5.7pp") stays, but as supporting evidence for the sentence, not the headline. Add the rank ("18th of 23") for context.
3. **The graph + the map, side by side.** The tile map (*where*) next to a small trend line of this region's value over 2016–2024 (*whether it's improving*), target drawn as a reference line. Use the Pathway Atlas's color tokens, type, and axis conventions so the two artifacts match visually. **Note:** a diverging bar (as used elsewhere) shows deviation at one point in time, not a trend — it's the wrong chart form for this; use a simple line/sparkline instead. Missing years render as a visible gap, never a bridged line.

Data-quality notes appear inline under the layer they affect, in plain language ("No Helsinki data for 2022–24"), never in a footnote.

Apply the same three-layer pattern to the outreach tab's row expansion, with the ecological-fallacy note written in plain words: *"These are area-level patterns. They tell you where to look, not who is affected."* Keep the patient tab as-is — it's already appropriately simple for its audience.

**Check before calling it done:** desktop and phone widths, keyboard navigation of the tile map, and color is never the only signal (severity also has a label or icon).

---

## Workstream 4 — Integration, deployment, pitch (owner: everyone, coordinated by the user)

**Schedule and cut lines** (adapt exact times to when the team actually starts, judging is Sunday 14:00):

| Milestone | Must be true |
|---|---|
| Night 1 | Repo + compose skeleton; `db` + `seed` load the CSVs; Pydantic contracts + fixture `api` up; this plan agreed |
| Day 2, midday | `score()` tested; `engine` rescore writes `fact_gap_score`; `api` serves real data; frontend renders fixtures |
| Day 2, afternoon | Frontend on live data, **or** the static-HTML fallback is triggered (Workstream 3 cut line) |
| Day 2, evening | Narratives generated for every region × indicator at the latest year; all read by a human; demo host live over HTTPS |
| Day 2, night | **Feature freeze.** Only bug fixes after this |
| Day 3 morning | Two full rehearsals on the production URL; backup screen recording saved locally |

**If time runs out, drop in this order** (last item is the first to go): outreach row-expansion three-layer pattern → separate `engine` container (merge into `api`) → live LLM (ship template sentences only). **Never cut:** live data in the decision-maker tab, data-quality notes, and the three-layer card.

**Leave-behind and pitch:**
- Keep the two existing artifacts as walkthrough material for mentor conversations — they explain the real app, they don't get replaced by it. Update Reach Loop's tech-stack table to this plan once the build starts (see note at top of this file).
- Re-verify the numbers most likely to come up in Q&A (Helsinki delay figures, the €311M Kela figure, the ecological-fallacy explanation) and make sure at least two people can defend them out loud — a mentor with an oncology background will probe the data-quality claims specifically.
- One-sentence answer ready for "why containers + FastAPI for a demo this size?": every part can be deployed, scaled, or swapped on its own — concretely, `narrative` can move to a GPU host (Verda) without touching the rest.

---

## Phase 2 (after Sunday) — Verda integration

Verda (formerly DataCrunch) is a Helsinki-founded European AI cloud:
- **Managed Serverless Containers** host customer containers with per-service endpoints (bearer-token auth) and scale-to-zero — a good fit for a low-traffic `narrative` service.
- **Self-hosted open models** via OpenAI-style APIs — a Gemma or Nemotron model served with vLLM drops in by changing `LLM_BASE_URL`/`LLM_MODEL`, no code change, because of the provider-agnostic client above. Worth saying in the pitch: this also keeps patient-adjacent health data inside an EU provider.
- **CPU instances + OCI container registry** could host the rest of the stack (`db`, `api`, `web`, `engine`) with the same images.

Suggested order: (1) push images to Verda's registry; (2) move `narrative` to a Serverless Container running an open model; (3) move the remaining services to a CPU instance running the same compose file. Confirm pricing/quotas against Verda's docs before committing — not needed for Sunday.

---

## Verification

- **Contracts:** each `api` route `curl`ed against the deployed URL and validated against its Pydantic/OpenAPI schema before the UI is wired to it.
- **Scoring:** pytest cases pass; `POST /jobs/rescore` triggered manually once, then confirm `fact_gap_score.scored_at` moved and values match the existing one-off scripts for 3 hand-picked cases.
- **Narratives:** the number-check passes for every cached narrative, and a human still reads every one at the latest year. A hallucinated number would sit right next to the chart that disproves it — this is the single most important check in the whole system.
- **Cold start:** `docker compose down -v && docker compose up` on a second machine reaches a working dashboard with no manual steps.
- **Offline resilience:** with the LLM env vars removed, the dashboard still renders, using template sentences.
- **Click-through:** all three tabs against production data, at desktop and phone widths, before the first full-team run-through.

Work on a ticket basis for features and issues.
