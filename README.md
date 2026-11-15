# Frontiers Health
This project was created for Junction 2026 Astra Zeneca challenge.

## Two women in Helsinki open the same letter. One of them dies in cancer. Help us prevent that.
Breast Cancer that is detected at early stages has almost 100% survival rate, this is why screenings are important. Screenings are free in Finland, women are invited bi-yearly for these. So who goes? Mostly citizens in well developed and well connected regions. The problem is, that a lot regions are not well connected and there are a significant number immigrant women, who need the screening, but don't speak the language. The data shows these problems, but doesn't make it understandable for decision makers. And arranging the right invitation to the right people at the right time isn't just one person's one decision. It takes 10 decision making bodies 14 steps and has no name on it.

Frontiers Health solves these problems, by tracking and visualizing relevant data broken down to regions, so that involved authorities can see more problematic regions. Our solution allows them to file required documentation, reasoning, action plan and reach out to involved stakeholders to streamline the process from identifying vulnerable groups, through sending the invitation all the way to getting them to screening.

Breast cancer is where we start, not where we stop. Finland runs three national screening programmes, for breast, cervical and colorectal cancer, and the same gap shows up in all three. In 2024, people born in Africa attended breast screening at 45.1% against 83.1% for people born in Finland, cervical screening at 49.0% against 76.0%, and colorectal screening at 40.5% against 74.5%. Frontiers Health tracks each programme separately, because the regions that struggle are not the same: Helsinki has some of the longest waits for follow-up tests after a positive breast or cervical screen, while North Savo and Päijät-Häme have the longest for colorectal. The same view also follows patients after screening, through referral times, treatment starts and survival, so a region can see where along the way its patients are lost.

Beyond the invitation itself, Frontiers Health gives decision makers:
- **A plain-language sentence for every region**, such as "Helsinki is 5.7 points below the 80% screening target", with the figures, ranking and trend behind it.
- **A clear rating of how urgent each gap is** (ok, watch or act), set by fixed rules so the same gap gets the same rating everywhere.
- **The National Cancer Strategy's own proposed action** for each gap.
- **An outreach list** of regions below target, shown next to what may lie behind each gap: the share of immigrant residents, travel costs to appointments, broadband coverage and doctor shortages.
- **A simple view for patients**, and every view in both Finnish and English.

### Screening attendance in 2024

The same groups fall behind in every programme. Source: Finnish Cancer Registry.

| Programme | Domestic native language | Other or unknown native language | Born in Finland | Born in Africa |
|---|---|---|---|---|
| Breast | 83.2% | 60.8% | 83.1% | 45.1% |
| Cervical | 76.2% | 56.3% | 76.0% | 49.0% |
| Colorectal | 74.5% | 53.4% | 74.5% | 40.5% |

### What we track for each cancer

| Cancer | Screening attendance by region | 5-year survival by region | Also tracked |
|---|---|---|---|
| Breast | 2016–2024 | Yes | Attendance and follow-up by region, native language and region of birth; wait from a positive screen to diagnostic tests; new cancer-medicine reimbursements |
| Cervical | 2016–2024 | Yes | Attendance and follow-up by region, native language and region of birth; wait from a positive screen to colposcopy |
| Colorectal | 2022–2024 (programme began in 2022) | Yes | Attendance and follow-up by region, native language and region of birth; wait from a positive screen to colonoscopy |
<!-- | Prostate | — | — | National trends in incidence, deaths and survival; new cancer-medicine reimbursements by region |
| Lung | — | — | National trends in incidence, deaths and survival | -->



# Quickstart

**Start here → [`BUILD.md`](BUILD.md)** — the full build plan: architecture, schema, API contracts, the four workstreams, schedule, and what to do when time runs short.

**Run it locally →** with Docker installed, `docker compose up --build` from the repo root, then open http://localhost:3000. Details, tests and troubleshooting: [`docs/local-development.md`](docs/local-development.md).

**Tickets →** if you are a developer of this project, make sure to read the [`docs/tickets.md`](docs/tickets.md) documentation.

## Map of this repo

| Directory | What's in it |
|---|---|
| [`BUILD.md`](BUILD.md) | The build plan. Read this first. |
| [`data/`](data/README.md) | Every dataset pulled this project — `processed/` is what the build loads, `raw/` is the original pulls kept for traceability. `data/README.md` documents every file: exact source, method, caveats. |
| [`research/`](research/) | Fact-checked findings: strategy citations (`gemini_research.md`, `additional_data_sources.md`), the Cancer Registry deep-dive (`cancer_registry_screening_reports.md`), and the structural-covariate correlation analysis with its ecological-fallacy correction (`covariate_correlation_analysis.md`). |
| [`zeneca_resources_en/`](zeneca_resources_en/) | Original source documents: Finland's National Cancer Strategy 2026–2035, its implementation roadmap, and a mentor briefing deck — all translated to English. |
| `AGENTS.md` | Instructions for AI coding agents working in this repo (not team-facing). |
| [`GLOSSARY.md`](GLOSSARY.md) | The words we use: Region, Gap, Target, Severity, Narrative, Template sentence. Use these in tickets, code and the UI. |
| [`docs/adr/`](docs/adr/) | Decisions that would otherwise surprise a newcomer (e.g. why we measure Gaps, not bottlenecks). |


## Demo host

The stack runs on a laptop and is published through a Cloudflare Tunnel, because
the venue network has no inbound ports to forward. Setup and verification:
[`docs/demo-host.md`](docs/demo-host.md) → **Cloudflare Tunnel from a laptop**.

- **Web:** <https://frontiershealth.xyz> — live since 2026-11-15 08:26 EET
- **API:** <https://api.frontiershealth.xyz> — live (interactive docs at [`/docs`](https://api.frontiershealth.xyz/docs))

`www.frontiershealth.xyz` serves the same app. TLS is Cloudflare's; there is no
Let's Encrypt and no Caddy on this path.

**The origin is a laptop.** If the domain stops answering, the tunnel or the
machine is down, not DNS — check `cloudflared tunnel info frontiers-health` for
live connections and `docker compose ps` for the stack, in that order.

**Redeploy** (on the VM, from the repo checkout):

```sh
git pull && docker compose up -d --build
```

Then run `deploy/check.sh` to confirm everything is healthy. Setup, verification, rollback, troubleshooting and what to show on the day: [`docs/demo-host.md`](docs/demo-host.md). Every endpoint, with examples: [`docs/api.md`](docs/api.md). Running the stack on your own machine: [`docs/local-development.md`](docs/local-development.md).
