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

## 3. Visually-read data: participation by equity dimension, all three cancer types

Consistent methodology across all three reports (own equity breakdowns, by 2-year/5-year age band):

| Dimension | Breast (ages 50–68) | Cervical (ages 30–65) | Colorectal (ages 60–70) |
|---|---|---|---|
| **Education** (primary → tertiary) | ~56–72% → 85–89% (~20–25pp gap) | ~40–61% → 77–82% (~20–30pp gap) | ~47–66%(men)/55–72%(women) → 71–82%/79–85% (~20–24pp gap, within each sex) |
| **Domestic vs. other/missing nativity** | 83–85% vs. 59–63% (~23pp) | 71–79% vs. 46–63% (~15–25pp) | 70–78% vs. 50–57% (~15–20pp) |
| **Region of birth** | Finland ~82–85%; **Africa ~28–53% (worst, widens with age)** | Finland ~71–79%; Africa ~42–57% (worst at most ages) | Finland ~70–78%; **Africa ~39–44% (worst, widens with age)** |
| Other region-of-birth groups | Europe excl. Finland 62–70%, Americas 59–67%, Asia 57–64% | Europe 53–68%, Asia 41–66%, Americas 47–67% | Europe 53–62%, Asia 53–59%, Americas 49–61% |

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

Wellbeing-county-level participation/positivity rates (as opposed to national) and the "Collaboration areas" and "Participation rate maps" sections exist in all three reports but weren't extracted this round — we already have county-level screening attendance from THL Sotkanet, so this was lower priority than the delay and equity data above, which had no THL equivalent at all.
