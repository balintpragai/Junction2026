import type { GapSummary } from "@/lib/api";
import { ChunkBar } from "@/components/ChunkBar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Sparkline } from "@/components/Sparkline";

const TONE_SOFT: Record<"ok" | "watch" | "act", string> = {
  ok: "var(--good-soft)",
  watch: "var(--watch-soft)",
  act: "var(--act-soft)",
};
const TONE_LINE: Record<"ok" | "watch" | "act", string> = {
  ok: "var(--good-line)",
  watch: "var(--watch-line)",
  act: "var(--act-line)",
};

/** The three-layer card (BUILD.md Workstream 3, the user's explicit brief):
 *  1. the sentence, 2. the number with direction, 3. the trend. Each layer
 *  answers a different question in under 10 seconds, in that order. */
export function ThreeLayerCard({ summary }: { summary: GapSummary }) {
  const { region, indicator, gap, action, data_quality_notes, narrative, trend } = summary;
  const tone = gap.severity;
  const maxScale = indicator.unit === "%" ? 100 : Math.max(gap.value, gap.reference_value) * 1.15;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      {/* Layer 1 — the sentence */}
      <div style={{ background: TONE_SOFT[tone], padding: "20px 22px", borderBottom: `1px solid ${TONE_LINE[tone]}` }}>
        <p style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.4, margin: 0, color: "var(--ink)" }}>{narrative.text}</p>
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-2)", cursor: "pointer" }}>
            How this sentence was written
          </summary>
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
            {narrative.source === "llm"
              ? "Model-generated, then checked: every number in the sentence was verified against this Gap before it was shown."
              : "Fixed wording filled in from this Gap's own numbers — exact by construction, no model involved."}
          </p>
        </details>
      </div>

      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Layer 2 — the number, with direction */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="mono" style={{ fontSize: 34, fontWeight: 800, color: "var(--ink)" }}>
                {gap.value}
                {indicator.unit}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {gap.direction === "at" ? "at" : gap.direction} {gap.reference_kind === "target" ? "target" : "peer median"} by{" "}
                {Math.abs(gap.deviation).toFixed(1)}
                {indicator.unit}
              </span>
            </div>
            <SeverityBadge severity={tone} />
          </div>
          <div style={{ marginTop: 10 }}>
            <ChunkBar value={gap.value} max={maxScale} target={indicator.target} tone={tone} />
          </div>
          <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
            Rank {gap.rank} of {gap.n_regions} Regions
            {gap.peer_values.length > 0 ? ` compared, for ${indicator.name.toLowerCase()}, ${gap.year}.` : "."}
          </p>
          {data_quality_notes.map((note) => (
            <p key={note.code} style={{ marginTop: 6, fontSize: 12, color: "var(--watch)", background: "var(--watch-soft)", borderRadius: 8, padding: "6px 10px" }}>
              {note.message}
            </p>
          ))}
        </div>

        {/* Layer 3 — the trend */}
        <div>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", marginBottom: 8 }}>
            {region.name} over time
          </p>
          <Sparkline points={trend} target={indicator.target} tone={tone} />
        </div>

        {action && (
          <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
            <p style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>
              Matched strategy action
            </p>
            <p style={{ fontSize: 13, marginTop: 4, color: "var(--ink)" }}>
              <strong>{action.title}.</strong> {action.text}
            </p>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{action.source}</p>
          </div>
        )}
      </div>
    </div>
  );
}
