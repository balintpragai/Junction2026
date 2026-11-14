# Covariate correlations: what structurally predicts the gaps we found

**Method:** pulled real covariate data from Statistics Finland (StatFin PxWeb API), aggregated from municipality level (308 municipalities) up to the 23 wellbeing services counties using the municipality→county `memberOf` mapping in `data/raw/sotkanet_regions.json` (population-weighted averages for rates; sums for counts). Joined against our existing 2024 outcome data and computed Pearson correlation coefficients. New files:

- `data/processed/covariates_immigrant_background_by_wellbeing_county.csv` — % foreign-language speakers, % foreign background, by county. Source: StatFin `vaerak/159t.px`.
- `data/processed/covariates_income_poverty_by_wellbeing_county.csv` — median disposable income per consumption unit, at-risk-of-poverty rate, by county. Source: StatFin `tjt/14ww.px`.

**Years:** the correlations below were computed with the 2024 immigrant-background values and the 2023 income values (then the latest published). Since #50 both files hold every year from 2016 (immigrant background to 2025, income to 2024), rebuilt by `scripts/build_statfin_covariates.py` with the same method; the 2024 and 2023 values used here are unchanged. The results have not been recomputed with 2024 income.

**Caveat up front, in line with how we've treated every other number this session:** n=22–23 counties. This is directional and illustrative, not statistically powered — treat it as "worth investigating further," not proof. It's one step more rigorous than asserting a relationship without checking it, which is the actual bar this analysis needs to clear.

## Results

**Against 2024 breast-screening attendance (n=22 counties):**
| Covariate | r |
|---|---|
| % foreign background | **−0.851** |
| % foreign-language speakers | **−0.854** |
| Median disposable income | **−0.806** |
| At-risk-of-poverty rate | +0.484 |

**Against 2024 long-wait (>6mo) prevalence (n=17 counties):**
| Covariate | r |
|---|---|
| % foreign background | −0.162 |
| % foreign-language speakers | −0.146 |
| Median disposable income | −0.145 |
| At-risk-of-poverty rate | +0.265 |

## Reading this correctly — the income number is a trap, not a finding

Taken at face value, "median income correlates −0.81 with screening attendance" reads as "richer counties screen less," which would **contradict** the Cancer Registry's own individual-level data (`cancer_registry_screening_reports.md` §3): within every county, higher-education and domestic-born women screen *more*, not less, at every age band.

Both are correct — they're answering different questions, and this is a textbook **ecological fallacy**: a relationship that holds across counties can run in the opposite direction from the relationship that holds across individuals within those counties. Here's the actual mechanism: Finland's wealthiest counties (Helsinki, West Uusimaa, Vantaa & Kerava) are also its most urban and most immigrant-dense. Immigrant concentration has such a strong, consistent negative pull on *aggregate* county attendance that it outweighs the income effect in the county-level average — even though, person by person, higher income still predicts higher attendance. Income's county-level sign should be **ignored**; its individual-level sign (from the Cancer Registry data) is the trustworthy one.

**% foreign background / foreign-language is the one covariate that's consistent in both directions** — strong negative at the county level (here) *and* strong negative at the individual level (Cancer Registry: Finland ~83% vs. Africa-born ~28–53%). This convergence is what makes it a genuinely defensible policy target, unlike income, which only looks that way until you check the other dataset.

## The long-wait indicator doesn't follow the same story

All four correlations against the long-wait metric are weak (|r| ≤ 0.27) — none of these demographic/economic covariates meaningfully explain *which* counties have long specialised-care waits. That's a real, useful null result: it suggests the long-wait gap (North Savo worst, South Karelia best) is driven by something structural on the **supply side** — local staffing, capacity, management — rather than the **demand side** (who's asking for care and how easily). These are two different problems needing two different interventions: outreach/equity targeting won't fix a capacity problem, and more capacity won't fix an outreach problem. A gap-finder that reports both numbers side by side without implying one explains the other is being honest about this; one that conflates them would be making an unsupported claim.

## What this means for the pitch

1. **Targeting by county alone is a weak proxy; targeting by (county, immigrant-background share) is a much stronger, double-confirmed signal** — defensible from both the ecological (this analysis) and individual (Cancer Registry) angles.
2. **Don't use income/poverty rate as a targeting variable at the county level** — it's confounded here, and using it would risk the exact "unsupported assumption" the data-quality judging criterion penalizes, even though it looks statistically significant.
3. **The long-wait problem needs a different recommended action than the screening-attendance problem** — this is now evidence-backed, not just a structural assumption from the pathway-stage framing.
