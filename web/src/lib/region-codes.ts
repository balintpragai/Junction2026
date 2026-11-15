/** Sotkanet Region code (what the api serves, `dim_region.code`) to the slug
 *  the generated map geometry is keyed on.
 *
 *  The app speaks Sotkanet codes everywhere — in URLs, in selection state, and
 *  in every api call. This map exists only because `finland-paths.ts` is
 *  generated from Statistics Finland's WFS and keyed on its own slugs; that
 *  file carries a "do not hand-edit" header, so the translation lives here
 *  instead of being rewritten into the geometry on every regeneration.
 *
 *  Verified against `data/curated/region_parent_area.csv`: all 23 Regions.
 */
export const GEOMETRY_SLUG: Record<string, string> = {
  "01": "ita-uusimaa",
  "02": "keski-uusimaa",
  "03": "lansi-uusimaa",
  "04": "vantaa-kerava",
  "05": "varsinais-suomi",
  "06": "satakunta",
  "07": "kanta-hame",
  "08": "pirkanmaa",
  "09": "paijat-hame",
  "10": "kymenlaakso",
  "11": "etela-karjala",
  "12": "etela-savo",
  "13": "pohjois-savo",
  "14": "pohjois-karjala",
  "15": "keski-suomi",
  "16": "etela-pohjanmaa",
  "17": "pohjanmaa",
  "18": "keski-pohjanmaa",
  "19": "pohjois-pohjanmaa",
  "20": "kainuu",
  "21": "lappi",
  "90": "helsinki",
  "91": "aland",
};

/** Sotkanet codes for the Regions the UI needs to name directly. */
export const HELSINKI = "90";
export const VANTAA_KERAVA = "04";
export const KESKI_UUSIMAA = "02";
export const LANSI_UUSIMAA = "03";
export const ITA_UUSIMAA = "01";
export const LAPPI = "21";

/** Cities, not counties: their real outlines are only a few pixels across when
 *  zoomed out, so the map gives them an invisible circular hit area. */
export const SMALL_REGIONS = [KESKI_UUSIMAA, VANTAA_KERAVA, HELSINKI];

/** The capital area, which the map offers as one "Helsinki and region" shortcut. */
export const CAPITAL_AREA = [HELSINKI, VANTAA_KERAVA, KESKI_UUSIMAA, LANSI_UUSIMAA, ITA_UUSIMAA];

/** Every Sotkanet code the app knows, for validating anything that arrives
 *  from outside the current build — a URL, or state persisted by an older one. */
export const KNOWN_REGION_CODES = new Set(Object.keys(GEOMETRY_SLUG));
