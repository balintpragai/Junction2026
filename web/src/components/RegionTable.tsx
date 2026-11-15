"use client";

import { useMemo, useState } from "react";
import type { Region, RegionProfile, Severity } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { regionName, indicatorName } from "@/lib/fi-data";
import { regionShort, indicatorShort } from "@/lib/fi-short";
import { unitLabel, fmtNumber } from "@/lib/i18n";

const SEVERITY_COLOR: Record<Severity, string> = {
  ok: "var(--good)",
  watch: "var(--watch)",
  act: "var(--act)",
};

/** A map shows where something is. It cannot answer "which eight Regions
 *  are worst on cervical screening" — for that you need to sort a column.
 *  This is the same data as the map, ranked.
 *
 *  Severity is carried by a letter and a tooltip as well as a colour, so
 *  the ranking survives colour-blindness and a black-and-white printout. */
export function RegionTable({
  regions,
  profiles,
  selected,
  onSelect,
}: {
  regions: Region[];
  profiles: Map<string, RegionProfile>;
  selected: string;
  onSelect: (code: string) => void;
}) {
  // The union across every Region, not the first Region's list: Helsinki
  // has no 2024 reading for two indicators, so taking its gaps as the
  // column set silently dropped those columns for all 23.
  const indicators = useMemo(() => {
    const seen = new Map<string, RegionProfile["gaps"][number]["indicator"]>();
    for (const p of profiles.values()) {
      for (const g of p.gaps) if (!seen.has(g.indicator.code)) seen.set(g.indicator.code, g.indicator);
    }
    return [...seen.values()];
  }, [profiles]);

  const { lang, t, tf } = useLang();
  const [sortKey, setSortKey] = useState<string>("act");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const list = regions
      .map((r) => profiles.get(r.code))
      .filter((p): p is RegionProfile => Boolean(p));

    const value = (p: RegionProfile) => {
      if (sortKey === "name") return regionName(p.region.code, p.region.name, lang);
      if (sortKey === "act") return p.summary.indicators_act;
      const g = p.gaps.find((x) => x.indicator.code === sortKey);
      if (!g) return null;
      // Sorting always runs worst-first regardless of which direction the
      // indicator points, so one click means the same thing in every column.
      return g.indicator.higher_is_better ? -g.gap.value : g.gap.value;
    };

    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      // localeCompare with the active language so ä and ö sort where a
      // Finnish reader expects them, at the end rather than beside a and o.
      const cmp =
        typeof va === "string" ? va.localeCompare(vb as string, lang) : (va as number) - (vb as number);
      return asc ? cmp : -cmp;
    });
  }, [regions, profiles, sortKey, asc, lang]);

  function sortBy(key: string) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "name");
    }
  }

  return (
    <div className="panel-table" style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <caption style={{ captionSide: "top", textAlign: "left", padding: "13px 16px 11px", color: "var(--ink-2)", fontSize: 12.5 }}>
          {tf("All {n} Regions, sorted worst first. Click a column to re-rank, or a row to open that Region.", {
            n: rows.length,
          })}
        </caption>
        <thead>
          <tr style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            <Th label={t("Region")} onClick={() => sortBy("name")} active={sortKey === "name"} asc={asc} align="left" sticky />
            <Th label={t("Need action")} onClick={() => sortBy("act")} active={sortKey === "act"} asc={asc} />
            {indicators.map((ind) => (
              <Th
                key={ind.code}
                label={indicatorShort(ind.code, ind.name, lang)}
                title={`${indicatorName(ind.code, ind.name, lang)} (${unitLabel(ind.unit, lang)})`}
                onClick={() => sortBy(ind.code)}
                active={sortKey === ind.code}
                asc={asc}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const on = p.region.code === selected;
            return (
              <tr
                key={p.region.code}
                onClick={() => onSelect(p.region.code)}
                tabIndex={0}
                aria-selected={on}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.region.code);
                  }
                }}
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: on ? "var(--brand-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "9px 16px", fontWeight: on ? 650 : 450, whiteSpace: "nowrap" }}>
                  {regionShort(p.region.code, p.region.name, lang)}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>
                  <span
                    className="tnum"
                    style={{
                      fontWeight: 650,
                      color: p.summary.indicators_act > 0 ? "var(--act)" : "var(--good)",
                    }}
                  >
                    {p.summary.indicators_act}
                  </span>
                  <span style={{ color: "var(--ink-3)", fontSize: 11 }}> / {p.summary.indicators_tracked}</span>
                </td>
                {indicators.map((ind) => {
                  const g = p.gaps.find((x) => x.indicator.code === ind.code);
                  if (!g) {
                    return (
                      <td key={ind.code} style={{ padding: "9px 10px", textAlign: "center", color: "var(--ink-3)" }} title={t("No 2024 data")}>
                        –
                      </td>
                    );
                  }
                  const sev = g.gap.severity;
                  return (
                    <td key={ind.code} style={{ padding: "9px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <span
                        className="tnum"
                        style={{ fontWeight: sev === "act" ? 650 : 450, color: sev === "act" ? "var(--act)" : "var(--ink)" }}
                      >
                        {fmtNumber(g.gap.value, lang)}
                      </span>
                      <abbr
                        title={`${
                          sev === "ok" ? t("At or ahead of target") : sev === "watch" ? t("Close to target") : t("Needs action")
                        } — ${tf("rank {rank} of {n}", { rank: g.gap.rank, n: g.gap.n_regions })}`}
                        style={{
                          marginLeft: 5,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: SEVERITY_COLOR[sev],
                          textDecoration: "none",
                          borderBottom: "none",
                        }}
                      >
                        {sev === "ok" ? t("OK") : sev === "watch" ? t("W") : t("A")}
                      </abbr>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  title,
  onClick,
  active,
  asc,
  align = "center",
  sticky,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  active: boolean;
  asc: boolean;
  align?: "left" | "center";
  sticky?: boolean;
}) {
  const { tf } = useLang();
  return (
    <th
      scope="col"
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      style={{
        padding: 0,
        textAlign: align,
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: "var(--card)",
      }}
    >
      <button
        onClick={onClick}
        title={title ?? tf("Sort by {label}", { label })}
        style={{
          width: "100%",
          minHeight: 34,
          padding: align === "left" ? "8px 16px" : "8px 10px",
          border: "none",
          background: "transparent",
          font: "inherit",
          fontSize: 11.5,
          fontWeight: active ? 650 : 500,
          color: active ? "var(--ink)" : "var(--ink-2)",
          cursor: "pointer",
          textAlign: align,
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.25, marginLeft: 5, fontSize: 9 }}>
          {active && asc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

