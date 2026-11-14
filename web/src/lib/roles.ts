/** Two kinds of account, because this product has two genuinely different
 *  jobs. The State Decision Maker reads the whole country and *issues*
 *  directives; the Regional Decision Maker receives one and *works it out*
 *  with their own team. Neither sees the other's screen.
 *
 *  A real deployment authenticates against Suomi.fi; for the demo the
 *  account is picked from this fixed roster, which is also what makes the
 *  state -> region handoff demonstrable in one browser. */

export type RoleId = "state" | "regional";

export interface Account {
  id: string;
  role: RoleId;
  name: string;
  title: string;
  org: string;
  /** Regional accounts are scoped to exactly one Region. */
  regionCode?: string;
  initials: string;
}

export const ACCOUNTS: Account[] = [
  {
    id: "state-stm",
    role: "state",
    name: "Aino Virtanen",
    title: "Director, Cancer Programme",
    org: "Ministry of Social Affairs and Health (STM)",
    initials: "AV",
  },
  {
    id: "regional-helsinki",
    role: "regional",
    name: "Markus Laine",
    title: "Head of Screening Services",
    org: "City of Helsinki",
    regionCode: "helsinki",
    initials: "ML",
  },
  {
    id: "regional-lappi",
    role: "regional",
    name: "Sofia N. Koskinen",
    title: "Head of Screening Services",
    org: "Lapland wellbeing services county",
    regionCode: "lappi",
    initials: "SK",
  },
  {
    id: "regional-vantaa-kerava",
    role: "regional",
    name: "Elias Hakkarainen",
    title: "Head of Screening Services",
    org: "Vantaa and Kerava wellbeing services county",
    regionCode: "vantaa-kerava",
    initials: "EH",
  },
];

export const DEFAULT_ACCOUNT_ID = "state-stm";

export function accountById(id: string): Account {
  return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
}

export function regionalAccountFor(regionCode: string): Account | undefined {
  return ACCOUNTS.find((a) => a.role === "regional" && a.regionCode === regionCode);
}

export const ROLE_LABEL: Record<RoleId, string> = {
  state: "State Decision Maker",
  regional: "Regional Decision Maker",
};
