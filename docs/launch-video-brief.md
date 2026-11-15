# Frontiers Health — launch video brief

Context for a Claude Design agent producing the product launch video.

**Every figure and quoted string below was verified against the running stack on 2026-11-15.** Figures in this brief are the only figures to put on screen. If you need one that is not here, read it off the captured screen or ask — do not infer it.

---

## 0. The name

The product is **Frontiers Health**. That is the only name that may appear on screen.

`reach-loop` / `reachloop` is the internal codename and is still live in the plumbing, so it can leak on camera. It is deliberate and not a bug to fix — just keep it out of frame:

| Where the codename still shows | Consequence for the shoot |
|---|---|
| `GLOSSARY.md` — titled "# Reach Loop" | Don't film the glossary. |
| Engine and narrative Swagger pages — "Reach Loop engine", "Reach Loop narrative" | Safe to film the **public** API docs at `:8000/docs` ("Frontiers Health API"). Never the internal services'. |
| `docker ps` — containers named `reach-loop-*` | No terminal shots of `docker ps` / `docker compose`. |
| `api/README.md`, `common/` package names | Don't film the repo tree. |

The two Claude artifact mockups in `README.md` are also named "Reach Loop" and "Pathway Atlas". They are **predecessor mocks, not the product.** Capture from the running app only.

## 1. What it is, in one sentence

Frontiers Health shows, Region by Region, where Finnish cancer care falls short of national targets, says so in plain language, and turns that into an action a named decision-maker can issue and a Region can work.

Built for the AstraZeneca challenge at Junction 2026. **Live at `frontiershealth.xyz` since 2026-11-15 08:26 EET**, so the address bar is safe to film. The api is at `api.frontiershealth.xyz`, its docs at `/docs`.

## 2. Deliverable — assumed spec

Nobody has fixed the format, so this brief assumes the following. **Confirm before you render a master.**

- **Master**: 90 seconds, 1920×1080, 16:9, 30fps.
- **Cutdown**: 60-second version by dropping beat 4 (see §6) and tightening the close.
- **Social**: 9:16 crop must survive — keep all on-screen text inside the centre 60% horizontally. The product's phone layout (390×844) is real and good; prefer capturing the phone build for vertical rather than cropping desktop.
- **Sound**: assume it will be watched muted in a feed. Every claim must be legible as on-screen text. No voiceover-only facts.
- **No captions burned into the master** if a separate caption track is possible.

## 3. Who it is for

Two users, and the handoff between them is the product:

| | **State Decision Maker** | **Regional Decision Maker** |
|---|---|---|
| In the demo | Aino Virtanen, Director Cancer Programme, Ministry of Social Affairs and Health (STM) | Markus Laine, Head of Screening Services, City of Helsinki |
| Sees | All 23 Regions | Only their own Region |
| Does | Finds the Gap, issues a directive | Receives it, assigns the work, reports progress |
| Accent on screen | Brand rose `#8a1960` | Slate-blue `#245fb0` |

Neither sees the other's screen. That separation is the thing worth showing: the State sets the outcome, the Region decides who does what.

## 4. The problem, stated honestly

Finland has national cancer screening targets. Participation varies by Region, and the variation is not random — but a national dashboard that only ranks Regions tells a decision-maker nothing about *what to do*. The gap between "this Region is behind" and "here is the action, with the evidence and the strategy clause behind it" is where the work sits.

**Do not frame this as detecting cancer, predicting risk, or diagnosing patients.** It does none of those. It measures distance from a target and matches that to a curated catalogue of policy actions.

## 5. Verified figures — use these exactly

All 2024, read from the live API today.

**National scale**
- **23** Regions (21 wellbeing services counties, the City of Helsinki, Åland)
- **45** indicator readings need action (`act`) across the country
- **22 of 23** Regions have at least one. **Åland is the only Region with none** — if you show a map legend, this is why one tile is pale.
- **8** further readings are at `watch`
- Worst overall: **North Savo**, with 4
- **8,018** indicator values loaded; **1,933** Gaps scored; **73** curated National Cancer Strategy actions

**City of Helsinki — the worked example**

| Indicator | Value | Target | Gap | Severity | Rank |
|---|---|---|---|---|---|
| Breast cancer screening attendance | 74.3% | 80% | −5.7pp | act | 22 of 22 |
| Cervical cancer screening attendance | 71.4% | 80% | −8.6pp | act | 15 of 23 |
| Colorectal cancer screening attendance | 69.6% | 80% | −10.4pp | act | 22 of 22 |

Note the rank denominators differ (22 vs 23) because not every Region reports every indicator. If you put ranks on screen, keep the denominator with them.

Helsinki's foreign-background share: **20.8%**, against a national median of **7.5%**.

**Data provenance** — name these if you show sources: THL Sotkanet (including Finnish Cancer Registry series), Statistics Finland (StatFin), Traficom, Kela.

## 6. The story, in six beats

Timings are for the 90-second master.

**Beat 1 — Cold open (0:00–0:08).** Wordmark on `#f6f6f3`. One line: *Finland sets national cancer screening targets. Most Regions miss at least one.*

**Beat 2 — The country (0:08–0:22).** The Decision Map: 23 Regions shaded by how many indicators need action. One glance says the problem is everywhere and uneven. On-screen figure: **45 readings need action. 22 of 23 Regions.**
> No Region is uniformly the problem — that is why the product shows each indicator separately rather than one combined score.

**Beat 3 — One Region (0:22–0:38).** Tap Helsinki. Three screening programmes, all below target, each with a plain-language sentence first and the number second. Let the three cards land as a set before pushing in on one.

**Beat 4 — Why (0:38–0:52).** "What the data says" — a rule-based reading, not a model's opinion. Exact on-screen copy, verbatim from the app:
> "Screening attendance is below target for breast, cervical, colorectal cancers."
>
> "This Region's foreign-background share (20.8%) is above the national median (7.5%) — the one covariate that predicts lower attendance at both the Region and individual level, confirmed two independent ways."

The ecological-fallacy caveat sits beside this in the product. **Show it in the same shot, not as a later disclaimer** (see §7).

**Beat 5 — What to do (0:52–1:06).** Candidate actions, each tied to a National Cancer Strategy clause with its page number, or to a covariate rule. The recommended action for Helsinki, verbatim:
> **Multilingual, community-based screening outreach** — targeted invitations and reminders in the Region's most common non-Finnish/Swedish languages, run with community organisations rather than a generic translation.

The citation is the payload of this beat and is real — hold on it long enough to read:
> National Cancer Strategy 2026–2035, p.29 (action 2.4.1) — linked via Roadmap p.48 (measure 2.4.1).

Not a suggestion engine. Stated rules over published figures.

**Beat 6 — The handoff (1:06–1:22).** The State issues a directive. Switch account — and let the whole interface shift from rose to slate-blue as it does, because that is how the app itself tells you whose screen you are on. The Regional Decision Maker now has the directive broken into **14 derived steps across 6 phases**, of which the **Region owns 12**:

| Phase | Steps include |
|---|---|
| National mandate *(already done, shown for the record)* | Attach the evidence pack · Issue the directive to the Region |
| Define who is contacted | Build the cohort from the screening register · Resolve contact details and recorded language |
| Clear the legal basis | Record the lawful basis and run a DPIA |
| Write and approve the message | Draft the invitation and the reminder · Translate into the Region's actual top languages · Clinical sign-off |
| Open the channel | Register the message template with Kanta · Set up the non-digital fallback · Accessibility conformance check |
| Send and watch | Pilot wave to 10% of the cohort · Full send in scheduled waves · Report attendance back to the national programme |

These titles are real UI strings and are far better copy than a generic "assign work" montage — quote them. The step count (14) and the split (12/14) are verified. The other three figures in that stat row — working days end to end, bodies to notify — are computed live; **read them off your capture, do not guess them.**

**Close (1:22–1:30).** End on the point: **it closes the loop from a national number to a named person's task.**

## 7. Claims you must not make

This is health equity work about a real disease in a real country. Overclaiming is the fastest way to lose a serious audience, and some of these are also just false.

- **Never present a Region-level pattern as describing individuals.** This is the ecological fallacy and the product warns about it on screen. Across Regions in 2024, higher median income went with *lower* breast-screening attendance, while within Regions women with more education attend *more*. The on-screen wording, verbatim and quotable:
  > "These are area-level patterns. They tell you where to look, not who is affected."
- **Do not say the system finds, predicts or diagnoses cancer.** It measures distance from a screening target.
- **Do not claim it identifies individual patients.** It never sees patient-level data. "Patient" actions describe a group of invitees, never a person.
- **Do not claim lives saved, cancers caught, or any outcome.** Nothing has been deployed; there is no result to report.
- **Do not imply official endorsement.** It is not commissioned, endorsed or used by STM, THL, the wellbeing services counties or AstraZeneca. The accounts in the demo (Aino Virtanen, Markus Laine) are **fictional**; if they appear on screen for more than a moment, label them as sample accounts.
- **Do not call the Narratives "AI insights".** Most are Template sentences — a Gap's own numbers filled into fixed wording, exact by construction. Where an LLM writes one, every number in it is checked against the source data and the text is discarded if a number does not match. That check is a better story than "AI" anyway.
- **Do not claim the product is in Finnish or multilingual.** The interface is English-only; the data layer is bilingual. See §8 for the exact honest wording.
- **Do not show the trend line.** It is not built. (Tracked as issue #56.)
- **Do not invent UI.** If a screen you want does not exist, cut the beat or ask. A mocked-up frame in a launch video becomes a promise.

## 8. Finnish and Swedish — what is and is not there

**The interface is English-only. There is no language toggle. Do not show a Finnish interface — it does not exist, and filming one means building one.** `web/src/app/layout.tsx` hardcodes `<html lang="en">`; there is no Finnish UI string anywhere in `web/src`.

This was a decision, not an oversight. Ticket #19 specified a full FI/EN toggle — Finnish labels, Finnish patient tab, Finnish Template sentences with Finnish number formatting — and it was **deliberately cut** on the Sunday morning before judging, on the ticket's own instruction that Finnish is the first thing to go if time runs short. The demo host was still not live and Finnish is a pitch enhancement, so the hours went to a shareable URL and a rehearsed demo. That also retired #21, the native-speaker review of the Finnish copy. If anyone asks, that is a defensible engineering trade, not a gap in the thinking.

**Below the interface, the system is already bilingual.** All verified today:

| What exists | Verified value |
|---|---|
| Finnish Region names — all 23, `dim_region.name_fi` | `Helsingin kaupunki`, `Keski-Suomen hyvinvointialue` |
| Swedish Region names — all 23, `dim_region.name_sv` | `Helsingfors stad`, `Mellersta Finlands välfärdsområde` |
| Finnish indicator names, `dim_indicator.name_fi` | `Rintasyövän seulontaan osallistuneiden osuus kutsutuista` |
| Finnish Template sentences, `common/common/template.py` | decimal comma, `prosenttiyksikköä` for percentage points |
| The `Narrative` contract carries `language: "en" \| "fi"` | `"fi"` always returns a Template sentence, never LLM text |

A real Finnish Template sentence, generated from the live code for the Helsinki breast-screening Gap:

> Helsinki: rintasyövän seulontaan osallistuneiden osuus kutsutuista 74,3 % vuonna 2024, 5,7 prosenttiyksikköä alle tavoitteen (80 %). Sijoitus 22/22.

Against the English for the same Gap:

> Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 22 of 22.

**Rules if language comes up on screen or in a script:**

- **Do not claim the product is localised, available in Finnish, or multilingual.** The honest sentence: *the figures, Region names, indicator names and plain-language sentences are already bilingual; the interface chrome is not yet.*
- **Finnish copy has never had native-speaker review** (#21 was retired with #19). So do not present Finnish text as finished product copy. If you show that sentence, it is a system output, not polished UI.
- **Quote Finnish verbatim; never retype or adapt it.** The templates deliberately avoid inflecting the Region name (`Helsinki: ...`) so any name drops in unchanged. Reworded Finnish will be wrong in a way an English-speaking editor cannot see.
- **Finnish numbers use a decimal comma** — `74,3 %`, with a space before the `%`. If you animate a Finnish figure, keep that format.
- **Do not let beat 5 read as ironic.** The recommended action is multilingual outreach, shown in an English interface. That is fine and worth no comment — but never imply the product itself speaks those languages. Note also that the action's own step is *"Translate into the Region's actual top languages"*: the invitees' languages, run with community organisations, not Finnish and Swedish.
- **Bilingualism is a deployment requirement, not a feature idea.** Finland is officially bilingual and Åland — one of the 23 Regions — is Swedish-speaking. If the video touches on what shipping this for real would take, this belongs there rather than in a features list.
- **If a Finnish-subtitled cut is wanted**, the Region names, indicator names and Template sentences above are safe to reuse exactly. Everything else would be new translation and would need a native speaker first.

## 9. Vocabulary — use these words

From `GLOSSARY.md`. Wrong words here read as not understanding the domain.

| Use | Means | Avoid |
|---|---|---|
| **Region** | One of the 23 areas THL reports on | county, area |
| **Gap** | How far a Region's value sits from its Target, or from other Regions where there is no Target | bottleneck, shortfall, deficit |
| **Target** | A value the National Cancer Strategy commits every Region to reach | goal, benchmark |
| **Severity** | `ok` / `watch` / `act`, set by fixed written thresholds | status, priority, risk |
| **Narrative** | The plain-language sentence a decision-maker reads first | summary, insight, AI text |

"Wellbeing services county" is the legal body; use it only when the legal body matters.

## 10. Visual identity — take it from the product

The UI already has a considered design language, documented in `web/src/app/globals.css`. Match it rather than inventing one.

**Type**: Archivo (display/headings, weights 700/800, letter-spacing −0.01em) and Public Sans (body, 400/500/600). Both Google Fonts. Figures use tabular numerals — keep columns of numbers aligned if you animate them.

**Colour** — exact tokens:

| Role | Hex |
|---|---|
| Background | `#f6f6f3` |
| Sunk background | `#eeeeea` |
| Card | `#ffffff` |
| Ink (primary text) | `#14181a` |
| Ink secondary | `#565d61` |
| Ink tertiary | `#616769` |
| Hairline / strong hairline | `#e1e3dd` / `#cbcec6` |
| **Brand** (deep magenta — State) | `#8a1960` |
| Brand soft / line | `#f7e7f0` / `#e3bcd6` |
| **Region accent** (slate-blue — Regional) | `#245fb0` |
| Region soft / line | `#e6effc` / `#bcd5f4` |
| `ok` green | `#1f7a3d` (soft `#e4f3e6`) |
| `watch` amber | `#8e6100` (soft `#fbeece`) |
| `act` red | `#bb3a2d` (soft `#fbe4e1`) |

**Two scales, never mixed.** Magnitude on the map uses a sequential rose ramp — `#feebe2 → #fbb4b9 → #f768a1 → #c51b8a → #7a0177` (ColorBrewer RdPu 5-class, the family the Finnish Cancer Registry's own charts use). Severity (`ok`/`watch`/`act`) is a separate status scale used only **off** the map. Do not shade a map tile red because it is `act`.

**The role accent is the handoff.** One attribute on `<body>` re-skins the entire app: rose for State, slate-blue for Region. Use that transition as the visual hinge of beat 6 rather than a cut or a wipe.

**Geometry**: radii 20 / 14 / 9px. Shadows are very soft — `0 1px 2px rgba(18,22,26,.04), 0 10px 26px -16px rgba(18,22,26,.18)` for cards. Generous whitespace.

**Feel**: quiet, precise, civic. A government instrument, not a consumer app. No gradients on text, no neon, no dark "hacker" aesthetic, no stock photography of doctors, no ticking-clock urgency music.

**Accessibility is part of the design, not an afterthought.** Severity is never colour alone — it always carries a text label (`Not started` / `In progress` / `Done` / `Blocked` on steps). If you show a severity state, show its label. Contrast was tuned against the surfaces each colour actually lands on; don't recolour text onto new backgrounds without rechecking.

## 11. Assets — what exists and what you must capture

**Exists:**
- Logo: `web/public/logo.png`, `web/public/logo@512.png`; app icon `web/src/app/icon.png`
- Screenshots: `docs/screenshots/decision-map-desktop-1440.png` (1440×900) and `decision-map-phone-390.png` (390×844)
- Architecture diagram and full build rationale: `BUILD.md`
- Every endpoint with real examples: `docs/api.md`

**Does not exist — you must capture it.** The two screenshots above are both the Decision Map. There is **no** existing capture of the Helsinki cards, the synthesis panel, the action cards or the Regional step view — i.e. beats 3 through 6. Capture from the running product:

- `https://frontiershealth.xyz` — live, and the same build as a local stack. Its api docs at `https://api.frontiershealth.xyz/docs` are safe to film; the engine's and narrative's are not (see §0)
- `http://localhost:3000` with the stack up (`docker compose up --build`; see `docs/local-development.md`) — the fallback, and what to use if the live site does not answer
- **The live site is served from a laptop through a Cloudflare Tunnel.** It is up for the event, not indefinitely. If it is dark when you come to capture, run the stack locally rather than assuming the product broke
- There is no wordmark lockup or motion asset of any kind yet. If the video needs one, that is new design work — say so rather than stretching `logo.png`.

## 12. Tone

Understated. The figures are strong enough that overselling them weakens the case. The product's own voice is plain sentences and stated reasoning; the video should sound like the product, not like an ad for it.

A good closing line is a true one: *45 indicator readings across 23 Regions need action this year.* No Region is uniformly the problem — which is exactly why this shows each indicator separately rather than one combined score.
