import type { components } from "@/lib/api-types";

/** Every type here comes from the api's OpenAPI spec, generated into
 *  `api-types.ts` by `scripts/gen-api-types.sh`. Nothing in this file is
 *  hand-written any more: a model change in `common/models.py` shows up as a
 *  TypeScript error here, which is the point. */
export type Region = components["schemas"]["Region"];
export type RegionList = components["schemas"]["RegionList"];
export type Gap = components["schemas"]["Gap"];
/** `Severity` is a Literal in the contract, so it is inlined on the field
 *  rather than named as its own schema. Read it off the Gap. */
export type Severity = Gap["severity"];
export type GapEntry = components["schemas"]["GapEntry"];
export type RegionProfile = components["schemas"]["RegionProfile"];
export type CandidateAction = components["schemas"]["CandidateAction"];
export type Overview = components["schemas"]["Overview"];
export type OverviewRow = components["schemas"]["OverviewRow"];
export type ActionLibrary = components["schemas"]["ActionLibrary"];

/** The indicator metadata a card shows. `Indicator` in the contract. */
export type IndicatorMeta = components["schemas"]["Indicator"];

/** `dim_indicator` ids for the covariates the UI names explicitly. The rest
 *  are rendered generically from whatever `covariates` the profile carries. */
export const FOREIGN_BACKGROUND = "foreign_background_pct";

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

export function loadOverview(): Promise<Overview | null> {
  return getJson<Overview>("/overview");
}

export function loadRegionProfile(code: string): Promise<RegionProfile | null> {
  return getJson<RegionProfile>(`/regions/${encodeURIComponent(code)}/profile`);
}

/** Every curated National Cancer Strategy action, searchable in the planner
 *  so a decision-maker isn't limited to the engine's recommendations. */
export async function loadActionLibrary(code: string): Promise<CandidateAction[]> {
  const res = await getJson<ActionLibrary>(`/regions/${encodeURIComponent(code)}/action-library`);
  return res?.actions ?? [];
}

/** Every Region's profile, fetched in parallel -- small n (23), and `api`
 *  caches each response, so this is cheap and makes clicking through
 *  Regions on the map instant (no per-click round trip). */
export async function loadAllRegionProfiles(regions: Region[]): Promise<Map<string, RegionProfile>> {
  const results = await Promise.all(regions.map(async (r) => [r.code, await loadRegionProfile(r.code)] as const));
  const map = new Map<string, RegionProfile>();
  for (const [code, profile] of results) {
    if (profile) map.set(code, profile);
  }
  return map;
}
