# Frontiers Health — launch video brief

Context for a design agent producing a product launch video. Everything below is verified against the running system on 2026-11-15 unless marked otherwise. **Figures in this brief are the only figures to put on screen.** If you need one that is not here, ask rather than infer it.

---

## 1. What it is, in one sentence

Frontiers Health shows, Region by Region, where Finnish cancer care falls short of national targets, says so in plain language, and turns that into an action a named decision-maker can issue and a Region can work.

Built for the AstraZeneca challenge at Junction 2026. Live at `frontiershealth.xyz`.

## 2. Who it is for

Two users, and the handoff between them is the product:

| | **State Decision Maker** | **Regional Decision Maker** |
|---|---|---|
| In the demo | Aino Virtanen, Director Cancer Programme, Ministry of Social Affairs and Health (STM) | Markus Laine, Head of Screening Services, City of Helsinki |
| Sees | All 23 Regions | Only their own Region |
| Does | Finds the Gap, issues a directive | Receives it, assigns the work, reports progress |

Neither sees the other's screen. That separation is deliberate and worth showing: the State sets the outcome, the Region decides who does what.

## 3. The problem, stated honestly

Finland has national cancer screening targets. Participation varies by Region, and the variation is not random — but a national dashboard that only ranks Regions tells a decision-maker nothing about *what to do*. The gap between "this Region is behind" and "here is the action, with the evidence and the strategy clause behind it" is where the work sits.

**Do not frame this as detecting cancer, predicting risk, or diagnosing patients.** It does none of those. It measures distance from a target and matches that to a curated catalogue of policy actions.

## 4. Verified figures — use these exactly

All 2024, from the live system.

**National scale**
- **23** Regions (21 wellbeing services counties, the City of Helsinki, Åland)
- **45** indicator readings need action across the country
- **22 of 23** Regions have at least one
- Worst overall: **North Savo**, with 4
- **8,018** indicator values loaded; **1,933** Gaps scored; **73** curated National Cancer Strategy actions

**City of Helsinki — the worked example**

| Indicator | Value | Target | Gap | Rank |
|---|---|---|---|---|
| Breast cancer screening attendance | 74.3% | 80% | −5.7pp | 22 of 22 |
| Cervical cancer screening attendance | 71.4% | 80% | −8.6pp | 15 of 23 |
| Colorectal cancer screening attendance | 69.6% | 80% | −10.4pp | 22 of 22 |

Helsinki's foreign-background share: **20.8%**, against a national median of **7.5%**.

**Data provenance** — name these if you show sources: THL Sotkanet (including Finnish Cancer Registry series), Statistics Finland (StatFin), Traficom, Kela.

## 5. The story, in five beats

1. **The country.** The Decision Map: 23 Regions shaded by how many indicators need action. One glance says the problem is everywhere and uneven. *No Region is uniformly the problem — that is why the product shows each indicator separately rather than one combined score.*
2. **One Region.** Tap Helsinki. Three screening programmes, all below target, each with a plain-language sentence first and the number second.
3. **Why.** "What the data says" — a rule-based reading, not a model's opinion: screening is below target, and the Region's foreign-background share is above the national median, which is the one covariate that predicts lower attendance at both Region and individual level.
4. **What to do.** Candidate actions, each tied to a National Cancer Strategy clause with its page number, or to a covariate rule. Not a suggestion engine — stated rules over published figures.
5. **The handoff.** The State issues a directive. Switch account: the Regional Decision Maker now has it, broken into real steps — cohort query, lawful basis, translation, clinical review, channel, pilot, send, monitor.

End on the point: **it closes the loop from a national number to a named person's task.**

## 6. Claims you must not make

This is health equity work about a real disease in a real country. Overclaiming is the fastest way to lose a serious audience, and some of these are also just false.

- **Never present a Region-level pattern as describing individuals.** This is the ecological fallacy and the product warns about it on screen. Across Regions in 2024, higher median income went with *lower* breast-screening attendance, while within Regions women with more education attend *more*. The on-screen wording, which you may quote: *"These are area-level patterns. They tell you where to look, not who is affected."*
- **Do not say the system finds, predicts or diagnoses cancer.** It measures distance from a screening target.
- **Do not claim it identifies individual patients.** It never sees patient-level data. "Patient" actions describe a group of invitees, never a person.
- **Do not claim lives saved, cancers caught, or any outcome.** Nothing has been deployed; there is no result to report.
- **Do not imply official endorsement.** It is not commissioned, endorsed or used by STM, THL, the wellbeing services counties or AstraZeneca. The accounts in the demo (Aino Virtanen, Markus Laine) are **fictional**; if they appear on screen for more than a moment, label them as sample accounts.
- **Do not call the Narratives "AI insights".** Most are Template sentences — a Gap's own numbers filled into fixed wording, exact by construction. Where an LLM writes one, every number in it is checked against the source data and the text is discarded if a number does not match. That check is a better story than "AI" anyway.
- **Do not show the trend line.** It is not built. (Tracked as issue #56.)

## 7. Vocabulary — use these words

From `GLOSSARY.md`. Wrong words here read as not understanding the domain.

| Use | Means | Avoid |
|---|---|---|
| **Region** | One of the 23 areas THL reports on | county, area |
| **Gap** | How far a Region's value sits from its Target, or from other Regions where there is no Target | bottleneck, shortfall, deficit |
| **Target** | A value the National Cancer Strategy commits every Region to reach | goal, benchmark |
| **Severity** | `ok` / `watch` / `act`, set by fixed written thresholds | status, priority, risk |
| **Narrative** | The plain-language sentence a decision-maker reads first | summary, insight, AI text |

"Wellbeing services county" is the legal body; use it only when the legal body matters.

## 8. Visual identity — take it from the product

The UI already has a considered design language. Match it rather than inventing one.

**Type**: Archivo (display/headings), Public Sans (body). Both Google Fonts.

**Colour** — exact tokens:

| Role | Hex |
|---|---|
| Background | `#f6f6f3` |
| Sunk background | `#eeeeea` |
| Card | `#ffffff` |
| Ink (primary text) | `#14181a` |
| Ink secondary | `#565d61` |
| **Brand** (deep magenta) | `#8a1960` |
| Region accent (blue) | `#245fb0` |
| `ok` green | `#1f7a3d` |
| `watch` amber | `#8e6100` |
| `act` red | `#bb3a2d` |

The map's choropleth runs `#feebe2 → #fbb4b9 → #f768a1 → #c51b8a → #7a0177`.

**Feel**: quiet, precise, civic. A government instrument, not a consumer app. Generous whitespace, 14–20px radii, very soft shadows. No gradients on text, no neon, no dark "hacker" aesthetic, no stock photography of doctors.

**Accessibility is part of the design, not an afterthought** — severity is never colour alone, it always carries a text label. If you show a severity state, show its label.

## 9. Assets

- Screenshots at desktop (1440×900) and phone (390×844): `docs/screenshots/`
- Logo: `web/public/logo.png`, `web/public/logo@512.png`
- Live product to capture from: `frontiershealth.xyz` (or `http://localhost:3000` with the stack running)
- Architecture diagram and full build rationale: `BUILD.md`
- Every endpoint with real examples: `docs/api.md`

## 10. Tone

Understated. The figures are strong enough that overselling them weakens the case. The product's own voice is plain sentences and stated reasoning; the video should sound like the product, not like an ad for it.

A good closing line is a true one: *45 indicator readings across 23 Regions need action this year.* No Region is uniformly the problem — which is exactly why this shows each indicator separately rather than one combined score.
