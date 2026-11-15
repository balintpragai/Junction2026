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
  "Drag to pan, scroll to zoom, double-click to frame a Region":
    "Raahaa siirtääksesi, vieritä zoomataksesi, kaksoisnapsauta rajataksesi alueen",
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

// --- Pages, empty states, errors --------------------------------------------
add({
  "Back to the decision map": "Takaisin päätöskartalle",
  "Back to the Decision Map": "Takaisin päätöskartalle",
  "Go to the Decision Map": "Siirry päätöskartalle",
  "What could help in {region}": "Mikä voisi auttaa: {region}",
  "Each action expands into the chain of work it sets off, so you are issuing a programme rather than sending a message.":
    "Jokainen toimi avautuu työketjuksi, jonka se käynnistää, joten annat ohjelman etkä lähetä viestiä.",
  "No such Region": "Aluetta ei löydy",
  "The code in that link does not match any of Finland’s 23 Regions. It may have been mistyped, or the link may predate a change to how Regions are named.":
    "Linkin koodi ei vastaa mitään Suomen 23 alueesta. Se on voitu kirjoittaa väärin, tai linkki on vanhempi kuin alueiden nimeämiseen tehty muutos.",
  "This screen could not load": "Näkymää ei voitu ladata",
  "Usually this means the API is unreachable. Check that it is running and that API_URL points at it, then try again.":
    "Yleensä tämä tarkoittaa, ettei rajapintaan saada yhteyttä. Tarkista, että se on käynnissä ja että API_URL osoittaa siihen, ja yritä uudelleen.",
  "Reference {digest}": "Viite {digest}",
  "Try again": "Yritä uudelleen",
  "Loading the Decision Map": "Ladataan päätöskarttaa",
  "Could not reach the API": "Rajapintaan ei saatu yhteyttä",
  "The stack is running but web could not read api. Check docker compose ps (five services healthy, seed exited 0), that API_URL points at api, and that the rescore job has scored Gaps — /overview should return 23 rows.":
    "Palvelut ovat käynnissä, mutta web ei saanut luettua api:a. Tarkista docker compose ps (viisi palvelua terveinä, seed päättyi koodilla 0), että API_URL osoittaa api:in ja että pisteytysajo on laskenut erot — /overview palauttaa 23 riviä.",
});

// --- Directives in flight (State) -------------------------------------------
add({
  "Directives in flight": "Käynnissä olevat määräykset",
  "What each Region has reported back. You see progress, not their working detail — assigning and sequencing the work is theirs to do.":
    "Mitä kukin alue on raportoinut takaisin. Näet edistymisen, et työn yksityiskohtia — työn jakaminen ja järjestys ovat alueen asia.",
  "Nothing issued yet": "Mitään ei ole vielä annettu",
  "Open a Region from the Decision Map and build an action plan.":
    "Avaa alue päätöskartalta ja rakenna toimintasuunnitelma.",
  "directives issued": "annettua määräystä",
  "still open": "yhä auki",
  "not started by the Region": "alue ei ole aloittanut",
  "past the response window": "vastausaika ylittynyt",
  "average progress": "keskimääräinen edistyminen",
  "{n} directive": "{n} määräys",
  "{n} directives": "{n} määräystä",
  "held by {name}, {title}": "vastuussa {name}, {title}",
  "{n} blocked": "{n} jumissa",
  "{done} of {total} steps reported": "{done}/{total} vaihetta raportoitu",
  "{n} working days of work end to end.": "{n} työpäivää työtä alusta loppuun.",
  "The Region has not started.": "Alue ei ole aloittanut.",
  "The Region has it in hand.": "Alue hoitaa asiaa.",
  "Not started": "Ei aloitettu",
  "In progress": "Käynnissä",
  "Blocked": "Jumissa",
  "Done": "Valmis",
  "urgent": "kiireellinen",
  "high": "korkea",
  "routine": "tavanomainen",
  "closed": "suljettu",
  "{n} working days overdue": "{n} työpäivää myöhässä",
  "response due today": "vastaus erääntyy tänään",
  "response due in {n} working day": "vastaus erääntyy {n} työpäivän kuluttua",
  "response due in {n} working days": "vastaus erääntyy {n} työpäivän kuluttua",
  "On target": "Tavoitteessa",
});

// --- Action planner ---------------------------------------------------------
add({
  "Add an action": "Lisää toimi",
  "Search {n} strategy actions": "Hae {n} strategiatoimesta",
  "Search all {n} National Cancer Strategy actions": "Hae kaikista {n} syöpästrategian toimesta",
  "No action matches “{query}”.": "Mikään toimi ei vastaa hakua ”{query}”.",
  "Recommended here, matched to this Region’s own Gaps:":
    "Suositellaan tänne, kohdistettuna tämän alueen omiin eroihin:",
  "No Gap in this Region triggered a recommendation — search the strategy above to add one anyway.":
    "Mikään tämän alueen ero ei laukaissut suositusta — hae strategiasta yllä ja lisää toimi silti.",
  "recommended": "suositeltu",
  "Add": "Lisää",
  "{title} is in the plan": "{title} on suunnitelmassa",
  "Add {title}": "Lisää {title}",
  "In this plan ({n})": "Tässä suunnitelmassa ({n})",
  "Nothing yet. Add a recommended action above, or search the full National Cancer Strategy.":
    "Ei vielä mitään. Lisää suositeltu toimi yltä tai hae koko kansallisesta syöpästrategiasta.",
  "{steps} steps over {days} working days": "{steps} vaihetta {days} työpäivän aikana",
  "Remove {title} from the plan": "Poista {title} suunnitelmasta",
  "Remove from plan": "Poista suunnitelmasta",
  "Strategy action": "Strategiatoimi",
  "Data-driven": "Dataan perustuva",
  "Recommended here": "Suositellaan tänne",
  "Reaches patients": "Tavoittaa potilaat",
  "Reaches institutions": "Tavoittaa laitokset",
  "Why this action, for this Region": "Miksi tämä toimi, tälle alueelle",
  "What this sets in motion": "Mitä tämä panee liikkeelle",
  "Choosing this action does not send a message. It starts the chain below — every step the Region has to complete, and every institution that has to be told, before anything reaches a patient.":
    "Tämän toimen valitseminen ei lähetä viestiä. Se käynnistää alla olevan ketjun — jokaisen vaiheen, joka alueen on suoritettava, ja jokaisen laitoksen, jolle on ilmoitettava, ennen kuin mikään tavoittaa potilaan.",
  "Add an action to see the chain of work it implies — the steps, the institutions that have to be notified, and how long it actually takes.":
    "Lisää toimi nähdäksesi työketjun, jonka se edellyttää — vaiheet, ilmoitettavat laitokset ja sen, kauanko se tosiasiassa kestää.",
  "Issue to the Region": "Anna alueelle",
  "The instruction": "Ohje",
  "State the outcome and the deadline, not the method. The method is the Region’s to choose.":
    "Kerro lopputulos ja määräaika, älä menetelmää. Menetelmän valitsee alue.",
  "Priority": "Kiireellisyys",
  "Routine": "Tavanomainen",
  "High": "Korkea",
  "Urgent": "Kiireellinen",
  "High priority": "Korkea kiireellisyys",
  "{n} working days": "{n} työpäivää",
  "Issue {n} action to {region}": "Anna {n} toimi alueelle {region}",
  "Issue {n} actions to {region}": "Anna {n} toimea alueelle {region}",
  "Close the Gap addressed by this action in {region}, and report measured movement against the national target within the current screening round.":
    "Sulje tämän toimen kohteena oleva ero alueella {region} ja raportoi mitattu muutos valtakunnalliseen tavoitteeseen nähden kuluvan seulontakierroksen aikana.",
  "Close the Gap addressed by these {n} actions in {region}, and report measured movement against the national target within the current screening round.":
    "Sulje näiden {n} toimen kohteena oleva ero alueella {region} ja raportoi mitattu muutos valtakunnalliseen tavoitteeseen nähden kuluvan seulontakierroksen aikana.",
  "Foreign-background share {v}% against a {m}% national median.":
    "Ulkomaalaistaustaisten osuus {v} % suhteessa valtakunnalliseen {m} %:n mediaaniin.",
  "See the Region profile for the full evidence pack.":
    "Koko näyttöpaketti on alueen profiilissa.",
  "{n} directive issued to {region}": "{n} määräys annettu alueelle {region}",
  "{n} directives issued to {region}": "{n} määräystä annettu alueelle {region}",
  "{region} has been notified. Nothing is in motion yet, and that is correct: the Region now has to assign each step to its own team and work out the detail only it can. Progress will appear under Programmes as they report it.":
    "Alueelle {region} on ilmoitettu. Mikään ei ole vielä liikkeessä, ja se on oikein: alueen on nyt jaettava jokainen vaihe omalle tiimilleen ja ratkaistava ne yksityiskohdat, jotka vain se voi ratkaista. Edistyminen näkyy Ohjelmat-näkymässä sitä mukaa kun alue raportoi.",
  "Track it under Programmes": "Seuraa sitä Ohjelmat-näkymässä",
  "To see the other side of the handoff, switch to a Regional Decision Maker account in the menu at the top right — the directive is waiting there.":
    "Nähdäksesi luovutuksen toisen puolen vaihda alueen päättäjän käyttäjään oikean yläkulman valikosta — määräys odottaa siellä.",
});

// --- The chain (sequence view) ----------------------------------------------
add({
  "{n} day": "{n} päivä",
  "{n} days": "{n} päivää",
  "derived steps": "johdettua vaihetta",
  "working days, end to end": "työpäivää alusta loppuun",
  "bodies to notify": "ilmoitettavaa tahoa",
  "steps the Region owns": "vaihetta alueen vastuulla",
  "Who has to be involved ({n})": "Keiden on oltava mukana ({n})",
  ", {n} in parallel": ", {n} rinnakkain",
  "State": "Valtio",
  "{n} step": "{n} vaihe",
  "{n} steps": "{n} vaihetta",
  ", all done": ", kaikki valmiina",
  "day {start} to {end}": "päivä {start}–{end}",
  "day {n}": "päivä {n}",
  "start": "alku",
  "Show less about {title}": "Näytä vähemmän: {title}",
  "Show more about {title}": "Näytä lisää: {title}",
  "less": "vähemmän",
  "more": "lisää",
  "Notify": "Ilmoita",
  "Output:": "Tuotos:",
  "Gate:": "Portti:",
  "Assignee for {title}": "Vastuuhenkilö: {title}",
  "Unassigned": "Ei vastuuhenkilöä",
  "unassigned": "ei vastuuhenkilöä",
  "Status of {title}": "Tila: {title}",
  "Assigned to": "Vastuussa",
  "step": "vaihe",
  "steps": "vaihetta",
  "Screening programme lead": "Seulontaohjelman vastaava",
  "Health data analyst": "Terveysdata-analyytikko",
  "Data protection officer": "Tietosuojavastaava",
  "Chief physician, screening": "Ylilääkäri, seulonta",
  "Communications": "Viestintä",
  "Transport & logistics": "Kuljetus ja logistiikka",
  "Community liaison": "Yhteisöyhteyshenkilö",
  "Finance & procurement": "Talous ja hankinnat",
});

// --- Regional dashboard and team --------------------------------------------
add({
  "The State sets the outcome. Who does what, in which order and with which institution is yours.":
    "Valtio asettaa lopputuloksen. Kuka tekee mitä, missä järjestyksessä ja minkä laitoksen kanssa, on teidän.",
  "open directive": "avoin määräys",
  "open directives": "avointa määräystä",
  "not started": "ei aloitettu",
  "step in progress": "vaihe käynnissä",
  "steps in progress": "vaihetta käynnissä",
  "step unassigned": "vaihe ilman vastuuhenkilöä",
  "steps unassigned": "vaihetta ilman vastuuhenkilöä",
  "blocked": "jumissa",
  "Nothing has been issued to this Region": "Tälle alueelle ei ole annettu mitään",
  "When the national programme issues a directive for {org}, it arrives here with its evidence and its full chain of work. Switch to the State account to issue one.":
    "Kun kansallinen ohjelma antaa määräyksen organisaatiolle {org}, se saapuu tänne näyttöineen ja koko työketjuineen. Vaihda valtion käyttäjään antaaksesi sellaisen.",
  "Inbox": "Saapuneet",
  "{done} of {total} steps, issued {when}": "{done}/{total} vaihetta, annettu {when}",
  "today": "tänään",
  "yesterday": "eilen",
  "{n}d ago": "{n} pv sitten",
  "{n}mo ago": "{n} kk sitten",
  "From the national programme": "Kansalliselta ohjelmalta",
  "Asked of this Region:": "Alueelta pyydetään:",
  "by {date}": "määräaika {date}",
  "The evidence behind it": "Taustalla oleva näyttö",
  "{done} of {total} steps complete": "{done}/{total} vaihetta valmiina",
  "{steps} steps over {days} working days, involving {bodies} bodies":
    "{steps} vaihetta {days} työpäivän aikana, mukana {bodies} tahoa",
  "Assign the whole chain to my team": "Jaa koko ketju tiimilleni",
  "Directive views": "Määräyksen näkymät",
  "The chain": "Ketju",
  "Who and when": "Kuka ja milloin",
  "What that puts on each person": "Mitä se tarkoittaa kullekin",
  "Who is carrying what": "Kuka kantaa mitäkin",
  "Open work across every directive issued to {org}. A national playbook names a function; this is the person who holds it here.":
    "Avoin työ kaikista organisaatiolle {org} annetuista määräyksistä. Kansallinen toimintamalli nimeää tehtävän; tässä on henkilö, joka hoitaa sen täällä.",
  "{n} open": "{n} avointa",
  "{n} days assigned": "{n} päivää jaettuna",
  "{n} days existing": "{n} päivää ennestään",
  ", in progress": ", käynnissä",
  ", blocked": ", jumissa",
  "Nothing assigned from the current directives.": "Nykyisistä määräyksistä ei ole jaettu mitään.",
  "{base} days of existing work, {days} from this directive":
    "{base} päivää olemassa olevaa työtä, {days} tästä määräyksestä",
  ", {n} done": ", {n} valmiina",
});

// --- Charts -----------------------------------------------------------------
add({
  "National median": "Valtakunnallinen mediaani",
  "Point at a spoke for the figure behind it.": "Osoita sädettä nähdäksesi sen taustalla olevan luvun.",
  "{rank} of {n} Regions.": "Sijoitus {rank}/{n} alueesta.",
  "{rank} of {n}": "{rank}/{n}",
  "National median {v}.": "Valtakunnallinen mediaani {v}.",
  "Hide the numbers": "Piilota luvut",
  "Show the numbers": "Näytä luvut",
  "This Region": "Tämä alue",
  "Median": "Mediaani",
  "Not enough tracked indicators to compare shapes.":
    "Seurattuja indikaattoreita ei ole tarpeeksi muotojen vertailuun.",
  "{region} against every other Region, indicator by indicator":
    "{region} verrattuna kaikkiin muihin alueisiin, indikaattori kerrallaan",
  "Target: {v}": "Tavoite: {v}",
  "Each dot is one Region, always ordered worst to best left to right. The filled dot is {region}; the vertical rule is the national target where the indicator has one. Click any dot to open that Region.":
    "Jokainen piste on yksi alue, aina järjestyksessä heikoimmasta parhaaseen vasemmalta oikealle. Täytetty piste on {region}; pystyviiva on valtakunnallinen tavoite silloin kun indikaattorilla on sellainen. Napsauta pistettä avataksesi alueen.",
});

// --- Role gate --------------------------------------------------------------
add({
  "Loading…": "Ladataan…",
  "This screen belongs to the {role}": "Tämä näkymä kuuluu roolille {role}",
  "You are signed in as": "Olet kirjautuneena",
  "The national map covers all 23 Regions; a Regional account works from the directives issued to its own Region.":
    "Valtakunnallinen kartta kattaa kaikki 23 aluetta; alueen käyttäjä työskentelee omalle alueelleen annettujen määräysten pohjalta.",
  "Regional workflow is run by the Region's own team — the State sees reported progress, not the working detail.":
    "Alueen työnkulkua hoitaa alueen oma tiimi — valtio näkee raportoidun edistymisen, ei työn yksityiskohtia.",
  "Go to your dashboard": "Siirry omaan näkymääsi",
  "Switch accounts from the menu at the top right to see the other side.":
    "Vaihda käyttäjää oikean yläkulman valikosta nähdäksesi toisen puolen.",
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
