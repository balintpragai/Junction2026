"use client";

import { useRouter } from "next/navigation";
import { FinlandMap } from "@/components/FinlandMap";
import type { Region, OverviewRow } from "@/lib/api";

/** The overview map colors by how many tracked indicators need attention --
 *  not a single hidden score. ADR 0001: this product measures Gaps, not one
 *  bottleneck ranking; a composite score would hide exactly the "Helsinki is
 *  worst for breast/cervical but only middling for colorectal" finding this
 *  project's research turned up. Click a Region to see each indicator on its
 *  own, plus the full written picture. */
export function OverviewMap({ regions, rows }: { regions: Region[]; rows: OverviewRow[] }) {
  const router = useRouter();
  const byCode = new Map(rows.map((r) => [r.region.code, r]));
  const worst = [...rows].sort((a, b) => b.indicators_act - a.indicators_act)[0];

  return (
    <div>
      <p style={{ color: "var(--ink-2)", maxWidth: "70ch", marginBottom: 20 }}>
        Shaded by how many of the {rows[0]?.indicators_tracked ?? 5} tracked indicators sit in <strong>act</strong>{" "}
        this year -- not a single combined score. No Region is uniformly "the problem": click through to see which
        indicators, specifically, and what the data says is driving them.
      </p>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: 24,
        }}
      >
        <FinlandMap
          regions={regions}
          value={(code) => byCode.get(code)?.indicators_act ?? null}
          label={(code) => {
            const row = byCode.get(code);
            return row ? `${row.region.name}, ${row.indicators_act} of ${row.indicators_tracked} indicators need action` : "No data";
          }}
          unit="indicators in act"
          formatTick={(v) => String(Math.round(v))}
          selected={null}
          onSelect={(code) => router.push(`/region/${code}`)}
        />
      </div>

      {worst && (
        <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--ink-2)" }}>
          Most indicators in <strong style={{ color: "var(--act)" }}>act</strong> this year:{" "}
          <button
            onClick={() => router.push(`/region/${worst.region.code}`)}
            style={{ background: "none", border: "none", padding: 0, color: "var(--brand)", fontWeight: 600, cursor: "pointer", font: "inherit" }}
          >
            {worst.region.name}
          </button>{" "}
          ({worst.indicators_act} of {worst.indicators_tracked}).
        </p>
      )}
    </div>
  );
}
