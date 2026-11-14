/** Grid position for each Region's tile in the map, carried over from the
 *  Reach Loop artifact's hand-placed layout (same relative geography, the
 *  Reach Loop proved this reads correctly at a glance). Keyed by the `api`
 *  Region code, not the old numeric Sotkanet code. */
export const GRID_POSITION: Record<string, { col: number; row: number }> = {
  lappi: { col: 2, row: 0 },
  "pohjois-pohjanmaa": { col: 1, row: 1 },
  kainuu: { col: 3, row: 1 },
  "keski-pohjanmaa": { col: 1, row: 2 },
  "pohjois-savo": { col: 3, row: 2 },
  "pohjois-karjala": { col: 4, row: 2 },
  pohjanmaa: { col: 0, row: 3 },
  "etela-pohjanmaa": { col: 1, row: 3 },
  "keski-suomi": { col: 2, row: 3 },
  "etela-savo": { col: 3, row: 3 },
  satakunta: { col: 0, row: 4 },
  pirkanmaa: { col: 2, row: 4 },
  "paijat-hame": { col: 3, row: 4 },
  "etela-karjala": { col: 4, row: 4 },
  "varsinais-suomi": { col: 0, row: 5 },
  "kanta-hame": { col: 1, row: 5 },
  kymenlaakso: { col: 4, row: 5 },
  aland: { col: -1, row: 5 },
  "lansi-uusimaa": { col: 0, row: 6 },
  "keski-uusimaa": { col: 1, row: 6 },
  "vantaa-kerava": { col: 2, row: 6 },
  "ita-uusimaa": { col: 3, row: 6 },
  helsinki: { col: 2, row: 7 },
};

export const GRID_COLS = 6;
export const GRID_ROWS = 8;

export type SeverityToken = "ok" | "watch" | "act";

export const SEVERITY_LABEL: Record<SeverityToken, string> = {
  ok: "On target",
  watch: "Watch",
  act: "Act",
};
