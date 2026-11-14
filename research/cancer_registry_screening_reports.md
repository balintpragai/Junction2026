# Finnish Cancer Registry: annual screening programme statistics

**Source:** Finnish Cancer Registry, `cancerregistry.fi/statistics/screening-statistics/`, which links to three standalone annual statistics reports hosted at `stats.cancerregistry.fi`:
- Breast: http://stats.cancerregistry.fi/joukkistilastot/breast.html
- Cervical: http://stats.cancerregistry.fi/joukkistilastot/cervix.html
- Colorectal: http://stats.cancerregistry.fi/joukkistilastot/colorectal.html

**This is a different, non-blocked access point** from `syoparekisteri.fi/tilastot/` (the Finnish-language interactive app confirmed Cloudflare-blocked in `additional_data_sources.md` §6). These are large (7–10MB) self-contained R-flexdashboard exports, loaded fine with plain `curl`.

Two kinds of content inside:
1. **A handful of genuinely interactive Plotly charts** (4–5 per report) — the embedded JSON carries exact numeric arrays, not pixels. These were parsed programmatically — real data, not chart-reading.
2. **The rest (30–80 charts per report) are static PNGs**, base64-embedded directly in the HTML, with no accompanying data table found anywhere (checked the "Details → Data" section specifically — it's methodology notes, not a download). These were decoded and read visually. Treat their numbers as good approximations (described as "~X"), not exact to the decimal.

All extracted images are in `data/raw/cancerregistry_screening_reports/`; exact-number CSVs are in `data/processed/cancerregistry/`.

## 1. Exact data: national participation & positivity rate, by age, over time

Pulled directly from embedded Plotly JSON — no chart-reading involved. Six CSVs in `data/processed/cancerregistry/`:

| File | Years | Age groups |
|---|---|---|
| `breast_national_participation_rate_by_age.csv` / `..._positivity_rate_by_age.csv` | 2010–2024 | 50, 52, …, 68, Total |
| `cervix_national_participation_rate_by_age.csv` / `..._positivity_rate_by_age.csv` | **1991–2024** | 30, 35, …, 65, Total |
| `colorectal_national_participation_rate_by_age.csv` / `..._positivity_rate_by_age.csv` | 2022–2024 only | 60, 62, …, 70, Total |

Note the very different program ages this confirms: cervical screening has 34 years of history in Finland; colorectal only 3 — consistent with colorectal being the newest of the three programmes. Breast participation nationally sits ~80–86% across the period; positivity (recall) rate ~2–7%, both by age band.

## 2. Visually-read data: delays from positive screen to diagnostic workup, by wellbeing county

The single most valuable find — a **cancer-specific, regionally-resolved diagnostic-delay metric** that `additional_data_sources.md` §1 concluded didn't exist anywhere. All three programmes publish it.

**Breast** (`breast_delays_to_diagnostics_{2023,2024}.png`) — delay to *diagnostic examinations*, in months:
- National median ~0.5–0.57 months (≈15–17 days).
- **City of Helsinki is the worst county in both years**: ~1.2 months (≈36 days), roughly **2× the national median, persistently** across both years. 90th-percentile tail reaches ~1.9 months.
- North Ostrobothnia also elevated (~0.8 months both years) — notable because it's the county with the *highest* breast-screening attendance in our THL data (85.6%) — high uptake clearly doesn't guarantee fast follow-through.
- Fastest: Päijät-Häme, South Karelia, Ostrobothnia, Kainuu, South Ostrobothnia (~0.2–0.25 months).

**Cervical** (`cervix_delays_to_colposcopy_2024.png`) — delay to *colposcopy*, in months, split by **age-group screening** vs. **risk-group screening** (Finland runs both pathways):
- National median ~3.5–4 months (age-group) / ~6 months (risk-group) — a much longer and more variable delay than breast.
- **Helsinki again among the worst**: ~7.7 months (age-group), ~6.5–7 months (risk-group).
- **North Savo and South Savo are the fastest here** (~0.7–1 month) — the opposite of their colorectal ranking below. The "worst/best county" is not a fixed property of a county; it depends on which pathway.

**Colorectal** (`colorectal_delays_to_colonoscopy_2024.png`) — delay to *colonoscopy*, in months:
- National median ~1.9 months — longest baseline delay of the three (colonoscopy capacity is the scarcest resource).
- **Worst here: North Savo and Päijät-Häme (~3.7 months), Vantaa & Kerava (~3.6)** — Helsinki is only moderately bad here (~3.4), not the outlier it is for breast/cervical.
- Fastest: Central Uusimaa (~0.85), South Savo and Southwest Finland (~1.0).

**Reusable finding for the pitch:** Helsinki is bad-to-worst in 2 of 3 programmes (breast, cervical) but only middling in the third (colorectal); North Savo swings from fastest (cervical) to worst (colorectal). A credible gap-finder has to report *per cancer type*, not produce one "worst county" league table — real pathway performance doesn't collapse into a single ranking.

## 2b. Correction: the breast report's county/native-language/region-of-birth breakdowns are exact tables, not charts

**Found 2026-11-14, re-examining `breast.html` directly.** Each report's "Screening process" sections (tabs: Wellbeing services counties / Native language / Region of birth) render as real server-side `kableExtra` HTML `<table>`s with exact N and % columns (Invited → Attended → Invited to diagnostic examinations → Referred to specialized healthcare), not base64 images — they were missed in the first pass because the extraction then only targeted the embedded Plotly JSON and the base64 PNGs, not plain HTML tables. **Only the "Delays in access to diagnostic examinations" section remains image-only** (confirmed again directly: no table, only a base64 PNG, for every year checked) — the month-long delay figures in §2 below are still chart-read and still need the "read from Cancer Registry charts" attribution from ADR 0001. The funnel/equity tables do not carry a delay-in-months figure; they're a different, complementary metric.

Three new exact CSVs pulled from this, for breast cancer, all years available in the report (`data/processed/cancerregistry/`):
- `breast_wellbeing_county_funnel_2020_2024.csv` — all 23 counties (Åland only present where it reported a result that year), 2020–2024. Helsinki 2024: 38,630 invited → 28,686 attended (**74.3%**, exact match to THL Sotkanet 3621 — good cross-validation) → 1,001 invited to diagnostics (3.5% of attendees) → 243 referred to specialized care (24.3% of those examined).
- `breast_native_language_funnel_2020_2024.csv` — Domestic vs. Other/missing, 2020–2024. 2024: Domestic **83.2%** vs. Other/missing **60.8%** attendance — supersedes the "~83–85% vs. 59–63%" chart-read range in §3 below with an exact figure, for breast specifically.
- `breast_region_of_birth_funnel_2020_2024.csv` — 7 regions (Finland, Europe excl. Finland, Asia, Americas, Africa, Oceania, Unknown), 2020–2024. 2024: Finland **83.1%**, Africa **45.1%**. Africa is the lowest group in every year 2020–2024 (42.8%, 48.1%, 44.9%, 41.5%, 45.1%), 35–41 points below Finland-born women. These figures supersede the "~82–85% vs. ~28–53%" chart-read range in §3 below for breast specifically. *(Extended 2026-11-14 in #39: the first extraction covered only 2022–2024. The 2020 and 2021 rows were added by `scripts/extract_cancerregistry_funnels.py`; the 2022–2024 rows are unchanged, and the new years' Total rows match the native-language and county files.)* The cervical and colorectal equivalents are in §2c.

## 2c. Cervical and colorectal: the same exact tables (extracted 2026-11-14, #39)

**Where the tables are, precisely** (true for all three reports): the native-language and region-of-birth tables are under **Population groups → Native language / Region of birth**, one tab per year. The county table is under **Wellbeing services counties → Screening process**. Only the county breakdown sits under a "Screening process" heading.

All funnel CSVs are generated by `scripts/extract_cancerregistry_funnels.py` (standard-library Python). It checks each table's header against the expected funnel stages, and checks every printed % against N ÷ denominator (no mismatches in any of the three reports). Run on `breast.html`, it reproduces the three committed breast CSVs byte-for-byte.

**Cervical** — `cervix_{wellbeing_county,native_language,region_of_birth}_funnel_2020_2024.csv`. Funnel stages: Invited → Attended → Follow-up recommendation → Referral to colposcopy → Attended colposcopy → Histological HSIL or worse.
- **`screening_group` column:** the county tables come in two per year, *Age group screening* and *Risk group screening*. The population-group tables combine both (*Age and risk group screening*). Example for 2024: county totals of 280,812 + 11,298 invited = 292,110, the population-group total. Match the group before comparing a county row with a native-language row.
- **Native language, 2024:** Domestic **76.2%** vs. Other/missing **56.3%** attendance. Over 2020–2024: Domestic 72.2–76.2%, Other/missing 56.3–58.8%.
- **Region of birth, 2024:** Finland **76.0%**, Africa **49.0%**. Africa is the lowest group in every year 2021–2024 (45.8–49.0%). In 2020, Oceania was lower (41.2%, from only 80 invited).
- **Counties, 2024 (age-group screening):** lowest North Karelia 67.8%, highest South Savo 82.2%, Helsinki 71.7%.
- **Source anomaly, copied as published:** in 2024, Southwest Finland shows **4 of 190** referred women attending colposcopy (2.1%) in age-group screening and **1 of 320** (0.3%) in risk-group screening. Its 2023 risk-group figure is 110 of 451 (24.4%). In 2024 the other mainland counties range from 73–98% (age-group screening) and 62–100% (risk-group screening). This looks like incomplete colposcopy recording for that county, not real non-attendance. Don't use Southwest Finland's colposcopy and HSIL+ columns for those years without this caveat.

**Colorectal** — `colorectal_{wellbeing_county,native_language,region_of_birth}_funnel_2022_2024.csv`. Funnel stages: Picked → Attended → Test positives → Attended colonoscopy → Surgical/neoadjuvant treatment.
- The first stage is **`picked_n`**, the report's own term for people drawn into the screening round. It is kept under that name rather than relabelled as `invited_n`.
- Only 2022–2024 are available, since the programme started in 2022. The county table has 22 rows; Åland isn't in it.
- **Native language** has an extra **`sex`** column: Men, Women and Total within each language group.
- **Native language, 2024:** Domestic **74.5%** vs. Other/missing **53.4%**. By sex, Other/missing men are lowest at **47.2%**; Domestic women are highest at 78.7%.
- **Region of birth, 2024:** Finland **74.5%**, Africa **40.5%**. Africa is the lowest group every year (2022: 42.0%, 2023: 44.0%, 2024: 40.5%).
- **Counties, 2024:** lowest **City of Helsinki 69.6%**, highest South Savo 76.9%.

**Against the chart-read ranges in §3:** every exact attendance figure falls inside its §3 range, with one marginal exception. Colorectal **2022** Domestic and Finland-born attendance are both **78.2%**, just above the "~70–78%" upper bound. §3 doesn't record which year its charts showed; the 2024 exact figures (74.5% for both) are inside the range.

## 3. Visually-read data: participation by equity dimension, all three cancer types

Consistent methodology across all three reports (own equity breakdowns, by 2-year/5-year age band):

| Dimension | Breast (ages 50–68) | Cervical (ages 30–65) | Colorectal (ages 60–70) |
|---|---|---|---|
| **Education** (primary → tertiary) | ~56–72% → 85–89% (~20–25pp gap) | ~40–61% → 77–82% (~20–30pp gap) | ~47–66%(men)/55–72%(women) → 71–82%/79–85% (~20–24pp gap, within each sex) |
| **Domestic vs. other/missing nativity** ✱ | 83–85% vs. 59–63% (~23pp) | 71–79% vs. 46–63% (~15–25pp) | 70–78% vs. 50–57% (~15–20pp) |
| **Region of birth** ✱ | Finland ~82–85%; **Africa ~28–53% (worst, widens with age)** | Finland ~71–79%; Africa ~42–57% (worst at most ages) | Finland ~70–78%; **Africa ~39–44% (worst, widens with age)** |
| Other region-of-birth groups ✱ | Europe excl. Finland 62–70%, Americas 59–67%, Asia 57–64% | Europe 53–68%, Asia 41–66%, Americas 47–67% | Europe 53–62%, Asia 53–59%, Americas 49–61% |

✱ **Exact per-year totals now exist for these rows, for all three cancer types** (breast §2b, cervical and colorectal §2c). The ranges above are kept because they come from the age-band charts, which the exact tables don't break down. The exact tables give one figure per year, not one per age band, so they add to these ranges rather than replace them. Cite the exact figure for an overall rate, and the range when the point is how the gap varies with age. The **Education** row is still chart-read only.

**Colorectal also breaks education down by sex** — women participate more than men at every education level and age (e.g. tertiary-educated: ~71–82% men vs. 79–85% women).

**This is the strongest, most directly-sourced equity evidence we have** — Cancer-Registry-direct, screening-specific, consistent across all three programmes and essentially all ages. It answers the *real* equity question (who, not just where) that our THL county-level proxy could only gesture at.

## How this changes our evidence base

- The THL Sotkanet screening-attendance-by-county finding (Helsinki-metro below the 80% target) still stands and is still useful — county is the real "account-level" unit the brief means. But these breakdowns show the real driver sits underneath geography: education and region of birth, consistently, across all three screening programmes.
- The "no cancer-specific wait-time data exists" limitation stated in `additional_data_sources.md` §1 and repeated in the Pathway Atlas / Reach Loop artifacts is **now out of date** for the screening→diagnosis hop, for all three cancer types — not just breast.
- **Recommend updating both published artifacts** to lead with this stronger, cancer-specific source where it overlaps with what they currently say, and to correct the now-outdated limitation note.

## Also noted on the mentor deck shared this session

A companion resource, `zeneca_resources_en/Equility in Cancer Care_Espoo 13.11.26_distribution.pdf` (Hanne Kuitunen, Pohde / North Ostrobothnia Wellbeing Services County), independently corroborates this with peer-reviewed, patient-level Finnish evidence:

- **Zai et al., BMJ Public Health 2025;3:e002829** — Finnish register study, 469,522 patients, 2000–2019. By education, highest vs. lowest group: surgery 51% vs 36%, radiotherapy 25% vs 14%, chemotherapy 24% vs 15%, hormone therapy 24% vs 18%; **cancer mortality 27% vs 47%**.
- **Kuitunen et al., Cancer Medicine 2026;15:e71920** — DLBCL patients: symptom-onset-to-treatment-start is **123 days via private/occupational healthcare vs. 207 days via public primary care**.
- **Tokola et al., Cancer Medicine 2025;14(22)** — symptom-to-diagnosis interval >7 weeks associated with inferior progression-free survival.
- **Acta Oncologica 2022;61(11):1317–1331** — Nordic meta-analysis, 98 studies: lower SES → later stage, less active treatment, worse survival, consistently across Finland/Sweden/Norway/Denmark/Iceland.
- Strategy's own cost projection, repeated on this deck: cancer care costs **€1.5bn (2023) → €2.6bn (2035)** without targeted measures.
- Framing worth carrying into our pitch: *"Not everything for everyone — but consistent, evidence-based criteria for treatment selection across Finland."*
- Disclosure: presenter has consulting ties to AstraZeneca (among Roche, Incyte, Abbvie, Gilead, SOBI, Takeda, J&J) — noted for context, not a data-quality issue.

## Not pulled from this source (acknowledged gap)

*(Partly resolved 2026-11-14: wellbeing-county screening funnels, including attendance, are now extracted for all three programmes; see §2b and §2c.)* Wellbeing-county-level participation/positivity rates (as opposed to national) and the "Collaboration areas" and "Participation rate maps" sections exist in all three reports but weren't extracted this round — we already have county-level screening attendance from THL Sotkanet, so this was lower priority than the delay and equity data above, which had no THL equivalent at all.
