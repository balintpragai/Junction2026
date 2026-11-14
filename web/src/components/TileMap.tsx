"use client";

import { GRID_COLS, GRID_POSITION, GRID_ROWS } from "@/lib/geo";
import type { Region, GapSummary } from "@/lib/api";

const STEP = 46;
const SIZE = 40;
const MARGIN = 8;

const TONE_FILL: Record<"ok" | "watch" | "act", string> = {
  ok: "var(--good)",
  watch: "var(--watch)",
  act: "var(--act)",
};

export function TileMap({
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
  const width = MARGIN * 2 + GRID_COLS * STEP;
  const height = MARGIN * 2 + GRID_ROWS * STEP;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Map of 23 Regions, colored by Gap severity. Click a tile for details."
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {regions.map((region) => {
        const pos = GRID_POSITION[region.code];
        if (!pos) return null;
        const summary = summaries.get(region.code);
        const x = MARGIN + (pos.col + 1) * STEP;
        const y = MARGIN + pos.row * STEP;
        const isSelected = selected === region.code;
        const fill = summary ? TONE_FILL[summary.gap.severity] : "var(--line-strong)";
        const opacity = summary ? 0.22 + 0.78 * Math.min(1, Math.abs(summary.gap.deviation) / 10) : 1;

        return (
          <g key={region.code}>
            <rect
              className="tile"
              tabIndex={0}
              role="button"
              aria-label={`${region.name}${summary ? `, ${summary.gap.value}${summary.indicator.unit}` : ", no data"}`}
              aria-pressed={isSelected}
              x={x}
              y={y}
              width={SIZE}
              height={SIZE}
              rx={9}
              fill={fill}
              fillOpacity={opacity}
              stroke={isSelected ? "var(--ink)" : "var(--card)"}
              strokeWidth={isSelected ? 2.5 : 1.5}
              style={{ cursor: "pointer", outline: "none" }}
              onClick={() => onSelect(region.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(region.code);
                }
              }}
            />
            <text
              x={x + SIZE / 2}
              y={y + SIZE / 2 + 3}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fontFamily="var(--font-mono)"
              fill="#fff"
              stroke="rgba(10,14,16,0.55)"
              strokeWidth={2.2}
              paintOrder="stroke fill"
              pointerEvents="none"
            >
              {region.name.length > 9 ? `${region.name.slice(0, 8)}…` : region.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
