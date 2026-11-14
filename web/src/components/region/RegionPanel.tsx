"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RegionProfile } from "@/lib/api";
import { IndicatorCard } from "@/components/IndicatorCard";
import { RadarChart } from "@/components/viz/RadarChart";
import { RankStrip } from "@/components/viz/RankStrip";
import { buildAxes } from "@/lib/viz";
import { useProgram, progressOf } from "@/lib/program";

type Tab = "shape" | "peers" | "indicators" | "context";

const TABS: { id: Tab; label: string }[] = [
  { id: "shape", label: "Profile shape" },
  { id: "peers", label: "Against other Regions" },
  { id: "indicators", label: "Indicator detail" },
  { id: "context", label: "Structural context" },
];

/** Everything known about one Region, in the order a decision maker reads
 *  it: what the summary says, then the pictures that back it up, then the
 *  numbers underneath. Updates in place when the map selection changes --
 *  no navigation, so clicking through 23 Regions costs nothing. */
export function RegionPanel({
  profile,
  all,
  onPick,
}: {
  profile: RegionProfile;
  all: Map<string, RegionProfile>;
  onPick: (code: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("shape");
  const { region, summary, synthesis, gaps, covariates, covariate_meta } = profile;
  const axes = useMemo(() => buildAxes(profile, all), [profile, all]);
  const { visibleDirectives } = useProgram();
  const live = visibleDirectives.filter((d) => d.regionCode === region.code);

  return (
    <div className="col" style={{ gap: 18 }}>
      <header>
        <h2 style={{ fontSize: "1.5rem" }}>{region.name}</h2>
        <p style={{ marginTop: 5, fontSize: 13, color: "var(--ink-2)" }}>
          Of {summary.indicators_tracked} indicators tracked in {profile.year},{" "}
          <strong style={{ color: summary.indicators_act > 0 ? "var(--act)" : "var(--good)" }}>
            {summary.indicators_act} {summary.indicators_act === 1 ? "needs" : "need"} action
          </strong>
          {summary.indicators_watch > 0 && (
            <>
              {" "}
              and {summary.indicators_watch} {summary.indicators_watch === 1 ? "is" : "are"} close to target
            </>
          )}
          .
        </p>
      </header>

      {/* The summary description: the main thing on this panel, which is why
          it gets the accent surface and sits above every chart. */}
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

      {/* Infographics */}
      <section className="card-lg" style={{ overflow: "hidden" }}>
        <div
          role="tablist"
          aria-label="Region infographics"
          style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg)", overflowX: "auto" }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  border: "none",
                  background: active ? "var(--card)" : "transparent",
                  padding: "11px 16px",
                  fontSize: 12.5,
                  fontWeight: active ? 650 : 500,
                  color: active ? "var(--ink)" : "var(--ink-2)",
                  cursor: "pointer",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 20 }}>
          {tab === "shape" && <RadarChart axes={axes} regionName={shortName(region.name)} />}
          {tab === "peers" && <RankStrip profile={profile} all={all} onPick={onPick} />}
          {tab === "indicators" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {gaps.map((entry) => (
                <IndicatorCard key={entry.indicator.code} entry={entry} />
              ))}
            </div>
          )}
          {tab === "context" && (
            <div className="col" style={{ gap: 14 }}>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: "68ch" }}>
                Structural factors that might explain a Gap rather than measure one. They are shown against the
                national median because a number like &ldquo;19.6%&rdquo; only means something next to what is normal.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
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
            </div>
          )}
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
