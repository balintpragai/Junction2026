import type { GapEntry } from "@/lib/api";
import { ChunkBar } from "@/components/ChunkBar";
import { SeverityBadge } from "@/components/SeverityBadge";

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

/** One indicator, compact: the sentence, then the number with direction and
 *  peer context -- the three-layer pattern (BUILD.md Workstream 3), without
 *  a standalone trend chart since this view shows several indicators at
 *  once per Region. */
export function IndicatorCard({ entry }: { entry: GapEntry }) {
  const { indicator, gap, narrative, data_quality_notes } = entry;
  const tone = gap.severity;
  const maxScale = indicator.unit === "%" ? 100 : Math.max(gap.value, gap.reference_value) * 1.2;
  const peers = gap.peer_values.filter((p) => p.region_code !== gap.region_code);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      <div style={{ background: TONE_SOFT[tone], padding: "14px 18px", borderBottom: `1px solid ${TONE_LINE[tone]}` }}>
        <p style={{ fontSize: 14.5, fontWeight: 650, lineHeight: 1.4, margin: 0, color: "var(--ink)" }}>{narrative.text}</p>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>
            {gap.value}
            {indicator.unit.startsWith("%") ? "%" : ` ${indicator.unit}`}
          </span>
          <SeverityBadge severity={tone} />
        </div>
        <ChunkBar value={gap.value} max={maxScale} target={indicator.target} tone={tone} />
        <p style={{ fontSize: 12, color: "var(--ink-2)" }}>
          {gap.direction === "at" ? "At" : gap.direction === "below" ? "Below" : "Above"}{" "}
          {gap.reference_kind === "target" ? "target" : "peer median"} by {Math.abs(gap.deviation)}
          {indicator.unit.startsWith("%") ? "pp" : ` ${indicator.unit}`} -- rank {gap.rank} of {gap.n_regions}.
        </p>
        {peers.length > 0 && (
          <p style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Peers: {peers.map((p) => `${p.value}${indicator.unit.startsWith("%") ? "%" : ""}`).join(", ")}</p>
        )}
        {data_quality_notes.map((note, i) => (
          <p key={i} style={{ fontSize: 11.5, color: "var(--watch)", background: "var(--watch-soft)", borderRadius: 7, padding: "5px 9px" }}>
            {note.message}
          </p>
        ))}
      </div>
    </div>
  );
}
