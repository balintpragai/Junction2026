import type { OutreachList } from "@/lib/api";
import { ChunkBar } from "@/components/ChunkBar";
import { SeverityBadge } from "@/components/SeverityBadge";

/** Outreach list: Regions below the reference, ranked by Gap. Each row
 *  expands into the same sentence → number → context pattern as the
 *  decision-maker card (BUILD.md Workstream 3), built from the row's own
 *  fields since this list has no Narrative field yet. */
export function OutreachView({ data }: { data: OutreachList }) {
  const maxScale = data.indicator.unit === "%" ? 100 : data.reference_value * 1.3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "var(--watch-soft)",
          border: "1px solid var(--watch-line)",
          borderRadius: "var(--radius-md)",
          padding: "14px 18px",
        }}
      >
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--watch)" }}>
          Read before targeting outreach
        </p>
        <p style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 6, lineHeight: 1.5 }}>{data.ecological_fallacy_note}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.rows.map((row) => {
          const sentence = `${row.region.name} sits ${Math.abs(row.deviation).toFixed(1)}${data.indicator.unit} below ${
            data.reference_kind === "target" ? "the target" : "its peers"
          } for ${data.indicator.name.toLowerCase()}, ${data.year} — rank ${row.rank} of ${data.rows.length} flagged.`;

          return (
            <details
              key={row.region.code}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
                padding: "14px 18px",
              }}
            >
              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>{row.region.name}</span>
                  <span className="mono" style={{ fontSize: 15, color: "var(--ink-2)" }}>
                    {row.value}
                    {data.indicator.unit}
                  </span>
                </div>
                <SeverityBadge severity={row.severity} />
              </summary>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>{sentence}</p>
                <ChunkBar value={row.value} max={maxScale} target={data.reference_value} tone={row.severity} />
                {row.covariates.immigrant_background_share_pct != null && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                    Immigrant-background share in this Region:{" "}
                    <strong className="mono">{row.covariates.immigrant_background_share_pct}%</strong> — an area-level figure, read
                    with the note above, not as a claim about individuals.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
