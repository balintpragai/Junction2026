"use client";

import { useMemo } from "react";
import { FINLAND_CENTROIDS, FINLAND_PATHS, FINLAND_VIEWBOX } from "@/lib/finland-paths";
import { makeScale } from "@/lib/sequential";
import type { GapSummary, Region } from "@/lib/api";

/** Real Region boundaries (Statistics Finland, see finland-paths.ts), colored
 *  by raw value on a sequential ramp -- the same convention the Cancer
 *  Registry's own charts use for this measure. Severity (ok/watch/act) is a
 *  separate encoding, shown on the selected Region's card, not mixed into
 *  this map's hue (dataviz skill: never mix a sequential and a status scale
 *  in one encoding). */
export function FinlandMap({
  regions,
  summaries,
  selected,
  onSelect,
}: {
  regions: Region[];
  summaries: Map<string, GapSummary>;
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const { scale, min, max, unit } = useMemo(() => {
    const values = [...summaries.values()].map((s) => s.gap.value);
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const u = summaries.values().next().value?.indicator.unit ?? "";
    return { scale: makeScale(lo, hi), min: lo, max: hi, unit: u };
  }, [summaries]);

  return (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
      <svg
        viewBox={FINLAND_VIEWBOX}
        role="img"
        aria-label="Map of Finland's 23 Regions, colored by value. Click a Region for details."
        style={{ width: "100%", maxWidth: 360, height: "auto", display: "block", flex: "1 1 280px" }}
      >
        {regions.map((region) => {
          const d = FINLAND_PATHS[region.code];
          if (!d) return null;
          const summary = summaries.get(region.code);
          const isSelected = selected === region.code;
          const fill = summary ? scale(summary.gap.value) : "var(--line)";

          return (
            <path
              key={region.code}
              className="map-region"
              tabIndex={0}
              role="button"
              aria-label={`${region.name}${summary ? `, ${summary.gap.value}${summary.indicator.unit}` : ", no data"}`}
              aria-pressed={isSelected}
              d={d}
              fill={fill}
              stroke={isSelected ? "var(--ink)" : "var(--card)"}
              strokeWidth={isSelected ? 2.2 : 0.9}
              strokeLinejoin="round"
              style={{ cursor: "pointer", outline: "none" }}
              onClick={() => onSelect(region.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(region.code);
                }
              }}
            />
          );
        })}

        {/* Helsinki's real shape is correct but small (a city, not a county) --
            an invisible larger hit-area makes it reliably clickable without
            changing what's drawn. */}
        {FINLAND_CENTROIDS.helsinki && (
          <circle
            cx={FINLAND_CENTROIDS.helsinki[0]}
            cy={FINLAND_CENTROIDS.helsinki[1]}
            r={9}
            fill="transparent"
            tabIndex={-1}
            aria-hidden="true"
            style={{ cursor: "pointer" }}
            onClick={() => onSelect("helsinki")}
          />
        )}
      </svg>

      <Legend min={min} max={max} unit={unit} />
    </div>
  );
}

function Legend({ min, max, unit }: { min: number; max: number; unit: string }) {
  const ticks = 5;
  const values = Array.from({ length: ticks }, (_, i) => max - ((max - min) / (ticks - 1)) * i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{unit}</span>
      <div style={{ display: "flex", gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 18,
            height: 148,
            borderRadius: 4,
            background: "linear-gradient(to top, #feebe2, #fbb4b9, #f768a1, #c51b8a, #7a0177)",
            border: "1px solid var(--line)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 148 }}>
          {values.map((v, i) => (
            <span key={i} className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {v.toFixed(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
