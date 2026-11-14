import Link from "next/link";
import type { RegionProfile } from "@/lib/api";
import { IndicatorCard } from "@/components/IndicatorCard";

/** The region profile's content -- written out, not a new page. Used inline
 *  in the Explorer (map click updates this panel in place) so a decision-
 *  maker can click through every Region without ever leaving the map. */
export function RegionDetail({ profile }: { profile: RegionProfile }) {
  const { region, summary, synthesis, gaps, covariates, covariate_meta } = profile;

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Region profile
        </p>
        <h2 style={{ fontSize: "1.6rem", marginTop: 6 }}>{region.name}</h2>
        <p style={{ color: "var(--ink-2)", marginTop: 6, fontSize: 14 }}>
          {summary.indicators_act > 0 || summary.indicators_watch > 0
            ? `${summary.indicators_act} of ${summary.indicators_tracked} tracked indicators need action, ${summary.indicators_watch} more are close.`
            : `All ${summary.indicators_tracked} tracked indicators are at or ahead of target.`}
        </p>
      </header>

      <section
        style={{
          background: "var(--brand-soft)",
          border: "1px solid var(--brand-line)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 20px",
          marginBottom: 22,
        }}
      >
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--brand)", fontWeight: 700, marginBottom: 8 }}>
          What the data says
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {synthesis.map((s, i) => (
            <p key={i} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}>
              {s}
            </p>
          ))}
        </div>
        <Link
          href={`/region/${region.code}/actions`}
          style={{
            display: "inline-flex",
            marginTop: 14,
            background: "var(--ink)",
            color: "var(--card)",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 13.5,
            fontWeight: 650,
            textDecoration: "none",
          }}
        >
          Explore actions →
        </Link>
      </section>

      <h3 style={{ fontSize: 13.5, marginBottom: 12 }}>Indicators tracked</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12, marginBottom: 24 }}>
        {gaps.map((entry) => (
          <IndicatorCard key={entry.indicator.code} entry={entry} />
        ))}
      </div>

      <h3 style={{ fontSize: 13.5, marginBottom: 12 }}>Structural context (covariates)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        {Object.entries(covariates).map(([key, value]) => {
          const meta = covariate_meta[key];
          const aboveMedian = value > meta.median;
          return (
            <div key={key} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{meta.name}</p>
              <p className="mono" style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>
                {value}
                {meta.unit.startsWith("%") ? "%" : ` ${meta.unit}`}
              </p>
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                Median: {meta.median}
                {meta.unit.startsWith("%") ? "%" : ` ${meta.unit}`} ({aboveMedian ? "above" : "at/below"})
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
