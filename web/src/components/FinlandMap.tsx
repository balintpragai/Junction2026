"use client";

import { useMemo } from "react";
import { FINLAND_CENTROIDS, FINLAND_PATHS, FINLAND_VIEWBOX } from "@/lib/finland-paths";
import { makeScale } from "@/lib/sequential";
import type { Region } from "@/lib/api";

/** Real Region boundaries (Statistics Finland, see finland-paths.ts), colored
 *  by whatever magnitude `value()` returns on a sequential ramp -- the same
 *  convention the Cancer Registry's own charts use. Severity/status colors
 *  stay off this map; the dataviz skill's rule against mixing a sequential
 *  and a status scale in one encoding. */
export function FinlandMap({
  regions,
  value,
  label,
  unit,
  selected,
  onSelect,
  formatTick,
}: {
  regions: Region[];
  value: (code: string) => number | null;
  label: (code: string) => string;
  unit: string;
  selected: string | null;
  onSelect: (code: string) => void;
  formatTick?: (v: number) => string;
}) {
  const { scale, min, max } = useMemo(() => {
    const values = regions.map((r) => value(r.code)).filter((v): v is number => v != null);
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    return { scale: makeScale(lo, hi), min: lo, max: hi };
  }, [regions, value]);

  return (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
      <svg
        viewBox={FINLAND_VIEWBOX}
        role="img"
        aria-label="Map of Finland's 23 Regions. Click a Region for details."
        style={{ width: "100%", maxWidth: 360, height: "auto", display: "block", flex: "1 1 280px" }}
      >
        {regions.map((region) => {
          const d = FINLAND_PATHS[region.code];
          if (!d) return null;
          const v = value(region.code);
          const isSelected = selected === region.code;
          const fill = v != null ? scale(v) : "var(--line)";

          return (
            <path
              key={region.code}
              className="map-region"
              tabIndex={0}
              role="button"
              aria-label={label(region.code)}
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

      <Legend min={min} max={max} unit={unit} format={formatTick ?? ((v) => v.toFixed(1))} />
    </div>
  );
}

function Legend({ min, max, unit, format }: { min: number; max: number; unit: string; format: (v: number) => string }) {
  // A small integer range (e.g. "0..4 indicators") gets one tick per integer
  // instead of 5 evenly-spaced floats that can round to the same label twice.
  const isSmallIntegerRange = Number.isInteger(min) && Number.isInteger(max) && max - min <= 6 && max - min >= 1;
  const rawValues = isSmallIntegerRange
    ? Array.from({ length: max - min + 1 }, (_, i) => max - i)
    : Array.from({ length: 5 }, (_, i) => max - ((max - min) / 4) * i);
  const seen = new Set<string>();
  const values = rawValues.filter((v) => {
    const label = format(v);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });

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
              {format(v)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
