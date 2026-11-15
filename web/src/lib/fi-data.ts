/** Finnish names for the fixed vocabulary: the 23 Regions and every scoreable
 *  indicator. Generated from `dim_region.name_fi` and `dim_indicator.name_fi`,
 *  which is where they are authoritative -- these are THL's own Finnish names,
 *  not translations made here. Regenerate rather than edit by hand.
 *
 *  The api serves English names only, so the UI looks the Finnish one up by
 *  code. Falling back to the English name is deliberate: a missing Finnish
 *  name should show the real indicator, not an empty label. */

import type { Lang } from "@/lib/i18n";

const REGION_FI: Record<string, string> = {
  "01": "Itä-Uudenmaan hyvinvointialue",
  "02": "Keski-Uudenmaan hyvinvointialue",
  "03": "Länsi-Uudenmaan hyvinvointialue",
  "04": "Vantaan ja Keravan hyvinvointialue",
  "05": "Varsinais-Suomen hyvinvointialue",
  "06": "Satakunnan hyvinvointialue",
  "07": "Kanta-Hämeen hyvinvointialue",
  "08": "Pirkanmaan hyvinvointialue",
  "09": "Päijät-Hämeen hyvinvointialue",
  "10": "Kymenlaakson hyvinvointialue",
  "11": "Etelä-Karjalan hyvinvointialue",
  "12": "Etelä-Savon hyvinvointialue",
  "13": "Pohjois-Savon hyvinvointialue",
  "14": "Pohjois-Karjalan hyvinvointialue",
  "15": "Keski-Suomen hyvinvointialue",
  "16": "Etelä-Pohjanmaan hyvinvointialue",
  "17": "Pohjanmaan hyvinvointialue",
  "18": "Keski-Pohjanmaan hyvinvointialue",
  "19": "Pohjois-Pohjanmaan hyvinvointialue",
  "20": "Kainuun hyvinvointialue",
  "21": "Lapin hyvinvointialue",
  "90": "Helsingin kaupunki",
  "91": "Ahvenanmaa",
};

const INDICATOR_FI: Record<string, string> = {
  "13": "Erikoissairaanhoitoon saapuneet 3 vrk:ssa käsitellyt lähetteet",
  "2297": "Kelan korvaamien sairaanhoitomatkojen korvaukset",
  "2298": "Kelan korvaamien sairaanhoitomatkojen kustannukset",
  "2299": "Kelan korvaamien sairaanhoitomatkojen määrä",
  "2300": "Kelan korvaamien sairaanhoitomatkojen käyttäjät",
  "2331": "Väestöntiheys",
  "2475": "Erikoissairaanhoidon avohoitokäynnit, syöpätaudit ja sädehoito",
  "3213": "Kelan korvaamien sairaanhoitomatkojen korvaukset, euroa / asukas",
  "3227": "Kelan korvaamien sairaanhoitomatkojen kustannukset, euroa / asukas",
  "3228": "Kelan korvaamien sairaanhoitomatkojen kustannukset, euroa / asiakas",
  "3336": "Erikoissairaanhoitoa yli 6 kk odottaneet vuoden aikana",
  "3620": "Kohdunkaulasyövän seulontaan osallistuneiden osuus kutsutuista",
  "3621": "Rintasyövän seulontaan osallistuneiden osuus kutsutuista",
  "3625": "Rintasyövän viiden vuoden suhteellinen elossaololuku",
  "3626": "Kohdunkaulan syövän viiden vuoden suhteellinen elossaololuku",
  "3627": "Paksunsuolen syövän viiden vuoden suhteellinen elossaololuku",
  "3892": "Täyttämättömien lääkäritehtävien osuus",
  "5033": "Erikoissairaanhoitoon saapuneet yli 21 vrk:ssa käsitellyt lähetteet",
  "5395": "Erityiskorvattaviin lääkkeisiin syövän vuoksi oikeutetut",
  "5643": "Syöpäindeksi, ikävakioitu",
  "6103": "Suolistosyövän seulontaan osallistuneiden osuus kutsutuista",
  "at_risk_of_poverty_rate": "Pienituloisuusaste",
  "broadband_1000mbit_pct": "Gigabitin laajakaista saatavilla",
  "broadband_100mbit_pct": "Vähintään 100 Mbit/s laajakaista saatavilla",
  "broadband_300mbit_pct": "Vähintään 300 Mbit/s laajakaista saatavilla",
  "broadband_30mbit_pct": "Vähintään 30 Mbit/s laajakaista saatavilla",
  "foreign_background_pct": "Ulkomaalaistaustaiset",
  "foreign_language_speakers_pct": "Vieraskieliset",
  "median_disposable_income": "Käytettävissä olevien tulojen mediaani",
};

/** The Region's name in `lang`, by Sotkanet code. */
export function regionName(code: string, nameEn: string, lang: Lang): string {
  return lang === "fi" ? REGION_FI[code] ?? nameEn : nameEn;
}

const INDICATOR_EN: Record<string, string> = {
  "13": "Referrals processed within 3 days",
  "2297": "Kela medical travel reimbursements",
  "2298": "Kela medical travel costs",
  "2299": "Kela medical travel trips",
  "2300": "Kela medical travel users",
  "2331": "Population density",
  "2475": "Outpatient visits in oncology and radiotherapy",
  "3213": "Kela medical travel reimbursements per inhabitant",
  "3227": "Kela medical travel costs per inhabitant",
  "3228": "Kela medical travel costs per client",
  "3336": "Patients waiting over 6 months for specialised care",
  "3620": "Cervical cancer screening attendance",
  "3621": "Breast cancer screening attendance",
  "3625": "Breast cancer five-year relative survival",
  "3626": "Cervical cancer five-year relative survival",
  "3627": "Bowel cancer five-year relative survival",
  "3892": "Vacant health-centre physician positions",
  "5033": "Referrals processed after more than 21 days",
  "5395": "Entitled to special refunds on cancer medicines",
  "5643": "Cancer index, age-standardised",
  "6103": "Colorectal cancer screening attendance",
  "at_risk_of_poverty_rate": "At-risk-of-poverty rate",
  "broadband_1000mbit_pct": "Gigabit broadband available",
  "broadband_100mbit_pct": "Broadband of at least 100 Mbit/s available",
  "broadband_300mbit_pct": "Broadband of at least 300 Mbit/s available",
  "broadband_30mbit_pct": "Broadband of at least 30 Mbit/s available",
  "foreign_background_pct": "People with a foreign background",
  "foreign_language_speakers_pct": "Foreign-language speakers",
  "median_disposable_income": "Median disposable income",
};

/** The indicator's Finnish name looked up by its English one, for prose the
 *  api composed out of English names before the UI ever saw it. */
export function indicatorNameFromEnglish(nameEn: string, lang: Lang): string {
  if (lang !== "fi") return nameEn;
  for (const [code, fi] of Object.entries(INDICATOR_FI)) {
    if (INDICATOR_EN[code] === nameEn) return fi;
  }
  return nameEn;
}

/** The indicator's name in `lang`, by Sotkanet id. */
export function indicatorName(code: string, nameEn: string, lang: Lang): string {
  return lang === "fi" ? INDICATOR_FI[code] ?? nameEn : nameEn;
}
