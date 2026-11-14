type Point = { year: number; value: number };

const W = 280;
const H = 92;
const PAD_X = 10;
const PAD_Y = 14;

/** Small trend line, not a bar — a diverging bar shows one point in time,
 *  this shows direction over years (BUILD.md Workstream 3 note). Missing
 *  years break the line rather than bridging it; the target is a dashed
 *  reference, not a data point. */
const CSS_TOKEN: Record<"ok" | "watch" | "act", "good" | "watch" | "act"> = {
  ok: "good",
  watch: "watch",
  act: "act",
};

export function Sparkline({ points, target, tone }: { points: Point[]; target?: number | null; tone: "ok" | "watch" | "act" }) {
  if (points.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--ink-3)" }}>No trend data.</div>;
  }

  const years = points.map((p) => p.year);
  const values = points.map((p) => p.value);
  const allValues = target != null ? [...values, target] : values;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = maxVal - minVal || 1;

  const x = (year: number) => PAD_X + ((year - minYear) / (maxYear - minYear || 1)) * (W - PAD_X * 2);
  const y = (value: number) => H - PAD_Y - ((value - minVal) / valRange) * (H - PAD_Y * 2);

  // Break the line wherever a year is skipped, so a gap stays a gap.
  const segments: Point[][] = [];
  let current: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].year - points[i - 1].year === 1) {
      current.push(points[i]);
    } else {
      segments.push(current);
      current = [points[i]];
    }
  }
  segments.push(current);

  const strokeColor = `var(--${CSS_TOKEN[tone]})`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Trend from ${minYear} to ${maxYear}, ${points[0].value} to ${points[points.length - 1].value}.`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {target != null && (
        <>
          <line x1={PAD_X} y1={y(target)} x2={W - PAD_X} y2={y(target)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={W - PAD_X} y={y(target) - 4} textAnchor="end" fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-mono)">
            target
          </text>
        </>
      )}
      {segments.map((seg, si) => (
        <g key={si}>
          {seg.length > 1 && (
            <polyline
              points={seg.map((p) => `${x(p.year)},${y(p.value)}`).join(" ")}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {seg.map((p) => (
            <circle key={p.year} cx={x(p.year)} cy={y(p.value)} r={seg.length === 1 ? 3 : 2.5} fill={strokeColor} />
          ))}
        </g>
      ))}
      <text x={PAD_X} y={H - 2} fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        {minYear}
      </text>
      <text x={W - PAD_X} y={H - 2} textAnchor="end" fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        {maxYear}
      </text>
    </svg>
  );
}
