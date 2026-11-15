/** Finnish/English for the whole interface.
 *
 *  Keys are the English source string, so a missing translation renders the
 *  English rather than a key name like `region.title`. With ~500 strings and
 *  no native-speaker review yet (#21), showing real English is the better
 *  failure: a judge reads a sentence, not a broken identifier.
 *
 *  Finnish copy here is unreviewed. `common/common/template.py` remains the
 *  authority for Narrative wording; NARRATIVE below is a faithful port of it
 *  so the api does not have to serve two languages.
 */

export type Lang = "en" | "fi";

export const LANGS: Lang[] = ["en", "fi"];

/** Where the chosen language is stored. Defined here rather than in
 *  lib/lang.tsx because that file is "use client": a server component
 *  importing a plain value from a client module gets a client reference,
 *  not the string -- which silently reads the wrong cookie name and leaves
 *  every visitor in English. */
export const LANG_COOKIE = "lang";

/** Narrow whatever the cookie holds to a language we actually have. */
export function toLang(value: string | undefined): Lang {
  return value === "fi" ? "fi" : "en";
}

/** Interface strings. English on the left exactly as it appears in the code. */
const FI: Record<string, string> = {};

/** Register a block of translations. Split by area purely so the file reads
 *  in the same order as the interface does. */
function add(block: Record<string, string>) {
  for (const [en, fi] of Object.entries(block)) FI[en] = fi;
}

// --- Shell, navigation, roles -----------------------------------------------
add({
  "Decision Map": "Päätöskartta",
  "Programmes": "Ohjelmat",
  "Region": "Alue",
  "Regions": "Alueet",
  "Team": "Tiimi",
  "State Decision Maker": "Valtion päättäjä",
  "Regional Decision Maker": "Alueen päättäjä",
  "Switch account": "Vaihda käyttäjää",
  "Sample account": "Esimerkkikäyttäjä",
  "Sample accounts": "Esimerkkikäyttäjät",
  "Back": "Takaisin",
  "Back to the map": "Takaisin kartalle",
  "English": "English",
  "Finnish": "Suomi",
  "Language": "Kieli",
});

// --- Measurement vocabulary (GLOSSARY.md) -----------------------------------
add({
  "Gap": "Ero",
  "Gaps": "Erot",
  "Target": "Tavoite",
  "Severity": "Kiireellisyys",
  "Narrative": "Kuvaus",
  "Indicator": "Indikaattori",
  "Indicators": "Indikaattorit",
  "Value": "Arvo",
  "Year": "Vuosi",
  "Rank": "Sijoitus",
  "ok": "ok",
  "watch": "seuraa",
  "act": "toimi",
  "OK": "OK",
  "Watch": "Seuraa",
  "Act": "Toimi",
  "Needs action": "Vaatii toimia",
  "No target": "Ei tavoitetta",
  "below target": "alle tavoitteen",
  "above target": "yli tavoitteen",
  "at target": "tavoitteessa",
  "of": "/",
  "No data": "Ei tietoa",
  "No data for this year": "Ei tietoa tältä vuodelta",
});

// --- Accounts and directives (Shell) ----------------------------------------
add({
  "My directives": "Omat määräykset",
  "unread directives": "lukematonta määräystä",
  "No unread directives": "Ei lukemattomia määräyksiä",
  "Signed in as": "Kirjautuneena",
  "Director, Cancer Programme": "Johtaja, syöpäohjelma",
  "Ministry of Social Affairs and Health (STM)": "Sosiaali- ja terveysministeriö (STM)",
  "Head of Screening Services": "Seulontapalvelujen päällikkö",
  "City of Helsinki": "Helsingin kaupunki",
  "Lapland wellbeing services county": "Lapin hyvinvointialue",
  "Vantaa and Kerava wellbeing services county": "Vantaan ja Keravan hyvinvointialue",
});

// --- Decision Map / Explorer ------------------------------------------------
add({
  "Decision map: where cancer care falls short of target": "Päätöskartta: missä syövänhoito jää tavoitteesta",
  "Indicators needing action": "Toimia vaativat indikaattorit",
  "indicators needing action": "toimia vaativaa indikaattoria",
  "{v} of {n} indicators need action": "{v}/{n} indikaattoria vaatii toimia",
  ", ranked {rank} of {n}": ", sijoitus {rank}/{n}",
  "Shade by": "Väritä",
  "Find a Region": "Hae aluetta",
  "Find a Region by name": "Hae aluetta nimellä",
  "Worst overall is": "Heikoin kokonaisuutena on",
  "with {n}": "jolla {n}",
  "{region} has no reading": "{region}: ei lukemaa",
  "Pick a Region on the map.": "Valitse alue kartalta.",
  "{total} indicator readings across {n} Regions need action this year. No Region is uniformly the problem, which is why this shows each indicator separately rather than one combined score.":
    "{total} indikaattorilukemaa {n} alueella vaatii toimia tänä vuonna. Mikään alue ei ole kauttaaltaan ongelma, ja juuri siksi tässä näytetään jokainen indikaattori erikseen yhden yhdistetyn pistemäärän sijaan.",
  "Map": "Kartta",
  "Table": "Taulukko",
  "View": "Näkymä",
});

// --- Map and zoom -----------------------------------------------------------
add({
  "Map of Finland's 23 Regions. Click a Region for its profile; drag to pan, scroll to zoom.":
    "Suomen 23 aluetta kartalla. Napsauta aluetta nähdäksesi sen profiilin; raahaa siirtääksesi, vieritä zoomataksesi.",
  "Helsinki and region": "Helsinki ja pääkaupunkiseutu",
  "Zoom in": "Lähennä",
  "Zoom out": "Loitonna",
  "Fit all of Finland": "Sovita koko Suomi",
  "Zoom to the selected Region": "Lähennä valittuun alueeseen",
});

// --- Region table -----------------------------------------------------------
add({
  "All {n} Regions, sorted worst first. Click a column to re-rank, or a row to open that Region.":
    "Kaikki {n} aluetta, heikoin ensin. Napsauta saraketta järjestääksesi uudelleen tai riviä avataksesi alueen.",
  "Need action": "Vaatii toimia",
  "No 2024 data": "Ei vuoden 2024 tietoa",
  "At or ahead of target": "Tavoitteessa tai sen yli",
  "Close to target": "Lähellä tavoitetta",
  "rank {rank} of {n}": "sijoitus {rank}/{n}",
  "Sort by {label}": "Järjestä: {label}",
  "W": "S",
  "A": "T",
});

// --- Region panel -----------------------------------------------------------
add({
  "Of {n} indicators tracked in {year},": "Vuonna {year} seuratuista {n} indikaattorista",
  "{n} Gap needs action": "{n} ero vaatii toimia",
  "{n} Gaps need action": "{n} eroa vaatii toimia",
  "and {n} is worth watching": "ja {n} on seurannan arvoinen",
  "and {n} are worth watching": "ja {n} on seurannan arvoista",
  "What the data says": "Mitä data kertoo",
  "Explore actions": "Tarkastele toimia",
  "{n} directive is already running here, on average {pct}% complete.":
    "Täällä on jo {n} määräys käynnissä, keskimäärin {pct} % valmiina.",
  "{n} directives are already running here, on average {pct}% complete.":
    "Täällä on jo {n} määräystä käynnissä, keskimäärin {pct} % valmiina.",
  "Every Region, indicator by indicator": "Jokainen alue, indikaattori kerrallaan",
  "The shape above compares this Region with the median. This compares it with all of them, which is what says whether a Gap is local or national.":
    "Yllä oleva kuvio vertaa tätä aluetta mediaaniin. Tämä vertaa sitä kaikkiin alueisiin, mikä kertoo, onko ero paikallinen vai valtakunnallinen.",
  "Structural context": "Rakenteellinen tausta",
  "Factors that might explain a Gap rather than measure one, shown against the national median because a number like 19.6% only means something next to what is normal.":
    "Tekijöitä, jotka voivat selittää eron sen sijaan että mittaisivat sitä. Ne näytetään suhteessa valtakunnalliseen mediaaniin, koska luku kuten 19,6 % merkitsee jotakin vasta tavanomaiseen verrattuna.",
  "Read these as a signal, not a cause.": "Lue nämä signaalina, ei syynä.",
  "These are area-level patterns. They tell you where to look, not who is affected.":
    "Nämä ovat aluetason havaintoja. Ne kertovat, mistä kannattaa etsiä, eivät sitä, keitä asia koskee.",
  "Above": "Yli",
  "At or below": "Tasolla tai alle",
  "the {median}{suffix} national median": "valtakunnallisen mediaanin ({median}{suffix})",
});

export { FI as TRANSLATIONS };

/** The English string's translation in `lang`, or the English itself. */
export function t(lang: Lang, en: string): string {
  return lang === "fi" ? FI[en] ?? en : en;
}

/** A sentence with placeholders: tf(lang, "{n} of {m} Regions", {n: 3, m: 23}).
 *  The placeholders are the contract between the two languages, so Finnish
 *  may put them in a different order -- which it often must, since Finnish
 *  inflects where English uses a preposition. */
export function tf(lang: Lang, en: string, vars: Record<string, string | number>): string {
  let out = t(lang, en);
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** At most two decimals, no trailing zeros; decimal comma in Finnish.
 *  Mirrors `format_number` in common/common/template.py. */
export function fmtNumber(x: number, lang: Lang): string {
  const s = (x === 0 ? Math.abs(x) : x).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return lang === "fi" ? s.replace(".", ",") : s;
}

/** Units as the api spells them, in Finnish. A unit it does not know is
 *  returned unchanged rather than guessed at. */
const UNIT_FI: Record<string, string> = {
  "%": "%",
  "% of invited": "% kutsutuista",
  "% of referrals received": "% saapuneista lähetteistä",
  "% of physician positions": "% lääkäritehtävistä",
  "% of population": "% väestöstä",
  "% of households": "% kotitalouksista",
  "% of dwelling population": "% asuntoväestöstä",
  "EUR": "euroa",
  "EUR per inhabitant": "euroa / asukas",
  "EUR per client": "euroa / asiakas",
  "EUR per consumption unit": "euroa / kulutusyksikkö",
  "trips": "matkaa",
  "users": "käyttäjää",
  "visits": "käyntiä",
  "inhabitants per km²": "asukasta / km²",
  "per 10 000 inhabitants": "/ 10 000 asukasta",
  "index (whole country = 100)": "indeksi (koko maa = 100)",
};

export function unitLabel(unit: string, lang: Lang): string {
  return lang === "fi" ? UNIT_FI[unit] ?? unit : unit;
}

/** A deviation in a percentage unit is in percentage points. */
export function isPercent(unit: string): boolean {
  return unit.trim().startsWith("%");
}

/** Proper nouns keep their capital when an indicator name is dropped into the
 *  middle of a sentence. `template.py` lowercases the first letter unless the
 *  second is uppercase, which protects acronyms like HPV but turns "Kelan"
 *  into "kelan" -- wrong, Kela is an institution. */
const KEEPS_CAPITAL = /^(Kela|Kelan|Suomi|Suomen|Åland|Ahvenanmaa|Helsing|Posti|Kanta|Traficom|Findata|Valvira|THL|STM|DVV|AVI|HPV)/;

function lowerFirst(name: string): string {
  if (name.length < 2) return name;
  if (KEEPS_CAPITAL.test(name)) return name;
  if (!/[a-zåäö]/.test(name[1])) return name; // acronym, e.g. "HPV ..."
  return name[0].toLowerCase() + name.slice(1);
}

/** The shape the Narrative needs out of a Gap. */
export type NarrativeGap = {
  year: number;
  value: number;
  reference_kind: string;
  reference_value: number | null;
  deviation: number | null;
  direction: string;
  rank: number | null;
  n_regions: number | null;
};

const NARRATIVE: Record<string, string> = {
  target:
    "{region}: {indicator} {value}{unit} vuonna {year}, {abs_dev} {dev_unit} {direction} tavoitteen ({reference}{unit}). Sijoitus {rank}/{n}.",
  peer_median:
    "{region}: {indicator} {value}{unit} vuonna {year}, {abs_dev} {dev_unit} {direction} alueiden mediaanin ({reference}{unit}). Sijoitus {rank}/{n}.",
  at_target:
    "{region}: {indicator} {value}{unit} vuonna {year}, tavoitteen ({reference}{unit}) tasolla. Sijoitus {rank}/{n}.",
  at_peer_median:
    "{region}: {indicator} {value}{unit} vuonna {year}, alueiden mediaanin ({reference}{unit}) tasolla. Sijoitus {rank}/{n}.",
};

const DIRECTION_FI: Record<string, string> = { above: "yli", below: "alle" };

/** The Finnish Template sentence for one Gap -- a port of `template_sentence`
 *  in common/common/template.py, so the api keeps serving English only.
 *  Returns null when the Gap lacks what the sentence needs, and the caller
 *  then keeps the api's English Narrative. */
export function narrativeFi(
  gap: NarrativeGap,
  regionNameFi: string,
  indicatorNameFi: string,
  unit: string,
): string | null {
  if (gap.reference_value == null || gap.deviation == null || gap.rank == null || gap.n_regions == null) {
    return null;
  }
  const key = gap.direction !== "at" ? gap.reference_kind : `at_${gap.reference_kind}`;
  const template = NARRATIVE[key];
  if (!template) return null;

  const percent = isPercent(unit);
  const unitText = percent ? " %" : ` ${unitLabel(unit, "fi")}`;
  const devUnit = percent ? "prosenttiyksikköä" : unitLabel(unit, "fi");

  return template
    .replace("{region}", regionNameFi)
    .replace("{indicator}", lowerFirst(indicatorNameFi))
    .replace("{year}", String(gap.year))
    .replace("{value}", fmtNumber(gap.value, "fi"))
    .replaceAll("{reference}", fmtNumber(gap.reference_value, "fi"))
    .replace("{abs_dev}", fmtNumber(Math.abs(gap.deviation), "fi"))
    .replace("{dev_unit}", devUnit)
    .replace("{direction}", DIRECTION_FI[gap.direction] ?? "")
    .replaceAll("{unit}", unitText)
    .replace("{rank}", String(gap.rank))
    .replace("{n}", String(gap.n_regions));
}
