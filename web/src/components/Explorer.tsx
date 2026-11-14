"use client";

import { useMemo, useState } from "react";
import { FinlandMap } from "@/components/FinlandMap";
import { RegionDetail } from "@/components/RegionDetail";
import type { Region, RegionProfile } from "@/lib/api";

/** Map and detail panel live on one page -- clicking a Region updates the
 *  right side in place, no navigation. Every profile is fetched once,
 *  up front (23 small requests, already cached by `api`), so clicking
 *  through Regions is instant. */
export function Explorer({ regions, profiles }: { regions: Region[]; profiles: Map<string, RegionProfile> }) {
  const [selected, setSelected] = useState<string>(regions[0]?.code ?? "");
  const current = profiles.get(selected);

  const worst = useMemo(() => {
    let best: RegionProfile | null = null;
    for (const p of profiles.values()) {
      if (!best || p.summary.indicators_act > best.summary.indicators_act) best = p;
    }
    return best;
  }, [profiles]);

  return (
    <div>
      <p style={{ color: "var(--ink-2)", maxWidth: "70ch", marginBottom: 20 }}>
        Shaded by how many of the {current?.summary.indicators_tracked ?? 5} tracked indicators sit in{" "}
        <strong>act</strong> this year — not a single combined score. No Region is uniformly "the problem": click
        any Region to see which indicators, specifically, and what the data says is driving them.
      </p>

      <div className="explorer-grid" style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "flex-start" }}>
        <div
          className="explorer-map"
          style={{
            position: "sticky",
            top: 16,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-card)",
            padding: 20,
          }}
        >
          <FinlandMap
            regions={regions}
            value={(code) => profiles.get(code)?.summary.indicators_act ?? null}
            label={(code) => {
              const p = profiles.get(code);
              return p ? `${p.region.name}, ${p.summary.indicators_act} of ${p.summary.indicators_tracked} indicators need action` : "No data";
            }}
            unit="indicators in act"
            formatTick={(v) => String(Math.round(v))}
            selected={selected}
            onSelect={setSelected}
          />
          {worst && (
            <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-2)" }}>
              Most in <strong style={{ color: "var(--act)" }}>act</strong>:{" "}
              <button
                onClick={() => setSelected(worst.region.code)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--brand)", fontWeight: 600, cursor: "pointer", font: "inherit" }}
              >
                {worst.region.name}
              </button>{" "}
              ({worst.summary.indicators_act} of {worst.summary.indicators_tracked})
            </p>
          )}
        </div>

        <div className="explorer-detail">{current ? <RegionDetail profile={current} /> : <p style={{ color: "var(--ink-3)" }}>Select a Region.</p>}</div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .explorer-grid { grid-template-columns: 1fr !important; }
          .explorer-map { position: static !important; }
        }
      `}</style>
    </div>
  );
}
