"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DecisionMap } from "@/components/map/DecisionMap";
import { RegionTable } from "@/components/RegionTable";
import { RegionPanel } from "@/components/region/RegionPanel";
import { RoleGate } from "@/components/RoleGate";
import type { Region, RegionProfile } from "@/lib/api";
import { useLang } from "@/lib/lang";
import type { Lang } from "@/lib/i18n";
import { tf as format, unitLabel, fmtNumber } from "@/lib/i18n";
import { regionName, indicatorName } from "@/lib/fi-data";
import { regionShort } from "@/lib/fi-short";

/** How the map is shaded. "Indicators needing action" is the overview; the
 *  rest shade by one indicator, which is what you switch to once you want
 *  to know *which* problem is where rather than how many there are. */
interface Metric {
  id: string;
  label: string;
  unit: string;
  value: (p: RegionProfile) => number | null;
  format: (v: number) => string;
  describe: (p: RegionProfile, v: number) => string;
}

function metricsFor(sample: RegionProfile | undefined, lang: Lang, t: (en: string) => string): Metric[] {
  const overview: Metric = {
    id: "act",
    label: t("Indicators needing action"),
    unit: t("indicators needing action"),
    value: (p) => p.summary.indicators_act,
    format: (v) => String(Math.round(v)),
    describe: (p, v) =>
      `${regionName(p.region.code, p.region.name, lang)} — ` +
      format(lang, "{v} of {n} indicators need action", { v, n: p.summary.indicators_tracked }),
  };
  if (!sample) return [overview];

  return [
    overview,
    ...sample.gaps.map((g) => ({
      id: g.indicator.code,
      label: indicatorName(g.indicator.code, g.indicator.name, lang),
      unit: g.indicator.unit,
      value: (p: RegionProfile) => p.gaps.find((x) => x.indicator.code === g.indicator.code)?.gap.value ?? null,
      format: (v: number) => (g.indicator.unit.startsWith("%") ? `${v.toFixed(0)}%` : v.toFixed(1)),
      describe: (p: RegionProfile, v: number) => {
        const entry = p.gaps.find((x) => x.indicator.code === g.indicator.code);
        const suffix = g.indicator.unit.startsWith("%") ? "%" : ` ${unitLabel(g.indicator.unit, lang)}`;
        const head = `${regionName(p.region.code, p.region.name, lang)} — ${indicatorName(g.indicator.code, g.indicator.name, lang)} ${fmtNumber(v, lang)}${suffix}`;
        return entry ? head + format(lang, ", ranked {rank} of {n}", { rank: entry.gap.rank, n: entry.gap.n_regions }) : head;
      },
    })),
  ];
}

/** The Decision Map: the product's front door. Every Region at once, shaded
 *  by whichever measure is in question, with the selected Region's profile
 *  beside it. The map answers "where"; the table beside it answers "which
 *  are worst", which a map cannot.
 *
 *  State Decision Makers only — a Regional account has no business reading
 *  22 other Regions' performance. */
export function Explorer({ regions, profiles }: { regions: Region[]; profiles: Map<string, RegionProfile> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const { lang, t, tf } = useLang();

  // Selection and shading live in the URL, so a view can be linked and
  // survives a reload. `replace`, not `push`: clicking twenty Regions
  // should not bury the back button under twenty entries.
  const selected = params.get("region") ?? regions[0]?.code ?? "";
  const metricId = params.get("by") ?? "act";
  const view = params.get("view") === "table" ? "table" : "map";

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      next.set(key, value);
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );
  const setSelected = useCallback((code: string) => setParam("region", code), [setParam]);

  const metrics = useMemo(() => metricsFor(profiles.values().next().value, lang, t), [profiles, lang, t]);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const current = profiles.get(selected);

  const { worst, totalAct } = useMemo(() => {
    let w: RegionProfile | null = null;
    let n = 0;
    for (const p of profiles.values()) {
      n += p.summary.indicators_act;
      if (!w || p.summary.indicators_act > w.summary.indicators_act) w = p;
    }
    return { worst: w, totalAct: n };
  }, [profiles]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Match either language's name, so searching "Pohjois-Savo" works while
    // the interface is in English and "North Savo" while it is in Finnish.
    return regions
      .filter((r) => {
        const names = [r.name, regionName(r.code, r.name, "fi"), regionShort(r.code, r.name, "fi")];
        return names.some((n) => n.toLowerCase().includes(q));
      })
      .slice(0, 6);
  }, [query, regions]);

  return (
    <RoleGate allow="state">
      {/* No visible headline. A console opens on the work, not on a title
          card explaining it — the explanation sits at the foot of the page
          for whoever wants it. The h1 stays for the document outline. */}
      <h1 className="sr-only">{t("Decision map: where cancer care falls short of target")}</h1>

      <div
        style={{
          position: "sticky",
          top: 60,
          zIndex: 20,
          background: "var(--bg)",
          paddingBlock: 10,
          marginTop: -10,
          marginBottom: 12,
        }}
      >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px 12px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}
      >
        <ViewToggle view={view} onChange={(v) => setParam("view", v)} />

        <span className="toolbar-rule" style={{ width: 1, height: 22, background: "var(--line)" }} aria-hidden="true" />

        {/* The longest option is a full indicator name, which is wider than a
            phone. Let the label shrink and the select truncate, or the whole
            page gains a horizontal scrollbar. */}
        <label className="row" style={{ gap: 8, minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{t("Shade by")}</span>
          <select
            value={metricId}
            onChange={(e) => setParam("by", e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13, minHeight: 34, minWidth: 0, maxWidth: "100%", flex: "1 1 auto" }}
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ position: "relative", minWidth: 190, flex: "1 1 190px", maxWidth: 300 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Find a Region")}
            aria-label={t("Find a Region by name")}
            style={{ width: "100%", padding: "7px 11px", fontSize: 13, minHeight: 34 }}
          />
          {matches.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                left: 0,
                right: 0,
                zIndex: 30,
                padding: 5,
                background: "var(--card)",
                border: "1px solid var(--line-strong)",
                borderRadius: 10,
                boxShadow: "var(--shadow-pop)",
              }}
            >
              {matches.map((r) => (
                <button
                  key={r.code}
                  onClick={() => {
                    setSelected(r.code);
                    setQuery("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    minHeight: 32,
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    borderRadius: 7,
                    padding: "7px 9px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {regionName(r.code, r.name, lang)}
                </button>
              ))}
            </div>
          )}
        </div>

        {worst && (
          <button
            onClick={() => setSelected(worst.region.code)}
            style={{
              marginLeft: "auto",
              minHeight: 34,
              padding: "6px 10px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "transparent",
              fontSize: 12.5,
              color: "var(--ink-2)",
              cursor: "pointer",
            }}
          >
            {t("Worst overall is")}{" "}
            <strong style={{ color: "var(--act)" }}>
              {regionShort(worst.region.code, worst.region.name, lang)}
            </strong>
            , {tf("with {n}", { n: worst.summary.indicators_act })}
          </button>
        )}
      </div>
      </div>

      {view === "table" ? (
        <div className="col" style={{ gap: 18 }}>
          <RegionTable regions={regions} profiles={profiles} selected={selected} onSelect={setSelected} />
          {current && <RegionPanel profile={current} all={profiles} onPick={setSelected} />}
        </div>
      ) : (
        <div
          className="explorer-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 22, alignItems: "flex-start" }}
        >
          {/* On a narrow screen the map stacks above the panel, which breaks
              the interaction: a click updates content the reader cannot see.
              There it becomes a shorter, scroll-with-the-page strip and the
              profile follows immediately underneath. */}
          <div className="explorer-map" style={{ position: "sticky", top: 16 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 10, boxShadow: "var(--shadow-card)" }}>
              <DecisionMap
                regions={regions}
                value={(code) => {
                  const p = profiles.get(code);
                  return p ? metric.value(p) : null;
                }}
                label={(code) => {
                  const p = profiles.get(code);
                  if (!p) return t("No data");
                  const v = metric.value(p);
                  return v == null
                    ? tf("{region} has no reading", { region: regionName(p.region.code, p.region.name, lang) })
                    : metric.describe(p, v);
                }}
                unit={metric.unit}
                formatTick={metric.format}
                selected={selected}
                onSelect={setSelected}
                height="clamp(360px, calc(100vh - 190px), 780px)"
              />
            </div>
          </div>

          <div>
            {current ? (
              <RegionPanel profile={current} all={profiles} onPick={setSelected} />
            ) : (
              <p style={{ color: "var(--ink-3)" }}>{t("Pick a Region on the map.")}</p>
            )}
          </div>
        </div>
      )}

      <p
        style={{
          marginTop: 28,
          paddingTop: 14,
          borderTop: "1px solid var(--line)",
          fontSize: 12.5,
          color: "var(--ink-3)",
          maxWidth: "80ch",
          lineHeight: 1.55,
        }}
      >
        {tf(
          "{total} indicator readings across {n} Regions need action this year. No Region is uniformly the problem, which is why this shows each indicator separately rather than one combined score.",
          { total: totalAct, n: profiles.size },
        )}
      </p>

      <style>{`
        @media (max-width: 1080px) {
          .explorer-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .explorer-map { position: static !important; }
          .explorer-map > div { padding: 6px !important; }
        }
      `}</style>
    </RoleGate>
  );
}

function ViewToggle({ view, onChange }: { view: string; onChange: (v: string) => void }) {
  const { t } = useLang();
  return (
    <div
      role="group"
      aria-label={t("View")}
      style={{ display: "flex", gap: 2, padding: 2, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9 }}
    >
      {(["map", "table"] as const).map((v) => {
        const on = view === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={on}
            style={{
              minHeight: 30,
              padding: "5px 13px",
              border: "none",
              borderRadius: 7,
              background: on ? "var(--card)" : "transparent",
              boxShadow: on ? "0 1px 2px rgba(18,22,26,0.1)" : "none",
              color: on ? "var(--ink)" : "var(--ink-2)",
              fontWeight: on ? 650 : 450,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {v === "map" ? t("Map") : t("Table")}
          </button>
        );
      })}
    </div>
  );
}
