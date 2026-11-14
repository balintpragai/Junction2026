# Research notes: Precision oncology data, bottlenecks & governance (via Gemini)

**Source:** Shared Gemini conversation — https://share.gemini.google/Y0uTcYlfwiJz
**Retrieved:** 2026-11-13, via rendered scrape (the share link is a JS-rendered page; plain HTTP fetch returns an empty shell, so content was pulled via a headless-browser-rendering fetch).
**Original title:** "Advanced Data Models, Infrastructure Accessibility, and Predictive Analytics in Precision Oncology"

> ⚠️ **How to use this file.** This is AI-generated research (Gemini), not a primary source. Section 1 reproduces it close to verbatim for reference. Section 2 cross-checks its Finland-specific claims against the official documents we have on disk (`zeneca_resources_en/*.pdf`) and against live public data we pulled ourselves (`data/processed/`). **For the submission, cite the primary sources in Section 2/3, not Gemini's prose directly** — judging criterion "Data quality & transparency" penalizes unsourced claims, and several figures below (marked ⚠️ UNVERIFIED) could not be confirmed against any source we hold and need checking before they go on a slide.

---

## 1. Gemini research content (as retrieved)

### Introduction

The transition toward precision oncology represents one of the most profound paradigm shifts in modern medicine. Moving away from generalized, empirical treatment protocols, contemporary oncology increasingly relies on highly individualized care pathways driven by genomic profiling, advanced computational modeling, and real-world evidence (RWE). This evolution is bottlenecked by fragmented data governance, socio-economic barriers to care, and infrastructural limitations. Healthcare networks globally are attempting to harmonize clinical data through semantic interoperability standards, deploy predictive AI to mitigate treatment abandonment, and restructure national healthcare policies — including the European Health Data Space (EHDS), which will dictate the future of secondary health data use.

### The architecture of global oncology data ecosystems

Flagship open/federated data initiatives: **Project Data Sphere** (de-identified phase III trial data + SDOH/MEPS integration, used to simulate trial control arms); **The Cancer Imaging Archive (TCIA)** (DICOM radiology linked to outcomes/genomics, used to train tumor-segmentation CNNs); **Genomic Data Commons (GDC)** (NCI-run, links molecular subtypes to clinical phenotypes, integrating LLMs for histology annotation); **Cancer Research Horizons** (biomarker/multimodal datasets, e.g. colorectal cancer genomics↔therapy response); **SEER** (US population-level incidence/survival/demographic gold standard for social-determinants research).

### Semantic interoperability: the FHIR → OMOP pipeline

Two dominant standards: **FHIR** (operational EHR exchange) and **OMOP Common Data Model** (federated retrospective analytics). Oncology-specific elements (TNM staging, biomarker status, cumulative radiation dose) don't map cleanly, so the **mCODE** initiative built an oncology-specific FHIR implementation guide feeding the OMOP Oncology CDM extension. Tooling: HL7 FHIR-to-OMOP Implementation Guide (FHIR Mapping Language + ConceptMaps for SNOMED/LOINC/RxNorm), **CAMP FHIR**, **OMOPonFHIR**. Once harmonized, **OHDSI** tooling (ATLAS, Achilles, Data Quality Dashboard) enables standardized multi-country analysis, reducing single-institution algorithmic bias.

### Overcoming data scarcity: privacy-preserving synthetic data

Under GDPR, synthetic data generated from real patient data is still "processing of personal data" — DPIAs are required because generative models (GANs/VAEs/diffusion, 1-D CNNs/convolutional autoencoders for clinical time series) can memorize rare trajectories. Three validation pillars: **(1) privacy/leakage risk** (adversarial simulation, nearest-neighbor checks, Rényi differential privacy budgets), **(2) statistical/clinical fidelity**, **(3) downstream utility**. Combined with federated learning, synthetic data lets institutions collaborate without sharing raw records.

### Predictive analytics & social determinants of treatment adherence

Cancer disparities are driven by **Social Determinants of Health (SDOH)** — economic stability, education, access, geography — not biology alone. AI models increasingly fuse SDOH with EHR/genomic/geospatial data; fairness-aware AI and federated learning aim to avoid amplifying bias against under-represented cohorts.

**Illustrative synthetic-cohort analysis (N=100)** cited in the research — explicitly a synthetic/illustrative dataset, not real patient data:

| Income bracket | Completed | Partial | Dropped |
|---|---|---|---|
| High | 30.3% | 30.3% | 39.4% |
| Medium | 26.5% | 41.2% | 32.4% |
| Low | 27.3% | 27.3% | 45.5% |

| Stage at diagnosis | Completed | Partial | Dropped |
|---|---|---|---|
| I | 35.5% | 35.5% | 29.0% |
| II | 23.1% | 38.5% | 38.5% |
| III | 13.3% | 26.7% | **60.0%** |
| IV | 32.1% | 28.6% | 39.3% |

| Adherence | Mean distance to clinic (km) | Mean wait time (days) |
|---|---|---|
| Completed | 295.75 | 175.75 |
| Partial | 231.57 | 217.42 |
| Dropped | 222.71 | 176.38 |

Read with care: this is a 100-row synthetic illustration (not Finnish, not real-world), useful only as a *hypothesis generator* (e.g. "longest wait times correlate with partial rather than full dropout — friction, not distance, may be the bigger driver") — not as evidence for a Finland submission.

**ML-based Clinical Decision Support (CDSS):** ensemble methods (Random Forest, XGBoost) outperform logistic regression for adherence prediction (e.g. XGBoost R²=0.62, Random Forest 81% accuracy predicting regimen compliance in breast cancer survivor studies cited); time-lagged features and patient-reported instruments (Morisky MMAS-8, Beliefs about Medicines Questionnaire) improve predictive power. Translational gap: few models get external validation or RCTs before deployment; poor interpretability and EHR integration remain barriers.

### Infrastructural bottlenecks: digital divide & workforce

- **Digital divide / health literacy:** Finland's **My Kanta** patient portal has high adoption (cited: survey of 3,135 users, high use among 50+) but patients struggle with jargon-heavy pathology/radiology reports without clinician context; "digital divide" is about skills/trust, not just broadband — especially for older, lower-SES, and immigrant populations.
- **Workforce burnout — TRANSiTION project:** a European gap-analysis project found digital-skill deficits among both clinical and non-clinical cancer-care staff; top-down digital rollout without ergonomic design/protected training time drives cognitive overload and burnout.
- **Geographic isolation:** centralizing complex cancer surgery/radiotherapy into university hospitals (as Finland does) raises travel burden; patients living >100km from a radiotherapy unit show lower palliative-radiotherapy utilization. Kela reimburses medical travel (taxi/ambulance) — cited figure **€311 million in 2021** (✅ CONFIRMED 2026-11-13 — THL Sotkanet, Kela-sourced indicators, national total €311,108,000 in 2021 exactly. See `data/processed/kela_medical_travel_reimbursement_by_wellbeing_county.csv`).
- **Case study:** hybrid "decentralized AI triage + peer mentorship" models (mobile pathology units flagging high-risk imaging, freeing radiologist time for complex cases, paired with peer navigators) as one way low-resource regions combine digital triage with human support.

### Standardized patient pathways & quality registries (Nordic benchmarks)

- **Denmark — Kræftpakkeforløb (2008):** time-bound diagnostic pathways, incl. a general pathway for non-specific symptoms (NSSC-CPP). Cited results: median time-to-diagnosis **−17 days**; 3-year lung cancer relative survival **11% → 20%**; GP-referred CT scans **4× more likely** to trigger a rapid NSSC-CPP than hospital-referred scans. (⚠️ UNVERIFIED against primary Danish source in this session — plausible and specific enough to be real, but should be confirmed against a Sundhedsstyrelsen/DMCG citation before use.)
- **Sweden — Standardiserade vårdförlopp (SVF):** tracks "well-founded suspicion" → treatment start. Breast cancer: ~7 days to diagnosis, treatment start within 43 days (strong screening filter). Urothelial cancer: no pre-diagnostic filter, ~29 days to diagnosis, high resource use. Regional variation persists despite national guidelines. (⚠️ UNVERIFIED in this session — same caveat.)
- **Finland's National Cancer Strategy 2026–2035** — see Section 2 below; Gemini's summary of this is **largely corroborated** by the primary PDF, with figures reconciled in the table.

### Legislative horizons: EHDS and the Findata bottleneck

- **European Health Data Space (EHDS):** in force 2025; secondary-use provisions apply 2029 (genomic data categories 2031). Primary use = MyHealth@EU (cross-border point-of-care EHR access); secondary use = HealthData@EU via national Health Data Access Bodies (HDABs). Requires OMOP/FHIR-standardized data processed in secure environments; citizens can opt out, but both non-profit and commercial (incl. pharma) entities can use anonymized/pseudonymized data for R&D including AI training.
- **Findata (Finland):** created under the 2019 Act on the Secondary Use of Health and Social Data as the single permit authority, running the "Kapseli" secure remote-processing environment. Cited problems (⚠️ **UNVERIFIED — not in our two strategy PDFs; verify against Findata's own reporting/THL before using**):
  - ~**46.9% drop** in new national data-permit approvals in 2023 vs. baseline projection, attributed to the Act's administrative friction (not GDPR itself).
  - Permit approval: **3–6 months**; data extraction/compilation: another **3–6 months** — researchers can wait up to a year.
  - Costs: permit **€800–3,000** + **€115/hour** processing + Kapseli hosting; average **€1,800**, complex queries up to **€25,000**.
  - Strict anonymization sometimes blocks exporting granular survival models / AI weights from Kapseli.
  - 2025 legislative revisions: streamlined multi-registry applications (can bypass Findata for single-wellbeing-county queries), clearer rules for international R&D data processing, informed-consent clinical trials partly exempted.
- **HTA reform:** Finland is consolidating Health Technology Assessment under one body combining **Fimea** (medicines agency) and **Palko** (service-selection council), replacing the fragmented hospital-drug/outpatient-drug split, enabling risk-sharing agreements informed by RWE from national registries.

### Conclusion (Gemini's)

Precision oncology's ceiling is a data-governance and infrastructure problem, not just an algorithmic one. Treatment adherence/survival are tightly linked to SDOH (financial toxicity, geographic isolation, late-stage treatment burden). Structural fixes — Nordic-style standardized pathways, paired psychosocial/peer support, workforce digital-skills investment, and resolving the patient-privacy-vs-research-utility tension (EHDS rollout, synthetic data, streamlined HTA) — matter as much as any model.

---

## 2. Finland's Goal 3 — verified against the primary strategy documents

The challenge requires covering **at least one indicator connected to Goal 3** of the national cancer strategy. Goal 3 is:

> **"Ensuring equal and effective cancer treatment"** (*National Cancer Strategy 2026–2035*, p.5)

**Headline indicators for Goal 3 (direct quote from the strategy, p.5):**
- 5-year survival for poor-prognosis cancers reaches Nordic levels (vs. Sweden/Norway average; targets: lung +14pp, pancreatic +6pp, liver +14pp vs. 2023 NORDCAN baseline)
- Cancer mortality **−10%** (baseline stated as **13,300 deaths/year**)
- **"Patients receive treatment within target times"** — monitored per **THL Guideline 21/2016**, *"Monitoring access to treatment in cancer treatment"*

**Sub-objectives under Goal 3** (roadmap + strategy docs):
| # | Sub-objective | Key measure(s) |
|---|---|---|
| 3.1 | National treatment recommendations & care chains guide equal, prompt, effective treatment | 3.1.1 national mechanism + funding (**€5M/yr, €25M/5yr**, covers 2.5.2/3.1.2–3.1.4/4.3.2); 3.1.2 cancer-specific care chains + regional rollout; 3.1.3 cost/societal-impact policy; 3.1.4 national quality/effectiveness targets |
| 3.2 | National cancer care quality register + peer review | Legislative basis for a register attached to the Cancer Registry; **no quality register exists yet** in Finland (as of this strategy) |
| 3.3 | Rehabilitation, psychosocial support, social work, palliative care integrated into the chain | — |
| 3.4 | Functional-capacity data guides care of elderly patients | — |
| 3.5 | Sufficient, competent personnel | — |

**Our pick for the "Goal 3 indicator" this project should cover:** *"Patients receive treatment within target times"* (3.1) — this is the indicator most directly aligned with the challenge's three named bottlenecks (detection → referral → treatment initiation), and it's the one Gemini's Nordic-benchmark research (Denmark/Sweden pathway lead times) is most useful for contextualizing.

**Directly relevant sub-objective 2.5** (under Goal 2, "early detection," but explicitly about the primary→specialist referral bottleneck):
> *"Early detection is hampered by problems in welfare areas, especially challenges in access to primary health care and early diagnosis... due to a shortage of healthcare personnel and congestion in care chains."*
> Action proposal #2: *"Support a smooth transition to specialized medical care by defining standardized referral criteria as part of national care chains, which, when met, will quickly direct patients suffering from possible cancer symptoms to the necessary diagnostic tests."*

**Key data-gap admissions in the strategy itself (important for "data quality & transparency" — use these to frame limitations honestly):**
- *"Clinical cancer registry notifications at the time of diagnosis, which include cancer stage data, only cover approximately 40% of all cancer cases."* (p.30 area) — the machine translation says "prevalence data"; the Finnish original has *levinneisyystieto*, which means stage (spread) data.
- *"A cancer care quality register has not yet been established in Finland... Comparisons of treatment implementation between regions are made sporadically, and are based on crude and fragmented indicators, if comparisons are made at all."* (p.35 area, sub-objective 3.2)
- Target: automate clinical cancer notifications to 90% of cases by 2030; quality-register database coverage target 90%.

**Fact-check of Gemini's Finland-specific figures against the primary PDFs:**

| Claim | Status | Source |
|---|---|---|
| Cancer incidence rising to ~45,000 cases/yr by 2035 (from <38,000 now, +20%) | ✅ CONFIRMED | Strategy p.6 |
| 480,000 people living with/surviving cancer by 2035 (+35% vs. 2022) | ✅ CONFIRMED | Strategy p.6 |
| ~€140M investment over 2026–2031, ~€298M expected savings | ✅ CONFIRMED | Roadmap pp.1,2,appx |
| CANFIN backed by €40M state RDI funding | ✅ CONFIRMED (total CANFIN funding is €65M incl. €25M from partners/University of Helsinki/foundations; €40M is the state portion) | Roadmap p.85-86 |
| CANFIN scaling molecular profiling "10,000 → 100,000 patients by 2035" | ✅ CONFIRMED (staged: >10,000 by 2028, >50,000 by 2031, target 100,000 by 2035) | Roadmap p.85-86 |
| Measure 3.1.1 funding ≈ €25M/5yr for treatment-recommendation & care-chain mechanism | ✅ CONFIRMED | Roadmap p.55 |
| Cancer mortality baseline "13,300/year" | ✅ CONFIRMED independently — Statistics Finland cause-of-death data (pulled live, see §3) shows 13,316 cancer deaths in 2024, 13,472 in 2023 | `data/processed/statfin_cancer_deaths_by_site_national.csv` |
| Kela medical travel reimbursement €311M (2021) | ✅ CONFIRMED exactly (€311,108,000) — THL Sotkanet, Kela-sourced travel-reimbursement indicators | `data/processed/kela_medical_travel_reimbursement_by_wellbeing_county.csv` |
| Findata: 46.9% permit-approval drop in 2023; permit costs €800–25,000; 3–6mo + 3–6mo delays | ⚠️ UNVERIFIED — not in either strategy PDF; these read like they're from a Findata/academic evaluation report not in our file set | — |
| Denmark Kræftpakkeforløb: −17 days to diagnosis, lung survival 11%→20%, GP-referred CT 4× more likely to trigger NSSC-CPP | ⚠️ UNVERIFIED — plausible, commonly-cited Danish figures, but not re-checked against a Danish primary source this session | — |
| Sweden SVF: breast cancer ~7 days to diagnosis / 43 days to treatment; urothelial ~29 days to diagnosis | ⚠️ UNVERIFIED — same caveat | — |
| My Kanta survey "3,135 users" | ⚠️ UNVERIFIED — not in our PDFs | — |

**Recommendation:** Use the ✅ rows freely with the citations shown. For the ⚠️ rows, either find the primary citation (Kela avoindata.fi, Findata's own annual reporting, Sundhedsstyrelsen/RCC i samverkan for DK/SE) before putting them on a judged slide, or present them explicitly as "cited in secondary literature, not independently verified" — the judging rubric penalizes unsupported claims, not uncertainty that's clearly labeled.

---

## 3. What we can actually ground this in: live public data pulled for this project

All of the following were downloaded directly from the sources named in `zeneca_resources_en/Syöpästrategiat ja syöpädata_linkkikokoelma.fi.en.pdf` (the official AstraZeneca-provided link collection). See `data/README.md` for full details, units, and caveats. Headline finding already visible in the pulled data:

> **Breast cancer screening attendance (2024) ranges from 74.3% (Helsinki) to 85.6% (North Ostrobothnia)** — a ~11 percentage-point gap, with the whole Helsinki metro area (Helsinki, Vantaa-Kerava, East/West/Central Uusimaa) clustered at or below the strategy's own **80% participation target** while most other counties clear it. This is a real, sourced, regionally-located gap directly tied to Goal 2's screening-participation indicator and is a strong candidate "gap" finding for the demo.

See `data/README.md` and `data/processed/` for the full indicator set (screening attendance, 5-year survival, cancer incidence index, treatment-reimbursement proxy, oncology outpatient visits — all by the 23 wellbeing services counties, multi-year) and the national mortality trend used to verify the Goal 3 baseline above.

## 4. Suggested next pulls (not yet downloaded — flagged from the link collection for later if time allows)

- **NORDCAN 2.0** (https://nordcan.iarc.who.int/en) — Nordic-comparable incidence/survival/mortality, needed for the "reach Nordic levels" Goal 3 benchmark.
- **Finnish Cancer Registry statistics app** (https://syoparekisteri.fi/tilastot/) — likely an interactive app, not a bulk download; may need manual export.
- **Kela open data** (https://vip.avoindata.fi/data/fi/dataset/voimassa-olleet-alkaneet-ja-paattyneet-laakekorvausoikeudet) — medicine reimbursement rights start/end dates; a genuine *time-to-treatment-initiation* proxy at a finer grain than the Sotkanet reimbursement-prevalence indicator we already pulled.
- **FinRegistry** (https://www.finregistry.fi/finnish-registry-data) — combined registry data; likely requires a research permit, not open download.
- **Findata** (https://findata.fi/) — for verifying the Findata bottleneck claims above.
