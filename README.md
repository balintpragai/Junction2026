# Reach Loop

An AI-powered gap-finder for equitable cancer care in Finland — built for the AstraZeneca challenge at Junction 2026.

**Start here → [`BUILD.md`](BUILD.md)** — the full build plan: architecture, schema, API contracts, the four workstreams, schedule, and what to do when time runs short.

## Map of this repo

| Directory | What's in it |
|---|---|
| [`BUILD.md`](BUILD.md) | The build plan. Read this first. |
| [`data/`](data/README.md) | Every dataset pulled this project — `processed/` is what the build loads, `raw/` is the original pulls kept for traceability. `data/README.md` documents every file: exact source, method, caveats. |
| [`research/`](research/) | Fact-checked findings: strategy citations (`gemini_research.md`, `additional_data_sources.md`), the Cancer Registry deep-dive (`cancer_registry_screening_reports.md`), and the structural-covariate correlation analysis with its ecological-fallacy correction (`covariate_correlation_analysis.md`). |
| [`zeneca_resources_en/`](zeneca_resources_en/) | Original source documents: Finland's National Cancer Strategy 2026–2035, its implementation roadmap, and a mentor briefing deck — all translated to English. |
| `AGENTS.md` | Instructions for AI coding agents working in this repo (not team-facing). |

## The two working demos

- **Pathway Atlas** — the whole-picture explainer: Finnish cancer-care system, stakeholders, data inventory, architecture concept. `https://claude.ai/artifact/TU4EHV8eV2jcgEva3NTG3X`
- **Reach Loop** — the clickable mock of the actual product (decision-maker gap-finder / outreach list / patient nudge). `https://claude.ai/artifact/3M444xDbCuB55BPASLbWwY`

Both are mockups with real data wired into static JS — `BUILD.md` is the plan for turning Reach Loop into the real, running system.
