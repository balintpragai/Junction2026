# Additional primary data sources: waiting times, Nordic/EU/OECD benchmarks

**Purpose:** follow-up primary-source investigation for the detection → referral → treatment-initiation pathway, focused on closing the "waiting time / access to treatment" gap identified in `research/gemini_research.md` (Goal 3, THL Guideline 21/2016) and the "not yet pulled" list in `data/README.md`. Every source below was actually accessed this session (via `curl`/WebFetch, not guessed) on 2026-11-13. Dead ends are reported as plainly as hits, per the brief.

> **Methodology note on PDFs:** several sources below are PDFs. Where WebFetch's HTML→markdown conversion failed on a PDF (it frequently did), the file was downloaded with `curl` and its text extracted locally with `pypdf`; quotes below are taken from that extracted text.

---

## 1. THL waiting-time / treatment-access data (highest priority)

### 1a. The real underlying statistic: "Hoitoonpääsy erikoissairaanhoidossa" (Access to specialised health care)

- **Source page (EN):** https://thl.fi/en/data-and-statistics/access-to-treatment/access-to-services-in-specialised-health-care — accessed via WebFetch.
- **Sotkanet indicator metadata** (ground truth, pulled directly via `curl -A "Mozilla/5.0" https://sotkanet.fi/rest/1.1/indicators/<id>`), all sourced to the same underlying THL register ("Erikoissairaanhoidon hoitoonpääsy (THL)"):

| Sotkanet ID | Title (EN) | Years | Region granularity |
|---|---|---|---|
| **13** | Referrals for specialised health care received processed within 3 days, % of referrals received | 2014–2025 | Wellbeing services county, hospital district, whole country |
| **5033** | Referrals for specialised health care received after processing for more than 21 days, % of referrals received | 2014–2025 | Wellbeing services county, hospital district, whole country |
| **3336** | Patients waiting over 6 months during the year for access to specialised health care per 10,000 inhabitants | 2014–2025 | Wellbeing services county, whole country |
| **5083** | Wait time for patients awaiting specialised health care as of 31 Dec, median | 2017–2022 only | Hospital district (**discontinued** — see limits below) |

These are **not in the team's existing `data/processed/` pull** (which only grabbed cancer-/screening-specific indicators under the "syö" keyword filter). They are general-specialised-care indicators, not cancer-specific, but they are exactly the family of measures THL Guideline 21/2016 (the strategy's own named Goal-3 monitoring mechanism) is built on, and they're already in `data/raw/sotkanet_all_indicators.json` waiting to be pulled — same API, same `years=` pagination quirk already documented in `data/README.md`.
- **Legal basis quoted directly from the Sotkanet EN description (indicator 13):** *"According to the Health Care Act (2010/1326/52§ - 53§), the assessment of the need for treatment in non-urgent care must begin within three weeks of the referral arriving at the hospital..."*
- **Known data gap, quoted from indicator 3336's `limits` field:** *"The City of Helsinki's data on access to specialized medical care is missing from May 2021, due to challenges in the patient information system. Data transmission has resumed at the beginning of 2025..."* — i.e., Helsinki (one of the two counties flagged in the team's existing screening-attendance finding) has a known multi-year hole in exactly this indicator.
- **Indicator 5083 (median wait, hospital-district level) is explicitly discontinued**, per its own `limits` field: *"The indicator is not currently being updated because the data is reported at the welfare area level and median data is not currently available comprehensively at the wellbeing services county level."* Useful to know before citing it as current.
- **No cancer-specific (oncology/syöpätaudit) specialty breakdown exists in these four Sotkanet indicators** — they are specialty-aggregated at this level.

### 1b. Finer-grained source: THL's own statistical reports (Tilastoraportti) and Sampo cube system

- **Annual statistical report, found via WebSearch and partially extracted:** *"Hoitoonpääsy erikoissairaanhoidossa 2024: Vuonna 2024 erikoissairaanhoidon hoitoon pääsyssä oli merkittäviä haasteita"* (Tilastoraportti 19/2025, published 2025-04-16). Julkari item page: https://www.julkari.fi/items/1bb2b393-1cfc-438a-8cfc-481bd9d80831 (confirmed accessible, gave title/date). Headline figures surfaced via search snippet: share waiting >6 months rose from 15.5% (start of 2024) to 17.0% (year end); Kymenlaakso reduced its long-wait queue most (−14.8%).
  - **Access restriction found:** the actual PDF bitstream (`julkari.fi/bitstreams/0567a669-1ce8-4a27-8f5d-f1f17106bc7a/download` and the older `julkari.fi/bitstream/handle/...` form) returned an **HTML admin-login page** to every automated fetch attempt (plain `curl`, `curl` with browser UA + referer + cookie jar, and WebFetch) — confirmed 4 separate ways. Julkari's bitstream download appears to require a real browser session; **it is not scriptable** the way the item/search metadata is. A human with a browser can almost certainly just click through and download it — this is a tooling limitation, not an access-restriction/paywall.
  - The 2025-data edition ("Access to Specialist Health Care 2025," Tilastoraportti 21/2026, published 2026-06-03) exists per THL's EN page but wasn't individually fetched.
- **THL's interactive cube system (Sampo):** https://sampo.thl.fi/pivot/prod/fi/thil (confirmed live, fetched raw HTML). This hosts the actual monthly database reports. Of particular interest: **`eshjono`** cube group — "Toimenpidettä odottavat ja odotusajat jonoryhmittäin" (patients awaiting a procedure and wait times, by queue group), with a wellbeing-county comparison view at https://sampo.thl.fi/pivot/prod/fi/eshjono/jonoryhma/summary_jonoryhma2 (found via WebSearch, fetched directly — 200 OK, 61 filter options extracted).
  - **This cube is monitored, procedure-level, by-county, with explicit metrics** (extracted directly from the page's `<option>` list): days-waiting buckets ("1–90 vrk", "91–180 vrk", "yli 90 vrk, %", "yli 180 vrk, %") for **~45 named elective-procedure queue groups** (cataract surgery, hip/knee replacement, hysterectomy, tonsillectomy, etc.) across all 19 wellbeing-county-equivalent regions it tracks.
  - **Checked specifically for cancer-specific procedures and found none.** The two closest-sounding entries — "Eturauhasen liikakasvun toimenpide" and "Rintarauhasen pienennys- tai muovausleikkaus" — translate to **benign prostatic hyperplasia (BPH) treatment** and **cosmetic breast reduction/reshaping surgery**, not prostate- or breast-cancer surgery. This is a real near-miss worth flagging so nobody on the team mistakes these for cancer indicators later. **Conclusion: THL's open elective-queue cube system does not break out cancer surgery as its own monitored queue group** — cancer surgery is presumably fast-tracked outside the standard elective-queue monitoring, consistent with the strategy PDF's own admission (quoted in `gemini_research.md`) that no cancer care quality register yet exists in Finland.
  - This cube was reachable and rendered usable HTML via plain `curl`; it looks pullable with the same scraping approach already used for Sotkanet, just via HTML-table scraping instead of a clean REST endpoint (no JSON API was found for Sampo/PX cubes in this session).

### Bottom line for item 1
The best **immediately pullable, API-accessible, wellbeing-county-level, Goal-3-aligned** waiting-time data is **Sotkanet indicators 13, 5033, and 3336** (general specialised-care referral-processing and 6-month-plus wait prevalence) — same API, same access pattern the team already uses. There is **no cancer-specific waiting-time indicator** at Sotkanet or in THL's open procedure-queue cubes; the closest Finland gets to a quantified cancer-treatment-timeliness *target* (not performance data) is the OECD figure in §5 below.

---

## 2. NORDCAN 2.0

- **URL actually loaded:** https://nordcan.iarc.who.int/en (note: `nordcan.iarc.fr` 301-redirects to this `.who.int` domain — both resolve to the same live site). Confirmed via raw HTML fetch (`curl`), which revealed the page is a JS single-page app (Vue/Vite bundle); WebFetch's markdown conversion returned only the page `<title>` and meta description on repeated attempts, so the SPA shell itself carries no readable content without executing JS.
- **Backend API discovered directly in the page's inline `<script>` config** (not guessed — read verbatim from the HTML source):
  ```
  window.__CANVIZ_ENV__={"api_host":"https://canapi.iarc.who.int/","api_url":"https://canapi.iarc.who.int/api/nordcan/v2/[vdb]/","default_db":"961", ...}
  ```
  i.e., there **is** a real backend REST API (`canapi.iarc.who.int`) powering the dataviz tool. However, directly probing it (`/api/nordcan/v2/961/`, `/api/nordcan/v2/961/metadata`, `/api/nordcan/v2/961/cancers`, bare `/api/nordcan/v2/`) returned **`{"detail":"Not Found"}` (404)** for every path guessed — the real endpoint structure (likely requiring specific query parameters for population/cancer/sex/year selections) isn't published anywhere discoverable in this session, and there is no public API documentation page linked from the site.
- **Officially documented access method, per NORDCAN's own citation guidance** (found via WebSearch of IARC/NORDCAN documentation and the "About" page): tables can be **exported to a text file or PDF** from within the visualization tool, and charts can be saved as PNG — i.e., **per-view manual export only**, not a bulk download or public API. Standard citation format given: *"Available from: https://nordcan.iarc.fr/, accessed on day/month/year."* The Nordic Cancer Union (NCU) is credited as funder; data "freely available" but not bulk-downloadable.
- **Database version confirmed:** v9.6, released June 2026, data through 2024, covering all Nordic countries including Finland (per WebSearch of the `/en/database` page title).
- **Processing pipeline is open source** but is the registries' *input* pipeline, not a public data API: `nordcan.R`, an R/Stata tool used by Nordic cancer registries to prepare aggregate submissions to IARC — https://github.com/CancerRegistryOfNorway/NORDCAN/tree/master/releases (found via WebSearch, not independently verified by opening the repo this session).
- **Finland/regional granularity:** the tool is explicitly cross-*country* (Nordic comparison), not sub-national within Finland. No indication found of within-Finland regional breakdown.

**Verdict: dead end for programmatic bulk pulling.** NORDCAN has Finland data and is useful for the "reach Nordic levels" Goal-3 narrative, but the only practical path is manual screenshot/per-table export from the live tool, exactly as the team's own `gemini_research.md` already flagged it ("not yet pulled... needed for the 'reach Nordic levels' Goal 3 benchmark").

---

## 3. Kela open data — medicine reimbursement entitlements

- **URL actually loaded and confirmed live (200 OK):** https://avoindata.suomi.fi/data/fi/dataset/voimassa-olleet-alkaneet-ja-paattyneet-laakekorvausoikeudet (the `vip.avoindata.fi` URL given in the task brief no longer resolves — DNS failure; the dataset has moved to the `avoindata.suomi.fi` domain, confirmed by following redirects from `www.avoindata.fi`).
- **This is a genuine, bulk-downloadable, directly fetched dataset** — not just a landing page. Resource link scraped from the page HTML and downloaded directly:
  `https://avoindata.suomi.fi/data/dataset/70832958-f7b6-4e09-8350-615362e6ee30/resource/cc74cc46-2b92-42b5-9a52-55adb3df512f/download/data.csv`
  (redirects to a presigned S3 URL — refetch the stable link above each time rather than caching the signed URL, which expires). Also offers a `package.json` resource (Frictionless/CKAN data-package descriptor) at the sibling resource ID.
- **Downloaded and inspected directly (181 MB, ~1.73M rows).** Confirmed columns: `aikatyyppi, vuosi, hyvinvointialue_nro, hyvinvointialue_nimi, ikaryhma, sukupuoli, korvausoikeus_koodi, korvausoikeus_selite, alkanut_lkm, kokovuosi_lkm, kuolema_lkm, voimassaolleet_lkm, vuodenlopussa_lkm`.
  - **Geographic granularity: all 23 wellbeing services counties by name** (`Helsinki`, `Vantaa ja Kerava`, `Länsi-Uusimaa`, etc.) — same geography the team's existing CSVs use — **and this coding has been applied retroactively back to 1986**, confirmed by inspecting rows from 1990, 2000, 2010, etc.
  - **Time granularity: annual only** (`aikatyyppi` column's only observed value is `"Vuosi"` — no monthly/quarterly breakdown). Data spans **1986–2025**.
  - **Also broken down by 5-year age band and sex** — finer than the Sotkanet 5395 indicator the team already has (which is just a single % of population, no age/sex split).
  - **Cancer-specific reimbursement codes confirmed present** by grepping the file directly:
    - `115 Rintasyöpä` (breast cancer)
    - `116 Eturauhassyöpä` (prostate cancer)
    - `130 Pahanlaatuinen kasvain` (malignant tumour, general — the broader special-reimbursement category)
  - The `alkanut_lkm` column (**new entitlements started in the statistical year**) is a genuine, finer-grained **treatment-initiation proxy** than the existing `5395_special_refund_cancer_medicines_pct_pop` indicator: it is a *flow* (new starts per county/year/age-band/sex, split by specific cancer type) rather than just a prevalence *stock* (% currently entitled, all cancer types combined).
  - **Important caveat to carry into any analysis:** this measures "started a medicine-reimbursement entitlement," which happens once a clinician applies for the special-reimbursement status — a reasonable proxy for *entering medicine-funded treatment*, but it is **not a day-level time-to-treatment metric** (no referral or diagnosis date fields exist in this dataset to compute a wait/lag against). It complements, but cannot replace, the THL hoitoonpääsy indicators in §1.
- **License, confirmed directly from the page HTML:** Creative Commons Attribution 4.0 International (CC BY 4.0). **Update frequency, confirmed directly from the page HTML:** annual, "tavallisesti helmikuun 20. päivään mennessä" (usually by 20 February). **No login or cost** — fully open.

**Verdict: strong hit.** This is bulk-downloadable, CC BY 4.0, wellbeing-county + age + sex granular back to 1986, and contains breast-/prostate-cancer-specific and general-malignant-tumour reimbursement-start counts not currently in the team's pulled data.

---

## 4. EU Cancer Inequalities Registry (ECIR)

- **Actual URL (European Commission Joint Research Centre):** https://cancer-inequalities.jrc.ec.europa.eu/ — fetched directly.
- **Confirmed interactive data tool** with eight inequality-dimension views, each a distinct URL path found on the homepage: `/data-tool-by-country`, `/data-tool-by-sex`, `/data-tool-by-education`, `/data-tool-by-income`, `/data-tool-by-urbanisation`, `/data-tool-by-age`, `/data-tool-by-disability`, `/data-tool-by-labour`.
- **A dedicated regional view exists:** `/regional-disparities` — fetched directly. Confirmed to cover **cancer mortality only** (not screening, incidence, survival, or waiting times) for: all cancers combined, breast, cervical, colorectal, liver, lung, prostate, and stomach cancer, at **NUTS2** granularity. The fetched page's visible example call-outs named France, Germany, and Romania; **Finland was not explicitly named in the content retrieved**, so Finland's presence in this specific regional tool could not be confirmed one way or the other this session — worth a direct manual check of `/regional-disparities` with Finland selected before relying on it.
- **No bulk CSV/API found** on any ECIR page reached — it reads as a view-only dashboard plus a biennial PDF "Country Cancer Profile" series.
- **The Finland Country Cancer Profile 2025 PDF was downloaded and read in full** (28 pages, via `pypdf` after WebFetch failed to parse the PDF's raw bytes): https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/02/eu-country-cancer-profile-finland-2025_1e1aebcf/1b14100d-en.pdf
  - Co-published by OECD and the European Commission; **cite as**: *OECD/European Commission (2025), EU Country Cancer Profile: Finland 2025, OECD Publishing, Paris, https://doi.org/10.1787/1b14100d-en* — confirmed from the PDF's own back-cover citation text. **License: CC BY 4.0** (confirmed from the PDF's own back page).
  - **Does contain genuine within-Finland regional figures**, sourced onward to the Finnish Cancer Registry, e.g. (quoted/paraphrased directly from the extracted text): *"the incidence rate (adjusted for the Finnish population in 2014) was 738 per 100,000 women and 824 per 100,000 men in the Åland Islands, which is over 60% higher than the lowest rate among women (in South Savo county) and almost 30% higher than the lowest rate among men (in North Savo county)"* (2022 data); and on screening: *"the lowest age-standardised participation rate was in Uusimaa – particularly in Helsinki (73%) ... The highest participation rate was in the Åland Islands (86%), and eight well-being services counties achieved at least 85% participation"* (2017–2021 breast-screening data).
  - On cancer-care-performance/accessibility (Section 5.1), confirmed direct quote: *"In Finland, barriers to cancer care may exist among people with lower incomes because of the upfront payment required for many cancer care services"* — with specific copayment figures (health-centre visit capped at EUR 23, annual payment ceiling EUR 762 in 2024, medicine deductible EUR 50 + annual cap EUR 626.94).
  - This PDF is a **prose report, not a queryable dataset** — the regional figures above are individual numbers quoted in text/figures, not an exportable table.

**Verdict:** ECIR's live dashboard is view-only and its Finland sub-national coverage is unconfirmed; but the **Country Cancer Profile 2025 PDF itself is a legitimate, CC-BY-licensed primary source** with several citable Finland-regional data points (screening participation by county, incidence by county) that are not in the team's current Sotkanet pull and that come with proper international framing (EU27 comparison).

---

## 5. OECD cancer-specific indicators for Finland

### 5a. OECD/EU Country Cancer Profile — see §4 (co-published, same PDF).

### 5b. OECD Health Working Paper No. 188, "Assessing Cancer Care Quality in OECD Countries" (2025)
- **URL, downloaded and read via `pypdf` (73 pages):** https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/12/assessing-cancer-care-quality-in-oecd-countries_56dc9c26/b3f47ece-en.pdf
- **This is the actual primary source for the "Finland has a 6-week cancer-treatment waiting-time target" claim** that the initial WebSearch surfaced — found and quoted directly from **Table 2.2, "Examples of monitoring or targets for timeliness of cancer treatment initiation"**:
  > `Finland | Suspected cancer case | Breast cancer | Start of primary treatment (6 weeks)`
  > `Finland | Decision to treat | — | Time to first cancer treatment (31 days)`

  The table's own source line reads: *"Source: OECD's Waiting Times for Health Services, 2020; Ontario Cancer System Performance...; Canadian Institute for Health Information; (Vrijens et al., 2016); (Leroy et al., 2023)"* — i.e., the Finland figures trace back one more hop to the **2020 OECD report** in §5c below, not to a Finnish primary legal/THL source directly cited in this paper.
  - **Important distinction:** these are *policy targets/definitions*, not reported performance-against-target data for Finland — this paper does not give Finland's actual measured compliance rate against the 6-week/31-day targets.

### 5c. OECD Health Policy Studies, "Waiting Times for Health Services: Next in Line" (2020)
- **URL, downloaded (not fully mined for Finland performance numbers due to time; confirmed accessible, 2.1 MB PDF):** https://www.oecd.org/content/dam/oecd/en/publications/reports/2020/05/waiting-times-for-health-services_9d746179/242e3c8c-en.pdf
- This is the report table 2.2 in §5b cites as its source for Finland's targets; worth a deeper read by the team if the 6-week/31-day target numbers are used in the submission, to find Finland's original legal citation.

### 5d. OECD Data Explorer / OECD.Stat — "Waiting times for selected elective surgeries"
- **Confirmed live, queryable dataset** (found via WebSearch, definitions PDF downloaded and read): OECD Data Explorer URL pattern `https://data-explorer.oecd.org/vis?df[ds]=DisseminateFinalDMZ&df[id]=DSD_HEALTH_PROC@DF_KEY_INDIC&df[ag]=OECD.ELS.HD` (dataset family: Healthcare utilisation / `HEALTH_PROC`).
- **Definitions/sources PDF downloaded and read directly:** https://webfs-els.oecd.org/files/Health-Statistics/HEALTH_PROC_Healthcare-Utilisation/8_Waiting-times-for-selected-elective-surgeries.pdf (OECD Health Statistics 2026 edition, 32 pages).
- **Tracks exactly 7 procedures**, confirmed from the extracted definitions text: cataract surgery, PTCA, coronary bypass, **prostatectomy**, hysterectomy, hip replacement, knee replacement. Three metrics each: mean/median wait (days) from specialist assessment to treatment, and % waiting over 3 months.
- **Finland is confirmed as a reporting country**, with its own "Sources and Methods" entry quoted directly from the PDF:
  > *"Finland — Source: Finnish Institute for Health and Welfare (THL), Care Register. Methodology: Nomesco Classification for Surgical Procedures (NCSP codes)... Prostatectomy: KEC, KED, LCC, LCD, LEF... Further information: On 1st March 2005, Finland adopted new legislation stating maximum waiting times for health care services... three or six months for surgery. If the regions (central hospital districts) exceed the maximum waiting times, the national supervising authority VALVIRA may fine the regions."*
- **Caveat: prostatectomy is not cancer-specific** — the NCSP codes listed (KEC, KED, LCC, LCD, LEF) cover prostatectomy generally, which includes both benign (BPH) and malignant (prostate cancer) indications; the dataset does not separate them. It is the single closest OECD cross-country-comparable *surgical* wait-time series that touches oncology, but it is an imperfect proxy, and granularity is **national only** (no Finnish sub-national breakdown visible in the definitions doc).
- **This dataset was not itself queried for actual Finland numeric values this session** (time-boxed) — only its existence, coverage, and Finland's participation were confirmed. The team should query the Data Explorer URL directly (it supports CSV/SDMX export) for the actual prostatectomy wait-time series if this angle is pursued.

**Verdict for item 5:** OECD is a strong secondary-hop source for Finland's cancer-care-timeliness *policy targets* (fully sourced above) and offers one genuinely downloadable, if imperfect (prostatectomy, not cancer-specific), cross-country wait-time series. The EU/OECD Country Cancer Profile (§4) remains the richest prose source for Finland-specific figures.

---

## 6. Other primary sources found along the way

- **Finnish Cancer Registry's own statistics app** (https://syoparekisteri.fi/tilastot/) — **confirmed dead end for automated access**: every fetch attempt (WebFetch, and `curl` with a full browser user-agent) returned an **HTTP 403 with a Cloudflare "Just a moment..." bot-challenge page** (`cf-mitigated` / Turnstile challenge visible in the response). This matches the team's own prior suspicion in `gemini_research.md` ("likely an interactive app, not a bulk download; may need manual export") — confirmed now as **actively bot-blocked**, not just inconvenient; a human browser visit is needed, scripted access is not realistically possible.
- **THL "Laaturaportti" (quality report) on access to specialised care** — found via WebSearch: https://thl.fi/data-ja-tilastot/tiedon-laatu/tilastojen-laaturaportit/laaturaportti-hoitoonpaasy-erikoissairaanhoidossa — not fetched this session (time-boxed), but flagged as a quick follow-up: THL's own quality/methodology self-assessment of exactly the §1 data, useful for an honest "known data-quality limitations" slide.
- **Kela's dataset page itself links a `package.json`** (CKAN/Frictionless data-package descriptor) alongside the CSV — a small, structured metadata file worth grabbing alongside the CSV for provenance/schema documentation, found at the sibling resource ID on the same dataset page as §3.

---

## Top-line recommendation: where to spend remaining pull time

1. **Sotkanet indicators 13, 5033, and 3336** (§1a) — zero new infrastructure needed, same API/script the team already has working for the existing 9 indicators, same wellbeing-county geography, directly tied to THL Guideline 21/2016 (the strategy's own named Goal-3 monitoring mechanism). This is the single highest-value, lowest-effort pull and should be done first.
2. **Kela medicine-reimbursement CSV, filtered to codes 115/116/130** (§3) — already fully downloaded and verified this session (181 MB → trivially filterable to ~a few thousand cancer-relevant rows). Gives a 40-year, county + age + sex breakdown of new cancer-medicine-reimbursement starts that is strictly more granular than the team's existing `5395` indicator, and is the closest thing in this entire investigation to a genuine "time-to-treatment-initiation proxy by region," despite being annual (not day-level).
3. **The EU/OECD Country Cancer Profile Finland 2025 PDF** (§4/§5a) — already fully read this session; worth lifting 3-4 of its sourced, specific figures directly into the deck (Åland-vs-South/North-Savo incidence gap; Helsinki-vs-Åland screening gap; the EUR 23/EUR 762/EUR 626.94 copayment-barrier figures) since it is CC-BY, OECD/EC co-authored, and explicitly Finland-focused — strong "data quality & transparency" citation value for comparatively little additional pulling effort (it's prose, not an API, but the numbers are already extracted above).

**Confirmed dead ends, not worth further time:** NORDCAN bulk export (view/manual-export only, no working public API despite one existing internally), the Finnish Cancer Registry's own stats app (Cloudflare-blocked), and Julkari's PDF bitstream downloads (session/login-walled against all scripted access tried).
