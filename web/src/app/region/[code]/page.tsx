import Link from "next/link";
import { notFound } from "next/navigation";
import { loadRegionProfile } from "@/lib/api";
import { IndicatorCard } from "@/components/IndicatorCard";

export const dynamic = "force-dynamic";

export default async function RegionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = await loadRegionProfile(code);
  if (!profile) notFound();

  const { region, summary, synthesis, gaps, covariates, covariate_meta } = profile;

  return (
    <div>
      <Link href="/" style={{ fontSize: 13, color: "var(--ink-2)", textDecoration: "none" }}>
        ← Overview
      </Link>

      <header style={{ marginTop: 12, marginBottom: 20 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Region profile
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>{region.name}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
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
          padding: "20px 22px",
          marginBottom: 28,
        }}
      >
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--brand)", fontWeight: 700, marginBottom: 10 }}>
          What the data says
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {synthesis.map((s, i) => (
            <p key={i} style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}>
              {s}
            </p>
          ))}
        </div>
        <Link
          href={`/region/${region.code}/actions`}
          style={{
            display: "inline-flex",
            marginTop: 16,
            background: "var(--ink)",
            color: "var(--card)",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 650,
            textDecoration: "none",
          }}
        >
          Explore actions →
        </Link>
      </section>

      <h2 style={{ fontSize: 15, marginBottom: 14 }}>Indicators tracked</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 32 }}>
        {gaps.map((entry) => (
          <IndicatorCard key={entry.indicator.code} entry={entry} />
        ))}
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 14 }}>Structural context (covariates)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {Object.entries(covariates).map(([key, value]) => {
          const meta = covariate_meta[key];
          const aboveMedian = value > meta.median;
          return (
            <div key={key} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
              <p style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{meta.name}</p>
              <p className="mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {value}
                {meta.unit.startsWith("%") ? "%" : ` ${meta.unit}`}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
                National median: {meta.median}
                {meta.unit.startsWith("%") ? "%" : ` ${meta.unit}`} ({aboveMedian ? "above" : "at or below"})
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
