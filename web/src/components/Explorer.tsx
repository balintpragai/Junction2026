"use client";

import { useMemo, useState } from "react";
import { DecisionMap } from "@/components/map/DecisionMap";
import { RegionPanel } from "@/components/region/RegionPanel";
import { RoleGate } from "@/components/RoleGate";
import type { Region, RegionProfile } from "@/lib/api";

/** How the map is shaded. "Indicators needing action" is the overview; the
 *  rest shade by one indicator, which is what you switch to once you want to
 *  know *which* problem is where rather than how many there are. */
interface Metric {
  id: string;
  label: string;
  unit: string;
  value: (p: RegionProfile) => number | null;
  format: (v: number) => string;
  describe: (p: RegionProfile, v: number) => string;
}

function metricsFor(sample: RegionProfile | undefined): Metric[] {
  const overview: Metric = {
    id: "act",
    label: "Indicators needing action",
    unit: "indicators in act",
    value: (p) => p.summary.indicators_act,
    format: (v) => String(Math.round(v)),
    describe: (p, v) => `${p.region.name} — ${v} of ${p.summary.indicators_tracked} indicators need action`,
  };
  if (!sample) return [overview];

  const perIndicator: Metric[] = sample.gaps.map((g) => ({
    id: g.indicator.code,
    label: g.indicator.name,
    unit: g.indicator.unit,
    value: (p) => p.gaps.find((x) => x.indicator.code === g.indicator.code)?.gap.value ?? null,
    format: (v) => (g.indicator.unit.startsWith("%") ? `${v.toFixed(0)}%` : v.toFixed(1)),
    describe: (p, v) => {
      const entry = p.gaps.find((x) => x.indicator.code === g.indicator.code);
      const suffix = g.indicator.unit.startsWith("%") ? "%" : ` ${g.indicator.unit}`;
      return `${p.region.name} — ${g.indicator.name}: ${v}${suffix}${entry ? ` (rank ${entry.gap.rank} of ${entry.gap.n_regions})` : ""}`;
    },
  }));

  return [overview, ...perIndicator];
}

/** The Decision Map: the product's front door. Every Region on one screen,
 *  shaded by whichever measure is in question, with the selected Region's
 *  full profile beside it. State Decision Makers only — a Regional account
 *  has no business reading 22 other Regions' performance. */
export function Explorer({ regions, profiles }: { regions: Region[]; profiles: Map<string, RegionProfile> }) {
  const [selected, setSelected] = useState<string>(regions[0]?.code ?? "");
  const [metricId, setMetricId] = useState("act");
  const [query, setQuery] = useState("");

  const metrics = useMemo(() => metricsFor(profiles.values().next().value), [profiles]);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const current = profiles.get(selected);

  const worst = useMemo(() => {
    let best: RegionProfile | null = null;
    for (const p of profiles.values()) {
      if (!best || p.summary.indicators_act > best.summary.indicators_act) best = p;
    }
    return best;
  }, [profiles]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return regions.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, regions]);

  const totalAct = useMemo(() => {
    let n = 0;
    for (const p of profiles.values()) n += p.summary.indicators_act;
    return n;
  }, [profiles]);

  return (
    <RoleGate allow="state">
      <header style={{ marginBottom: 18 }}>
        <p className="eyebrow">Decision Map</p>
        <h1 style={{ fontSize: "clamp(1.7rem, 3vw, 2.2rem)", marginTop: 7 }}>
          Where cancer care falls short of target
        </h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Every Region in Finland, shaded by the measure you choose. {totalAct} indicator readings across{" "}
          {profiles.size} Regions currently sit in <strong>act</strong>. No Region is uniformly the problem — click one
          to see which indicators, specifically, and what the data says is behind them.
        </p>
      </header>

      {/* Controls sit in one row above the map, never floating over it. */}
      <div
        className="card"
        style={{ padding: "11px 14px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}
      >
        <label className="row" style={{ gap: 8 }}>
          <span className="section-title" style={{ fontSize: 11 }}>
            Shade by
          </span>
          <select value={metricId} onChange={(e) => setMetricId(e.target.value)} style={{ padding: "7px 10px", fontSize: 13 }}>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ position: "relative", minWidth: 210, flex: "1 1 210px", maxWidth: 320 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a Region…"
            aria-label="Find a Region"
            style={{ width: "100%", padding: "7px 11px", fontSize: 13 }}
          />
          {matches.length > 0 && (
            <div className="card-lg" style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 30, padding: 5, boxShadow: "var(--shadow-pop)" }}>
              {matches.map((r) => (
                <button
                  key={r.code}
                  onClick={() => {
                    setSelected(r.code);
                    setQuery("");
                  }}
                  style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", borderRadius: 7, padding: "7px 9px", fontSize: 13, cursor: "pointer" }}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {worst && (
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => setSelected(worst.region.code)}
            style={{ marginLeft: "auto" }}
          >
            Most in act: <strong style={{ color: "var(--act)" }}>{worst.region.name}</strong> ({worst.summary.indicators_act})
          </button>
        )}
      </div>

      <div
        className="decision-grid"
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 22, alignItems: "flex-start" }}
      >
        <div className="decision-map-col" style={{ position: "sticky", top: 78 }}>
          <div className="card-lg" style={{ padding: 10 }}>
            <DecisionMap
              regions={regions}
              value={(code) => {
                const p = profiles.get(code);
                return p ? metric.value(p) : null;
              }}
              label={(code) => {
                const p = profiles.get(code);
                if (!p) return "No data";
                const v = metric.value(p);
                return v == null ? `${p.region.name} — no data` : metric.describe(p, v);
              }}
              unit={metric.unit}
              formatTick={metric.format}
              selected={selected}
              onSelect={setSelected}
              height={580}
            />
          </div>
        </div>

        <div>
          {current ? (
            <RegionPanel profile={current} all={profiles} onPick={setSelected} />
          ) : (
            <p style={{ color: "var(--ink-3)" }}>Select a Region on the map.</p>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1080px) {
          .decision-grid { grid-template-columns: 1fr !important; }
          .decision-map-col { position: static !important; }
        }
      `}</style>
    </RoleGate>
  );
}
