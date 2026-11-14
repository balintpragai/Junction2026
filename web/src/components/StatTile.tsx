const TONE: Record<string, { bg: string; fg: string; border: string }> = {
  brand: { bg: "var(--brand-soft)", fg: "var(--brand)", border: "var(--brand-line)" },
  act: { bg: "var(--act-soft)", fg: "var(--act)", border: "var(--act-line)" },
  watch: { bg: "var(--watch-soft)", fg: "var(--watch)", border: "var(--watch-line)" },
  good: { bg: "var(--good-soft)", fg: "var(--good)", border: "var(--good-line)" },
};

export function StatTile({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <div
      style={{
        flex: "1 1 200px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-md)",
        padding: "16px 18px",
      }}
    >
      <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: t.fg, opacity: 0.85 }}>
        {label}
      </p>
      <p className="mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
        {value}
      </p>
    </div>
  );
}
