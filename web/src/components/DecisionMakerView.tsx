"use client";

import { useMemo, useState } from "react";
import type { GapSummary, Indicator, Region } from "@/lib/api";
import { TileMap } from "@/components/TileMap";
import { ThreeLayerCard } from "@/components/ThreeLayerCard";
import { StatTile } from "@/components/StatTile";

export function DecisionMakerView({
  regions,
  indicator,
  summaries,
  defaultCode,
}: {
  regions: Region[];
  indicator: Indicator;
  summaries: Map<string, GapSummary>;
  defaultCode: string;
}) {
  const [selected, setSelected] = useState(defaultCode);
  const current = summaries.get(selected);

  const stats = useMemo(() => {
    const values = [...summaries.values()];
    const acting = values.filter((s) => s.gap.severity === "act").length;
    const worst = values.reduce<GapSummary | null>((acc, s) => {
      if (s.gap.direction !== "below") return acc;
      if (!acc || s.gap.deviation < acc.gap.deviation) return s;
      return acc;
    }, null);
    return { total: values.length, acting, worst };
  }, [summaries]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatTile label="Regions tracked" value={String(stats.total)} tone="brand" />
        <StatTile label="Below target — act now" value={String(stats.acting)} tone="act" />
        {stats.worst && (
          <StatTile
            label="Largest gap"
            value={`${stats.worst.region.name} · ${stats.worst.gap.deviation.toFixed(1)}${indicator.unit}`}
            tone="watch"
          />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="dm-grid">
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-card)",
            padding: 20,
          }}
        >
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", marginBottom: 12 }}>
            {indicator.name} · {Math.max(...indicator.years)}
          </p>
          <TileMap regions={regions} summaries={summaries} selected={selected} onSelect={setSelected} />
        </div>

        {current ? <ThreeLayerCard summary={current} /> : <p style={{ color: "var(--ink-3)" }}>No data for this Region.</p>}
      </div>

      <style>{`@media (max-width: 860px) { .dm-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
