"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RegionProfile } from "@/lib/api";
import { RadarChart } from "@/components/viz/RadarChart";
import { RankStrip } from "@/components/viz/RankStrip";
import { buildAxes } from "@/lib/viz";
import { useProgram, progressOf } from "@/lib/program";

/** Everything known about one Region, in the order a decision maker reads
 *  it: what the Narrative says, then the comparison, then the structural
 *  context underneath.
 *
 *  This used to be four tabs over the same five numbers, which meant three
 *  quarters of what the panel knew was hidden at any moment and you had to
 *  remember which tab held what. It is one column now; nothing is behind a
 *  mode. */
export function RegionPanel({
  profile,
  all,
  onPick,
}: {
  profile: RegionProfile;
  all: Map<string, RegionProfile>;
  onPick: (code: string) => void;
}) {
  const { region, summary, synthesis, covariates, covariate_meta } = profile;
  const axes = useMemo(() => buildAxes(profile, all), [profile, all]);
  const { visibleDirectives } = useProgram();
  const live = visibleDirectives.filter((d) => d.regionCode === region.code);

  return (
    <div className="col" style={{ gap: 20 }}>
      <header>
        <h2 style={{ fontSize: "1.5rem" }}>{region.name}</h2>
        <p style={{ marginTop: 5, fontSize: 13, color: "var(--ink-2)" }}>
          Of {summary.indicators_tracked} indicators tracked in {profile.year},{" "}
          <strong style={{ color: summary.indicators_act > 0 ? "var(--act)" : "var(--good)" }}>
            {summary.indicators_act} {summary.indicators_act === 1 ? "Gap needs" : "Gaps need"} action
          </strong>
          {summary.indicators_watch > 0 && (
            <>
              {" "}
              and {summary.indicators_watch} {summary.indicators_watch === 1 ? "is" : "are"} worth watching
            </>
          )}
          .
        </p>
      </header>

      <section
        style={{
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 20px",
        }}
      >
        <h3 style={{ fontSize: 12.5, color: "var(--brand)", marginBottom: 9, letterSpacing: 0 }}>What the data says</h3>
        <div className="col" style={{ gap: 8 }}>
          {synthesis.map((s, i) => (
            <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink)" }}>
              {s}
            </p>
          ))}
        </div>
        <div className="row" style={{ marginTop: 15, gap: 10, flexWrap: "wrap" }}>
          <Link href={`/region/${region.code}/actions`} className="btn btn-dark">
            Explore actions
          </Link>
          {live.length > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
              {live.length} directive{live.length > 1 ? "s are" : " is"} already running here, on average{" "}
              {Math.round(live.reduce((s, d) => s + progressOf(d).pct, 0) / live.length)}% complete.
            </span>
          )}
        </div>
      </section>

      <section className="card-lg" style={{ padding: 20 }}>
        <RadarChart axes={axes} regionName={shortName(region.name)} />
      </section>

      <section className="card-lg" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Every Region, indicator by indicator</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 16, maxWidth: "70ch" }}>
          The shape above compares this Region with the median. This compares it with all of them, which is what says
          whether a Gap is local or national.
        </p>
        <RankStrip profile={profile} all={all} onPick={onPick} />
      </section>

      <section className="card-lg" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Structural context</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10, maxWidth: "70ch" }}>
          Factors that might explain a Gap rather than measure one, shown against the national median because a
          number like 19.6% only means something next to what is normal.
        </p>
        {/* Required wherever a covariate appears, and deliberately not
            collapsible: a Region-level pattern can reverse at the individual
            level, so the caveat has to be as visible as the numbers. The
            wording comes from the api, which is its single home. */}
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ink-2)",
            background: "var(--watch-soft)",
            border: "1px solid var(--watch-line)",
            borderRadius: 9,
            padding: "9px 12px",
            marginBottom: 16,
            maxWidth: "70ch",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>Read these as a signal, not a cause.</strong>{" "}
          {profile.covariate_caveat.short}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {Object.entries(covariates).map(([key, value]) => {
            const meta = covariate_meta[key];
            const above = value > meta.median;
            const suffix = meta.unit.startsWith("%") ? "%" : ` ${meta.unit}`;
            const ratio = meta.median === 0 ? 1 : value / meta.median;
            return (
              <div key={key} className="card" style={{ padding: "14px 15px" }}>
                <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.35 }}>{meta.name}</p>
                <p className="num" style={{ fontSize: 22, marginTop: 5 }}>
                  {value}
                  {suffix}
                </p>
                <div
                  aria-hidden="true"
                  style={{ position: "relative", height: 6, borderRadius: 999, background: "var(--bg-sunk)", marginTop: 9 }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${Math.min(100, (ratio / 2) * 100)}%`,
                      borderRadius: 999,
                      background: above ? "var(--accent)" : "var(--line-strong)",
                    }}
                  />
                  <div style={{ position: "absolute", left: "50%", top: -3, width: 2, height: 12, background: "var(--ink-2)" }} />
                </div>
                <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 7 }}>
                  <strong style={{ color: above ? "var(--accent)" : "var(--ink-2)" }}>
                    {above ? "Above" : "At or below"}
                  </strong>{" "}
                  the {meta.median}
                  {suffix} national median
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {profile.missing_data_notes.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--watch)", background: "var(--watch-soft)", border: "1px solid var(--watch-line)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
          {profile.missing_data_notes.join(" ")}
        </p>
      )}
    </div>
  );
}

function shortName(name: string): string {
  return name.replace(/ wellbeing services county$/, "").replace(/^City of /, "");
}
