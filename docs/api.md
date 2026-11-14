# Reach Loop API reference

Every endpoint the stack serves: what it's for, what it reads, its inputs and outputs, its errors, and a real example. The examples are actual responses from the stack seeded with `data/processed/` (Helsinki breast screening 2024 is the running example), trimmed where marked.

- **Public** endpoints are served by `api`. They're the only ones `web` (and anyone outside the stack) can reach.
- **Internal** endpoints are served by `engine` and `narrative` on the compose network only. They publish no port; call them with `docker compose exec` (see [Internal endpoints](#internal-endpoints)).

Related: [local-development.md](local-development.md) (running and testing), [demo-host.md](demo-host.md) (the HTTPS demo host and what to show on the day).

## Quick reference

| Method and path | Service | Purpose |
|---|---|---|
| [`GET /health`](#get-health) | api | Liveness check |
| [`GET /regions`](#get-regions) | api | The 23 Regions: codes and names, for dropdowns and the tile map |
| [`GET /indicators`](#get-indicators) | api | Scoreable indicators, their Target and the years that have Gaps |
| [`GET /regions/{code}/gap-summary?indicator=&year=`](#get-regionscodegap-summary) | api | Everything the three-layer card needs for one Region, indicator and year |
| [`GET /outreach-list?indicator=&year=`](#get-outreach-list) | api | Regions short of a Target, ranked by Gap, with covariates |
| [`GET /docs`, `GET /openapi.json`](#interactive-docs-and-the-openapi-spec) | api | Swagger UI and the machine-readable contract |
| [`POST /jobs/rescore`, `GET /jobs/{id}`](#engine-rescore-jobs) | engine (internal) | Score every Gap, then fill the Narrative cache |
| [`GET /config`, `POST /narrative`](#narrative-narratives) | narrative (internal) | Turn one Gap into a checked Narrative |

## Conventions (public API)

| | |
|---|---|
| **Base URL** | Local: `http://localhost:8000`. Demo host: `https://<API_DOMAIN>` (see [demo-host.md](demo-host.md)). |
| **Methods** | `GET` only. The public API is read-only and never calls an LLM. |
| **Format** | JSON, UTF-8. Field names are `snake_case`. Numbers are JSON numbers (`80.0`, not `"80"`). |
| **Region codes** | Sotkanet codes as strings, e.g. `"90"` = City of Helsinki. Always take them from [`GET /regions`](#get-regions); don't hard-code names. |
| **Indicator codes** | Sotkanet ids as strings, e.g. `"3621"` = breast screening attendance. From [`GET /indicators`](#get-indicators). |
| **Caching** | Every successful data response sends `Cache-Control: max-age=300`. Data only changes when a rescore runs. |
| **CORS** | Only the origins in `WEB_ORIGIN` (default `http://localhost:3000`; on the demo host `https://<WEB_DOMAIN>`). |
| **Errors** | `{"detail": "<human-readable reason>"}` with status `404` (unknown code, or nothing for that year), `422` (a required query parameter is missing or the wrong type) or `503` (database unreachable; no internals are leaked). |
| **Vocabulary** | Region, Gap, Target, Severity, Narrative, Template sentence, as defined in [GLOSSARY.md](../GLOSSARY.md). |
| **Types for `web`** | `web/src/lib/api-types.ts`, generated from `/openapi.json` by `scripts/gen-api-types.sh`. Use `components["schemas"]["GapSummary"]` and so on. |

---

## Public endpoints

### `GET /health`

Liveness check for compose healthchecks and monitors. Doesn't touch the database, so it stays `200` even if Postgres is down. Use a data route to check the database.

```sh
curl -s localhost:8000/health
```
```json
{"status": "ok"}
```

### `GET /regions`

**Scope:** the 23 Regions THL reports on: 21 wellbeing services counties, the City of Helsinki and Åland. **Reads:** `dim_region`. **Inputs:** none.

**Output:** `RegionList`, sorted by `name` in byte order (the same on every database locale; Åland comes last, as in the Finnish alphabet).

| Field | Type | Meaning |
|---|---|---|
| `regions[].code` | string | Sotkanet Region code; the `{code}` in gap-summary URLs |
| `regions[].name` | string | English name, e.g. `"City of Helsinki"`, `"Central Finland wellbeing services county"` |
| `regions[].kind` | `"wellbeing_services_county"` \| `"city_of_helsinki"` \| `"aland"` | |

```sh
curl -s localhost:8000/regions
```
```json
{
  "regions": [
    {"code": "15", "name": "Central Finland wellbeing services county", "kind": "wellbeing_services_county"},
    {"code": "18", "name": "Central Ostrobothnia wellbeing services county", "kind": "wellbeing_services_county"},
    {"code": "02", "name": "Central Uusimaa wellbeing services county", "kind": "wellbeing_services_county"}
  ]
}
```
_(trimmed: 23 Regions in total)_

Find a code by name or kind:

```sh
curl -s localhost:8000/regions | jq -r '.regions[] | select(.kind == "city_of_helsinki") | .code'   # 90
```

### `GET /indicators`

**Scope:** every indicator the engine scores (12 today). Structural covariates are never scored, so they're not listed. **Reads:** `dim_indicator` and the years present in `fact_gap_score`. **Inputs:** none.

**Output:** `IndicatorList`, sorted by `code`.

| Field | Type | Meaning |
|---|---|---|
| `code` | string | Sotkanet id |
| `name` | string | English name |
| `unit` | string | Unit of `value`, e.g. `"% of invited"`, `"per 10 000 inhabitants"` |
| `higher_is_better` | bool | Direction of good. `false` for e.g. waiting times |
| `target` | number \| null | National Cancer Strategy Target. Only the three screening indicators have one (3620, 3621, 6103: 80%) |
| `years` | int[] | Years that have Gaps, ascending. Offer only these in a year picker: any other year returns 404 |

```sh
curl -s localhost:8000/indicators
```
```json
{
  "indicators": [
    {"code": "3621", "name": "Breast cancer screening attendance", "unit": "% of invited",
     "higher_is_better": true, "target": 80.0, "years": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]},
    {"code": "3336", "name": "Patients waiting over 6 months for specialised care", "unit": "per 10 000 inhabitants",
     "higher_is_better": false, "target": null, "years": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]}
  ]
}
```
_(trimmed: 12 indicators, codes 13, 2475, 3336, 3620, 3621, 3625, 3626, 3627, 5033, 5395, 5643, 6103)_

### `GET /regions/{code}/gap-summary`

**Scope:** one Region, one indicator, one year. Everything the decision-maker card needs in one round-trip: the Gap, the matched strategy action, data-quality notes, the Narrative and the sparkline series.

**Reads:** `fact_gap_score` (scored by `engine`), `fact_indicator_value` (trend), `strategy_action_indicator` + `dim_strategy_action` (action), `narrative_cache` (Narrative).

**Inputs:**

| Parameter | In | Required | Example | Notes |
|---|---|---|---|---|
| `code` | path | yes | `90` | Region code from `/regions` |
| `indicator` | query | yes | `3621` | Indicator code from `/indicators` (covariates are rejected) |
| `year` | query | yes | `2024` | One of the indicator's `years` |

**Output:** `GapSummary`.

| Field | Meaning |
|---|---|
| `region`, `indicator` | The same objects as in `/regions` and `/indicators` |
| `gap.value` | The Region's value that year, in `indicator.unit` |
| `gap.reference_kind` | `"target"` when the indicator has a Target, else `"peer_median"` (the median of the Region's peer group) |
| `gap.reference_value` | The Target, or that median |
| `gap.deviation` | `value − reference_value`, signed, in the indicator's unit (percentage points for `%` units) |
| `gap.direction` | `"below"`, `"above"` or `"at"` the reference. Whether that's good depends on `indicator.higher_is_better` |
| `gap.severity` | `"ok"`, `"watch"` or `"act"`, from fixed thresholds in `engine/app/severity_thresholds.toml` |
| `gap.rank`, `gap.n_regions` | Position among **all Regions with a value** that year; 1 = best performing |
| `gap.peer_values` | Values of the other Regions in the **same parent area** (curated peer group), not all Regions. Empty for Åland |
| `gap.trend_5y` | Change over the last five years in the indicator's unit; `null` with too little history |
| `action` | The linked National Cancer Strategy action with the lowest curated rank that has text, or `null`: `id`, `title`, `text`, `source` (with page) |
| `data_quality_notes` | `[{code, message}]` stored with the value or added by scoring (e.g. `short_history`, `no_peers`). Show them next to the number |
| `narrative` | `{text, source, language}`. `source` is `"llm"` (LLM text that passed the number-check) or `"template"` (a Template sentence). Latest-year Gaps come from the Narrative cache filled after each rescore; other years get a Template sentence built on request |
| `trend` | `[{year, value}]` up to `year`, ascending, without years that have no value. For the sparkline |

```sh
curl -s 'localhost:8000/regions/90/gap-summary?indicator=3621&year=2024'
```
```json
{
  "region": {"code": "90", "name": "City of Helsinki", "kind": "city_of_helsinki"},
  "indicator": {"code": "3621", "name": "Breast cancer screening attendance", "unit": "% of invited",
                "higher_is_better": true, "target": 80.0, "years": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]},
  "gap": {
    "region_code": "90", "indicator_code": "3621", "year": 2024,
    "value": 74.3, "reference_kind": "target", "reference_value": 80.0,
    "deviation": -5.7, "direction": "below", "severity": "act",
    "rank": 22, "n_regions": 22,
    "peer_values": [{"region_code": "01", "value": 79.8}, {"region_code": "02", "value": 80.5},
                    {"region_code": "03", "value": 76.1}, {"region_code": "04", "value": 76.7}],
    "trend_5y": 1.6
  },
  "action": {
    "id": "2.4.1",
    "title": "Legislation and register data enable high-quality, cost-effective and risk-based screening",
    "text": "Implement screening programme quality manuals comprehensively in the procurement and steering of services.",
    "source": "National Cancer Strategy 2026–2035, p. 29"
  },
  "data_quality_notes": [],
  "narrative": {
    "text": "City of Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 22 of 22.",
    "source": "template",
    "language": "en"
  },
  "trend": [{"year": 2016, "value": 74.3}, {"year": 2017, "value": 73.4}, {"year": 2018, "value": 72.5},
            {"year": 2019, "value": 73.2}, {"year": 2020, "value": 72.7}, {"year": 2021, "value": 74.5},
            {"year": 2022, "value": 73.4}, {"year": 2023, "value": 72.4}, {"year": 2024, "value": 74.3}]
}
```

`n_regions` is 22, not 23, because Åland has no 2024 value; it gets a 404 for that year. With an LLM configured on the host, `narrative.source` is `"llm"` and the text is the LLM's (see [demo-host.md](demo-host.md)).

**Errors:**

```sh
curl -s 'localhost:8000/regions/nowhere/gap-summary?indicator=3621&year=2024'   # 404 {"detail": "Unknown region code 'nowhere'"}
curl -s 'localhost:8000/regions/90/gap-summary?indicator=nope&year=2024'        # 404 {"detail": "Unknown indicator code 'nope'"}
curl -s 'localhost:8000/regions/90/gap-summary?indicator=3621&year=1900'        # 404 {"detail": "No Gap for region '90', indicator '3621' in 1900"}
curl -s 'localhost:8000/regions/91/gap-summary?indicator=3621&year=2024'        # 404 {"detail": "No Gap for region '91', indicator '3621' in 2024"}   (Åland, no value)
curl -s 'localhost:8000/regions/90/gap-summary?indicator=3621'                  # 422 (year missing)
```

### `GET /outreach-list`

**Scope:** for one indicator **with a Target** (the three screening indicators) and one year, the Regions on the wrong side of the Target (below it, or above it when lower is better), ranked by Gap size, each with every loaded structural covariate. This is the "target by covariate, not just by county" view.

**Reads:** `fact_gap_score` (rows), `fact_indicator_value` + `dim_indicator` where `pathway_stage = 'covariate'` (covariates).

**Inputs:**

| Parameter | In | Required | Example | Notes |
|---|---|---|---|---|
| `indicator` | query | yes | `3621` | Must have a Target: 3620, 3621 or 6103 |
| `year` | query | yes | `2024` | One of the indicator's `years` |

**Output:** `OutreachList`.

| Field | Meaning |
|---|---|
| `indicator`, `year` | As requested |
| `reference_kind`, `reference_value` | Always `"target"` and the Target (80.0) |
| `ecological_fallacy_note` | **Required, non-empty, and must be shown in the UI.** These are Region-level figures; a pattern across Regions can reverse among individuals |
| `rows[].region` | The Region |
| `rows[].value`, `deviation`, `severity` | As in the gap-summary's `gap` |
| `rows[].rank` | 1 = largest Gap on the wrong side of the Target |
| `rows[].covariates.immigrant_background_share_pct` | The `foreign_background_pct` value (Statistics Finland) for the list's year, or `null` when there is none (today: every list before 2024, see the coverage table below) |
| `rows[].covariates.values[]` | Every loaded covariate with a value for the Region **in the list's year**: `{code, name, unit, value, year}`, sorted by `code`. `year` always equals the list's year. A covariate with no value that year is left out, never filled from an earlier or later year |

```sh
curl -s 'localhost:8000/outreach-list?indicator=3621&year=2024'
```
```json
{
  "indicator": {"code": "3621", "name": "Breast cancer screening attendance", "unit": "% of invited",
                "higher_is_better": true, "target": 80.0, "years": [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]},
  "year": 2024,
  "reference_kind": "target",
  "reference_value": 80.0,
  "ecological_fallacy_note": "These figures describe Regions, not individuals. A pattern across Regions can differ from, or even reverse, the pattern among the people living in them (the ecological fallacy). For example, in 2024 breast screening, Regions with higher median income had lower attendance, yet within Regions women with more education attend more. Use the covariates to decide where to look, not to conclude who is affected or why. Before targeting a group, check individual-level data, such as Cancer Registry participation by country of birth or education.",
  "rows": [
    {
      "region": {"code": "90", "name": "City of Helsinki", "kind": "city_of_helsinki"},
      "value": 74.3, "deviation": -5.7, "severity": "act", "rank": 1,
      "covariates": {
        "immigrant_background_share_pct": 20.8,
        "values": [
          {"code": "2331", "name": "Population density", "unit": "inhabitants per km²", "value": 3188.7, "year": 2024},
          {"code": "3213", "name": "Kela medical travel reimbursements per inhabitant", "unit": "EUR per inhabitant", "value": 22.4, "year": 2024},
          {"code": "foreign_background_pct", "name": "People with a foreign background", "unit": "% of population", "value": 20.8, "year": 2024},
          {"code": "foreign_language_speakers_pct", "name": "Foreign-language speakers", "unit": "% of population", "value": 20.44, "year": 2024}
        ]
      }
    }
  ]
}
```
_(trimmed: 4 rows for 2024 (Helsinki −5.7, West Uusimaa −3.9, Vantaa and Kerava −3.3, East Uusimaa −0.2), and 10 covariates per row; the other Kela travel series are left out here)_

Sizes on the current data, year 2024: 3621 lists 4 Regions, 3620 lists 20, 6103 lists 22.

**Errors:**

```sh
curl -s 'localhost:8000/outreach-list?indicator=13&year=2024'      # 404 {"detail": "Indicator '13' has no Target, so it has no outreach list (only indicators with a Target do)"}
curl -s 'localhost:8000/outreach-list?indicator=nope&year=2024'    # 404 {"detail": "Unknown indicator code 'nope'"}
curl -s 'localhost:8000/outreach-list?indicator=3621&year=1900'    # 404 {"detail": "No Gaps for indicator '3621' in 1900"}
curl -s 'localhost:8000/outreach-list?indicator=foreign_background_pct&year=2024'   # 404 (covariates aren't indicators here)
```

**Same year only.** Covariates are shown only for the year the list is for. When a series has no value that year (it ends earlier, hasn't been published yet, or only one year was loaded), the covariate is left out rather than filled from another year, so every figure on a list describes the same year. Which covariates that leaves, on the current data:

| Covariate | 2016–2022 | 2023 | 2024 | Why |
|---|---|---|---|---|
| Kela medical travel (2297, 2298, 2299, 2300, 3213, 3227, 3228), population density (2331) | ✓ | ✓ | ✓ | Complete yearly series |
| Vacant health-centre physician positions (3892) | ✓ | – | – | Legacy series, ends in 2022 |
| Median disposable income, at-risk-of-poverty rate | – | ✓ | – | Only 2023 loaded; 2024 not yet published |
| Foreign background, foreign-language speakers | – | – | ✓ | Only 2024 loaded |
| Broadband (4 series) | – | – | – | Only a 2025 snapshot |
| **Covariates per row** | **9** | **10** | **10** | |

Loading the Statistics Finland series for every year will fill the gaps for foreign background, income and poverty: [#50](https://github.com/balintpragai/Junction2026/issues/50).

**How to read the covariates:** per `research/covariate_correlation_analysis.md`, the foreign-background share is the covariate that points the same way at Region and individual level. Income and poverty don't; don't present them as targeting variables.

### Interactive docs and the OpenAPI spec

- `GET /docs`: Swagger UI. Try every route from the browser.
- `GET /openapi.json`: the contract. The committed copy is `web/openapi.json`, and `api/tests/test_openapi_drift.py` fails if it falls behind the models.

---

## Internal endpoints

`engine` and `narrative` listen on port 8000 inside the compose network and publish nothing. From the host, run commands inside a container: these images have Python, not curl.

```sh
# GET from inside the container
docker compose exec narrative python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/config').read().decode())"
```

### engine: rescore jobs

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness |
| `POST /jobs/rescore` | Queue a job: score every Region × indicator × year into `fact_gap_score`, then fill the Narrative cache for the latest-year Gaps. Returns `202` and a `RescoreJob` |
| `GET /jobs/{id}` | The job's status. `404` for an unknown id (history is in memory and lost on restart) |

Jobs run one at a time. `seed` starts one after every load and waits for it. To rescore by hand and wait:

```sh
docker compose exec engine python -m app.rescore_now     # prints the finished RescoreJob; exit 0 succeeded, 2 partial, 1 failed
```

`RescoreJob` (finished, real run with unchanged inputs, trimmed):

```json
{
  "status": "succeeded",
  "gaps_written": 1933,
  "narratives_generated": 0,
  "narratives_kept": 256,
  "narratives_failed": 0,
  "narratives_removed": 0,
  "narrative_sources": {"template": 256},
  "narrative_error": null
}
```

| Field | Meaning |
|---|---|
| `status` | `queued` → `running` → `succeeded` \| `partial` (some indicators failed and kept their previous Gaps) \| `failed` (nothing changed) |
| `gaps_written`, `gaps_removed`, `indicators_scored`, `failed_indicators`, `engine_version` | Scoring results |
| `narratives_generated` | Narratives requested this run: new or changed inputs, or a new prompt version or model |
| `narratives_kept` | Cached Narratives whose inputs were unchanged (no LLM call) |
| `narratives_failed`, `narratives_removed` | Could not be generated (their outdated row is dropped) / rows no longer for a latest-year Gap |
| `narrative_sources` | Cached Narratives by `source` after the run, e.g. `{"llm": 256}` |
| `narrative_error` | Set if `narrative` couldn't be reached at all. The Gaps are still scored |

### narrative: Narratives

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness |
| `GET /config` | `{"prompt_version", "model"}`: what a request would use now. `model` is `""` without an LLM. `engine` keys its cache on both |
| `POST /narrative` | One `NarrativeRequest` → one `NarrativeResult`. Never returns an error for an LLM problem: it falls back to the Template sentence |

`POST /narrative` input (`NarrativeRequest`): `region_name`, `indicator_name`, `indicator_name_fi` (required when `language` is `"fi"`), `unit`, `gap` (a `Gap`, as in gap-summary), `action_text`, `data_quality_note` and `language` (`"en"` default; `"fi"` always returns a Template sentence).

Output (`NarrativeResult`): `text`, `source` (`"llm"` \| `"template"`), `language`, `numbers_checked` (every number in `text` was found in the request), `prompt_version`, `rejected_numbers` (numbers a discarded LLM reply invented).

Examples, from the #9 PR with the Helsinki request:

```json
// no LLM configured
{"text": "Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 21 of 23.",
 "source": "template", "language": "en", "numbers_checked": true, "prompt_version": "v1-167e86207f", "rejected_numbers": []}

// LLM configured, reply invented "6.2": rejected, Template sentence returned
{"text": "Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 21 of 23.",
 "source": "template", "language": "en", "numbers_checked": true, "prompt_version": "v1-167e86207f", "rejected_numbers": ["6.2"]}

// LLM configured, every number checked
{"text": "Helsinki's breast cancer screening attendance was 74.3% in 2024, 5.7 percentage points below the 80% national target, ranking 21 of 23 Regions.",
 "source": "llm", "language": "en", "numbers_checked": true, "prompt_version": "v1-167e86207f", "rejected_numbers": []}

// "language": "fi"
{"text": "Helsinki: rintasyöpäseulontaan osallistuminen 74,3 % vuonna 2024, 5,7 prosenttiyksikköä alle tavoitteen (80 %). Sijoitus 21/23.",
 "source": "template", "language": "fi", "numbers_checked": true, "prompt_version": "v1-167e86207f", "rejected_numbers": []}
```

(Those examples used the #9 test request, with rank 21 of 23; the live Gap is 22 of 22.)

---

## Data observations worth knowing

Found while writing this reference, from real responses. None are API bugs, but the UI or the data owners should know them.

- **`rank` and `peer_values` count different Regions.** `rank`/`n_regions` are among all Regions with a value; `peer_values` are only the parent-area peers. Don't label a peer chart "rank".
- **The matched action for breast screening** is 2.4.1 (screening quality manuals and register data). Whether that's the best first action for low attendance is a curation question (#5), not code.
- **Template sentences for some units read awkwardly**, e.g. `index (whole country = 100)`. They're correct but clunky; #20 reviews every Narrative.
- **Broadband covariates aren't on any outreach list yet.** The four `broadband_*` covariates are loaded, but only as one Traficom snapshot dated 30.9.2025, stored as year `2025`. `covariates.values` only includes a covariate's latest value at or before the list's year, and the screening Gaps end in 2024, so broadband is missing from every outreach list today. It appears on its own once a screening indicator has 2025 Gaps. There is no older snapshot to load; see the broadband entry in `data/README.md` (#48).
