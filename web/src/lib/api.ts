import type { components } from "@/lib/api-types";

export type Region = components["schemas"]["Region"];
export type RegionList = components["schemas"]["RegionList"];

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

// --- Product-direction types below --------------------------------------
// `/overview` and `/regions/{code}/profile` are NOT in the real api's
// contract yet -- they're this pipeline concept's own shape, served by the
// scratchpad mock for this branch. See BUILD.md before wiring these against
// the real api; the real contract would need these two routes added.

export type Severity = "ok" | "watch" | "act";

export interface IndicatorMeta {
  code: string;
  name: string;
  unit: string;
  higher_is_better: boolean;
  target: number | null;
}

export interface Gap {
  region_code: string;
  indicator_code: string;
  year: number;
  value: number;
  reference_kind: "target" | "peer_median";
  reference_value: number;
  deviation: number;
  direction: "above" | "below" | "at";
  severity: Severity;
  rank: number;
  n_regions: number;
  peer_values: { region_code: string; value: number }[];
}

export interface GapEntry {
  indicator: IndicatorMeta;
  gap: Gap;
  narrative: { text: string; source: string; language: string };
  data_quality_notes: { code?: string; message: string }[];
}

export interface CandidateAction {
  id: string;
  kind: "strategy" | "covariate";
  title: string;
  description: string;
  why: string;
  workflow:
    | { type: "stakeholder_message"; target: string }
    | { type: "patient_message"; profile: string };
}

export interface RegionProfile {
  region: Region;
  year: number;
  gaps: GapEntry[];
  covariates: Record<string, number>;
  covariate_meta: Record<string, { name: string; unit: string; median: number }>;
  missing_data_notes: string[];
  summary: { indicators_tracked: number; indicators_act: number; indicators_watch: number };
  synthesis: string[];
  candidate_actions: CandidateAction[];
}

export interface OverviewRow {
  region: Region;
  indicators_tracked: number;
  indicators_act: number;
  indicators_watch: number;
}

export function loadOverview(): Promise<{ year: number; rows: OverviewRow[] } | null> {
  return getJson("/overview");
}

export function loadRegionProfile(code: string): Promise<RegionProfile | null> {
  return getJson(`/regions/${code}/profile`);
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
