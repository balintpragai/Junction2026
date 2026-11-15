/** Short display names, for places where the full name does not fit: a map
 *  label, a table column, a chart axis.
 *
 *  Hand-written, unlike `fi-data.ts`, because the database has no short form.
 *  The Finnish names here are the nominative ("Pohjois-Savo"), while
 *  `dim_region.name_fi` stores the genitive inside a longer phrase
 *  ("Pohjois-Savon hyvinvointialue"). Chopping the suffix off that would
 *  leave "Pohjois-Savon", which reads as a possessive dangling on its own --
 *  fine inside the Narrative sentence it was written for, wrong as a label.
 *
 *  Keyed by Sotkanet code so neither language depends on string surgery over
 *  the other language's wording. */

import type { Lang } from "@/lib/i18n";

const REGION_SHORT_FI: Record<string, string> = {
  "01": "Itä-Uusimaa",
  "02": "Keski-Uusimaa",
  "03": "Länsi-Uusimaa",
  "04": "Vantaa ja Kerava",
  "05": "Varsinais-Suomi",
  "06": "Satakunta",
  "07": "Kanta-Häme",
  "08": "Pirkanmaa",
  "09": "Päijät-Häme",
  "10": "Kymenlaakso",
  "11": "Etelä-Karjala",
  "12": "Etelä-Savo",
  "13": "Pohjois-Savo",
  "14": "Pohjois-Karjala",
  "15": "Keski-Suomi",
  "16": "Etelä-Pohjanmaa",
  "17": "Pohjanmaa",
  "18": "Keski-Pohjanmaa",
  "19": "Pohjois-Pohjanmaa",
  "20": "Kainuu",
  "21": "Lappi",
  "90": "Helsinki",
  "91": "Ahvenanmaa",
};

const INDICATOR_SHORT_FI: Record<string, string> = {
  "3621": "Rintasyöpäseulonta",
  "3620": "Kohdunkaulasyöpäseulonta",
  "6103": "Suolistosyöpäseulonta",
  "3336": "Pitkät odotusajat",
  "13": "Lähetteet ≤3 vrk",
  "5033": "Lähetteet >21 vrk",
  "3625": "Rintasyöpä, elossaolo",
  "3626": "Kohdunkaulasyöpä, elossaolo",
  "3627": "Paksunsuolen syöpä, elossaolo",
  "3892": "Täyttämättömät lääkäritehtävät",
  "5395": "Erityiskorvattavat syöpälääkkeet",
  "5643": "Syöpäindeksi",
  "2331": "Väestöntiheys",
  "2475": "Avohoitokäynnit",
};

/** The Region's name short enough for a label. */
export function regionShort(code: string, nameEn: string, lang: Lang): string {
  if (lang === "fi") return REGION_SHORT_FI[code] ?? nameEn;
  return nameEn.replace(/ wellbeing services county$/, "").replace(/^City of /, "");
}

/** The indicator's name short enough for a column header or chart axis. */
export function indicatorShort(code: string, nameEn: string, lang: Lang): string {
  if (lang === "fi") return INDICATOR_SHORT_FI[code] ?? nameEn;
  return nameEn
    .replace(/ cancer screening attendance$/, "")
    .replace(/^Patients waiting over 6 months for specialised care$/, "Long waits")
    .replace(/^Referrals processed within 3 days$/, "Referrals ≤3d");
}
