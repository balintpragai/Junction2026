/** One-hue sequential ramp for magnitude (dataviz skill: "Sequential = one
 *  hue, light->dark"). Rose/magenta, in the family the Finnish Cancer
 *  Registry's own charts use for this exact measure (ColorBrewer RdPu,
 *  5-class) -- a real, perceptually-graded reference, not eyeballed stops. */
const STOPS: [number, string][] = [
  [0, "#feebe2"],
  [0.25, "#fbb4b9"],
  [0.5, "#f768a1"],
  [0.75, "#c51b8a"],
  [1, "#7a0177"],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** t in [0, 1] -> a hex color on the ramp. */
export function sequentialColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < STOPS.length - 2 && clamped > STOPS[i + 1][0]) i++;
  const [t0, c0] = STOPS[i];
  const [t1, c1] = STOPS[i + 1];
  const local = t1 === t0 ? 0 : (clamped - t0) / (t1 - t0);
  const [r0, g0, b0] = hexToRgb(c0);
  const [r1, g1, b1] = hexToRgb(c1);
  const r = Math.round(lerp(r0, r1, local));
  const g = Math.round(lerp(g0, g1, local));
  const b = Math.round(lerp(b0, b1, local));
  return `rgb(${r}, ${g}, ${b})`;
}

export function makeScale(min: number, max: number) {
  const span = max - min || 1;
  return (value: number) => sequentialColor((value - min) / span);
}

export const SEQUENTIAL_STOPS = STOPS;
