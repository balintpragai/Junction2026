import type { components } from "@/lib/api-types";

export type Region = components["schemas"]["Region"];
export type RegionList = components["schemas"]["RegionList"];
export type Indicator = components["schemas"]["Indicator"];
export type GapSummary = components["schemas"]["GapSummary"];
export type OutreachList = components["schemas"]["OutreachList"];

const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function loadRegions(): Promise<RegionList | null> {
  return getJson<RegionList>("/regions");
}

export function loadGapSummary(code: string, indicator: string, year: number): Promise<GapSummary | null> {
  return getJson<GapSummary>(`/regions/${code}/gap-summary?indicator=${indicator}&year=${year}`);
}

export function loadOutreachList(indicator: string, year: number): Promise<OutreachList | null> {
  return getJson<OutreachList>(`/outreach-list?indicator=${indicator}&year=${year}`);
}

/** Every Region's Gap summary for one indicator/year, fetched in parallel.
 *  Small n (23) — one round of parallel requests is simpler and faster for
 *  a demo than a dedicated bulk endpoint, and `api` caches each response. */
export async function loadAllGapSummaries(
  regions: Region[],
  indicator: string,
  year: number,
): Promise<Map<string, GapSummary>> {
  const results = await Promise.all(
    regions.map(async (r) => [r.code, await loadGapSummary(r.code, indicator, year)] as const),
  );
  const map = new Map<string, GapSummary>();
  for (const [code, summary] of results) {
    if (summary) map.set(code, summary);
  }
  return map;
}
