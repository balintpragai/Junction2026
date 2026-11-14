import type { SeverityToken } from "@/lib/geo";
import { SEVERITY_LABEL } from "@/lib/geo";

const TONE: Record<SeverityToken, { bg: string; fg: string; border: string }> = {
  ok: { bg: "var(--good-soft)", fg: "var(--good)", border: "var(--good-line)" },
  watch: { bg: "var(--watch-soft)", fg: "var(--watch)", border: "var(--watch-line)" },
  act: { bg: "var(--act-soft)", fg: "var(--act)", border: "var(--act-line)" },
};

export function SeverityBadge({ severity }: { severity: SeverityToken }) {
  const tone = TONE[severity];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.fg, display: "inline-block" }} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
