const SEGMENTS = 10;

/** Segmented progress bar — this demo's version of the reference moodboard's
 *  "780 / 1 000" usage bar. Filled chunks show `value` as a share of `max`;
 *  the notch marks where `target` sits on the same scale, so "how far from
 *  target" reads as a gap in the chunks, not a second number to parse. */
const CSS_TOKEN: Record<"ok" | "watch" | "act", "good" | "watch" | "act"> = {
  ok: "good",
  watch: "watch",
  act: "act",
};

export function ChunkBar({
  value,
  max,
  target,
  tone,
}: {
  value: number;
  max: number;
  target?: number | null;
  tone: "ok" | "watch" | "act";
}) {
  const cssTone = CSS_TOKEN[tone];
  const filledColor = `var(--${cssTone})`;
  const filledSoft = `var(--${cssTone}-soft)`;
  const filled = Math.max(0, Math.min(SEGMENTS, Math.round((value / max) * SEGMENTS)));
  const targetSegment = target != null ? Math.max(0, Math.min(SEGMENTS - 1, Math.round((target / max) * SEGMENTS))) : null;

  return (
    <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            flex: 1,
            height: 22,
            borderRadius: 5,
            background: i < filled ? filledColor : filledSoft,
            border: i < filled ? "none" : "1px dashed var(--line-strong)",
          }}
        >
          {targetSegment === i && (
            <div
              title="Target"
              style={{
                position: "absolute",
                top: -6,
                right: -2,
                width: 2,
                height: 34,
                background: "var(--ink)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
