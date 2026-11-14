/** Putting five indicators measured in different units on one chart needs a
 *  common scale, and the choice of scale is a claim. The one used here is
 *  deliberately the most modest available: a Region's *position in the
 *  national range* for that indicator, 0 = the weakest Region, 100 = the
 *  strongest. It says nothing about whether the national range is good — the
 *  target comparison on the indicator cards does that — only about where
 *  this Region sits among its peers. Every chart built on it prints the raw
 *  value alongside, so the normalisation is never the only thing shown. */

import type { RegionProfile } from "@/lib/api";

export interface AxisPoint {
  code: string;
  name: string;
  /** A name short enough to sit at the end of a radar spoke. */
  shortName: string;
  unit: string;
  higherIsBetter: boolean;
  /** 0-100 position in the national range, oriented so 100 is always better. */
  score: number;
  /** What the Region actually measured. */
  raw: number;
  /** The same normalisation applied to the national median. */
  medianScore: number;
  medianRaw: number;
  rank: number;
  nRegions: number;
  severity: "ok" | "watch" | "act";
}

const SHORT: Record<string, string> = {
  "3621": "Breast screening",
  "3620": "Cervical screening",
  "6103": "Colorectal screening",
  "3336": "Long waits",
  "13": "Referral speed",
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Build the comparison axes for one Region, scaled against every Region. */
export function buildAxes(profile: RegionProfile, all: Map<string, RegionProfile>): AxisPoint[] {
  return profile.gaps.map((entry) => {
    const code = entry.indicator.code;
    const higher = entry.indicator.higher_is_better;

    const values: number[] = [];
    for (const p of all.values()) {
      const g = p.gaps.find((x) => x.indicator.code === code);
      if (g) values.push(g.gap.value);
    }
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const norm = (v: number) => {
      const t = (v - lo) / span;
      return Math.round((higher ? t : 1 - t) * 100);
    };

    const med = median(values);

    return {
      code,
      name: entry.indicator.name,
      shortName: SHORT[code] ?? entry.indicator.name,
      unit: entry.indicator.unit,
      higherIsBetter: higher,
      score: norm(entry.gap.value),
      raw: entry.gap.value,
      medianScore: norm(med),
      medianRaw: Math.round(med * 10) / 10,
      rank: entry.gap.rank,
      nRegions: entry.gap.n_regions,
      severity: entry.gap.severity,
    };
  });
}

export function formatValue(v: number, unit: string): string {
  const n = Math.round(v * 10) / 10;
  return unit.trim().startsWith("%") ? `${n}%` : `${n} ${unit}`;
}
