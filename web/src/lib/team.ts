/** The people a Regional Decision Maker actually assigns work to.
 *
 *  Every step a playbook produces names a *function* (`StepFunction`), not a
 *  person — so the same national playbook lands on whoever holds that
 *  function in each Region. The roster below is the demo's stand-in for the
 *  county's own staff directory. */

export type StepFunction =
  | "screening_lead"
  | "data_analyst"
  | "dpo"
  | "chief_physician"
  | "communications"
  | "logistics"
  | "community_liaison"
  | "finance";

export const FUNCTION_LABEL: Record<StepFunction, string> = {
  screening_lead: "Screening programme lead",
  data_analyst: "Health data analyst",
  dpo: "Data protection officer",
  chief_physician: "Chief physician, screening",
  communications: "Communications",
  logistics: "Transport & logistics",
  community_liaison: "Community liaison",
  finance: "Finance & procurement",
};

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  func: StepFunction;
  /** Open assignments already on this person's desk, before anything new
   *  from the current directive — so "who is free?" is a real question. */
  baseLoad: number;
}

/** Fixed first names per function, varied per Region by a stable index so
 *  each county has its own named team without a hand-written roster for 23
 *  Regions. Deterministic: the same Region always gets the same people. */
const NAMES: Record<StepFunction, string[]> = {
  screening_lead: ["Hanna Mäkinen", "Petri Salo", "Liisa Korhonen"],
  data_analyst: ["Joonas Räsänen", "Tuuli Aho", "Mikko Heikkilä"],
  dpo: ["Satu Lehtonen", "Antti Kallio", "Riikka Niemi"],
  chief_physician: ["Dr. Kaisa Järvinen", "Dr. Olli Peltola", "Dr. Nina Saarinen"],
  communications: ["Emma Lindholm", "Ville Toivonen", "Aino Rantala"],
  logistics: ["Jukka Mattila", "Henna Väisänen", "Timo Oksanen"],
  community_liaison: ["Amina Yusuf", "Pekka Hiltunen", "Laila Magga"],
  finance: ["Katri Savolainen", "Jarno Lehto", "Maria Kinnunen"],
};

const BASE_LOAD: Record<StepFunction, number> = {
  screening_lead: 3,
  data_analyst: 2,
  dpo: 4,
  chief_physician: 5,
  communications: 1,
  logistics: 2,
  community_liaison: 0,
  finance: 2,
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function teamFor(regionCode: string): TeamMember[] {
  const seed = hash(regionCode);
  return (Object.keys(NAMES) as StepFunction[]).map((func, i) => {
    const pool = NAMES[func];
    const name = pool[(seed + i * 7) % pool.length];
    return {
      id: `${regionCode}:${func}`,
      name,
      initials: initialsOf(name),
      func,
      baseLoad: BASE_LOAD[func],
    };
  });
}

export function memberForFunction(regionCode: string, func: StepFunction): TeamMember {
  return teamFor(regionCode).find((m) => m.func === func)!;
}
