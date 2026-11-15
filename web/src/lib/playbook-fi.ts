/** The playbook in Finnish.
 *
 *  buildPlaybook() composes the English chain; this table supplies the same
 *  phases, steps and counterparties in Finnish, keyed by the ids that chain
 *  already uses. Anything missing here falls back to the English, so a step
 *  added later shows real text rather than a blank.
 *
 *  {region} and {profile} are substituted after lookup, because Finnish puts
 *  them in different places in the sentence than English does.
 */

import type { PlaybookPhase } from "@/lib/playbook";
import type { Lang } from "@/lib/i18n";

const PHASE_FI: Record<string, { name: string; summary: string }> = {
  mandate: {
    name: "Valtakunnallinen toimeksianto",
    summary:
      "Mitä valtio antoi ja mihin näyttöön se nojaa. Valmis ennen kuin alueelle ilmoitetaan.",
  },
  cohort: {
    name: "Määritä, keneen ollaan yhteydessä",
    summary:
      "Viesti väärälle listalle on pahempi kuin ei viestiä lainkaan. Kohdejoukko rakennetaan seulontarekisteristä, ei arviosta.",
  },
  lawful: {
    name: "Selvitä oikeusperuste",
    summary:
      "Kun terveysviranomainen on yhteydessä nimettyihin henkilöihin heidän syöpäseulonnastaan, tarvitaan dokumentoitu peruste.",
  },
  content: {
    name: "Kirjoita ja hyväksy viesti",
    summary:
      "Sisältö, joka on kliinisesti oikein, juridisesti selkeä ja aidosti luettava niille, joille se on tarkoitettu.",
  },
  channel: {
    name: "Avaa kanava",
    summary:
      "Oma Kanta on yksi kanava eikä se tavoita kaikkia. Varakanava järjestetään ennen lähetystä.",
  },
  deliver: {
    name: "Lähetä ja seuraa",
    summary:
      "Pilotti ennen täyttä lähetystä, jotta väärä linkki maksaa 300 ihmistä eikä 30 000.",
  },
  demand: {
    name: "Paikanna tarve",
    summary:
      "Ennen auton hankintaa selvitetään, missä osallistumatta jättäneet tosiasiassa asuvat.",
  },
  procure: {
    name: "Hanki kapasiteetti",
    summary:
      "Liikkuva yksikkö tai kuljetuskumppanuus on hankinta, ja kynnysarvon ylittyessä julkinen hankinta.",
  },
  sites: {
    name: "Varmista toimipaikat",
    summary: "Auto tarvitsee pysäköintipaikan, sähkön ja röntgenhoitajan työvuorot.",
  },
  run: {
    name: "Julkaise ja toteuta",
    summary: "Aikataulu toimii vain, jos ne joille se tehtiin tietävät siitä.",
  },
  owner: {
    name: "Etsi vastuullinen omistaja",
    summary:
      "Viesti laitokselle ei ole viesti kenellekään. Tämä vaihe päättyy nimettyyn henkilöön.",
  },
  assess: {
    name: "Selvitä, mikä tosiasiassa rajoittaa",
    summary:
      "Valtakunnallinen data kertoo, että ero on olemassa. Vain alue voi kertoa, mistä se johtuu.",
  },
  commit: {
    name: "Saa päätös kirjatuksi",
    summary:
      "Kohta, jossa alue joko sitoutuu korjaukseen tai toteaa virallisesti, ettei pysty siihen.",
  },
  oversee: {
    name: "Sulje kierros",
    summary: "Mitä tapahtuu, jos vastausta ei kuulu — kirjattuna etukäteen.",
  },
};

const STEP_FI: Record<string, { title: string; detail: string; output: string }> = {
  "mandate-evidence": {
    title: "Liitä näyttöpaketti",
    detail:
      "Ero, joka käynnisti tämän toimen, sen taustalla oleva vertailu muihin alueisiin, rakenteelliset kovariaatit jotka selittävät sitä ja jotka eivät selitä, sekä kansallisen syöpästrategian kohta jota se toteuttaa — koottuna niin, että alue voi kiistää perustelun eikä vain vastaanottaa käskyä.",
    output: "Näyttöpaketti (ero, vertailualueet, kovariaatit, strategiaviite)",
  },
  "mandate-issue": {
    title: "Anna määräys alueelle",
    detail:
      "Muodollinen ilmoitus alueelle {region} vastausmääräaikoineen. Valtion osuus pysähtyy tähän: alue omistaa jokaisen seuraavan vaiheen, ja valtio näkee vain sen edistymisen, jonka alue raportoi.",
    output: "Annettu määräys lakisääteisine vastausaikoineen",
  },
  "cohort-query": {
    title: "Rakenna kohdejoukko seulontarekisteristä",
    detail:
      "Haetaan joukkotarkastusrekisteristä {profile} — ohjelmaan kutsutut, tällä alueella, jotka eivät ole vielä osallistuneet tällä kierroksella. Tuottaa lasketun ja toistettavan listan arvioidun kohderyhmän sijaan.",
    output: "Kohdejoukon määritelmä ja henkilömäärä",
  },
  "cohort-contact": {
    title: "Selvitä yhteystiedot ja rekisteröity kieli",
    detail:
      "Kohdejoukko täsmäytetään väestötietojärjestelmään nykyisen osoitteen ja sinne merkityn äidinkielen osalta — se ratkaisee, millä kielellä kunkin viesti kirjoitetaan.",
    output: "Tavoitettava kohdejoukko ja kielijakauma",
  },
  "lawful-basis": {
    title: "Kirjaa oikeusperuste ja tee vaikutustenarviointi",
    detail:
      "Varmistetaan, että kyse on operatiivisesta käytöstä hyvinvointialueen oman lakisääteisen seulontatehtävän sisällä eikä toissijaisesta käytöstä. Dokumentoidaan peruste, tehdään tietosuojan vaikutustenarviointi ja asetetaan yhteystietolistan säilytysaika.",
    output: "Allekirjoitettu vaikutustenarviointi ja kirjattu oikeusperuste",
  },
  "content-draft": {
    title: "Laadi kutsu ja muistutus",
    detail:
      "Kaksi viestiä, ei yhtä: kutsu ja jatkoviesti niille jotka eivät vastanneet. Kirjoitettuna selkokielen vaatimusten mukaisesti, ajanvaraus ensimmäisessä virkkeessä.",
    output: "Hyväksytty teksti molempiin aaltoihin",
  },
  "content-translate": {
    title: "Käännä alueen todellisille yleisimmille kielille",
    detail:
      "Ei yleistä käännöspakettia vaan ne kielet, jotka kohdejoukon oma DVV:n kielitieto näyttää, tuotettuna yhdessä järjestöjen kanssa niin että sanamuoto osuu eikä vain käänny.",
    output: "Tarkistetut käännökset kielittäin",
  },
  "content-clinical": {
    title: "Kliininen hyväksyntä",
    detail:
      "Alueen seulonnasta vastaava ylilääkäri vahvistaa, että viesti on kliinisesti oikein ja että sen lupaama polku — aika, paikka ja jatkohoito — on olemassa ja siinä on kapasiteettia.",
    output: "Kliininen hyväksyntä kirjattuna",
  },
  "channel-kanta": {
    title: "Rekisteröi viestipohja Kantaan",
    detail:
      "Kelan on hyväksyttävä viestipohja, lähettäjätunnus ja lähetysaikataulu ennen kuin Oma Kanta välittää sen. Tämä on toimitusaikariippuvainen kohta ja tavallisin syy kampanjan viivästymiseen.",
    output: "Hyväksytty Kanta-pohja ja lähetysikkuna",
  },
  "channel-fallback": {
    title: "Järjestä ei-digitaalinen varakanava",
    detail:
      "Suomi.fi-viestit niille jotka ovat ottaneet ne käyttöön, ja painettu kirje Postin kautta kaikille muille. Noin viidennes mistä tahansa kutsutusta joukosta on tavoitettavissa vain paperilla.",
    output: "Varakanava sopimuksineen ja testattuna",
  },
  "channel-fallback-low": {
    title: "Ota tekstiviesti ja puhelu ensisijaiseksi varakanavaksi",
    detail:
      "Siellä missä nopeaa kotilaajakaistaa on niukasti, sovellusilmoitus on väärä oletus. Sovitaan tekstiviestiyhdyskäytävästä ja puhutusta linjasta, ja Kantaa käsitellään toissijaisena kanavana eikä ensimmäisenä.",
    output: "Varakanava sopimuksineen ja testattuna",
  },
  "channel-access": {
    title: "Saavutettavuuden vaatimustenmukaisuuden tarkistus",
    detail:
      "Laki digitaalisten palvelujen tarjoamisesta koskee tätä viestiä. Ruudunlukijan lukujärjestys, kontrasti ja selkokielen taso tarkistetaan ennen lähetystä, koska lähetyksen jälkeen havaittu puute tarkoittaa uudelleenlähetystä koko kohdejoukolle.",
    output: "Kampanjan saavutettavuusseloste",
  },
  "deliver-pilot": {
    title: "Pilottiaalto 10 %:lle kohdejoukosta",
    detail:
      "Yksi kunta, yksi viikko. Mittaa perillemenon, palautuneet viestit ja ajanvarausten osuuden ennen kuin loppu kohdejoukosta sidotaan.",
    output: "Pilotin tulokset ja go / no-go -päätös",
  },
  "deliver-full": {
    title: "Täysi lähetys aikataulutetuissa aalloissa",
    detail:
      "Porrastettuna viikoille, jotta ajanvarausjärjestelmä ja seulontapisteet vastaanottavat viestin synnyttämän kysynnän — onnistunut kampanja, josta kukaan ei saa aikaa, on epäonnistuminen.",
    output: "Koko kohdejoukko tavoitettu, kanavittain",
  },
  "deliver-monitor": {
    title: "Raportoi osallistuminen takaisin kansalliseen ohjelmaan",
    detail:
      "Osallistuminen mitataan uudelleen alueen omaan lähtötasoon nähden ja viedään seulontarekisteriin, mikä on tapa jolla valtion oma indikaattori liikkuu ja jolla tämä määräys lopulta sulkeutuu.",
    output: "Osallistumisen muutos raportoitu THL:lle ja STM:lle",
  },
  "demand-map": {
    title: "Kartoita osallistumattomuus suhteessa matkan pituuteen",
    detail:
      "Osallistuminen kunnittain seulontarekisteristä, verrattuna etäisyyteen lähimpään seulontapisteeseen ja alueen omiin Kelan matkakorvauksiin. Tunnistaa kunnat, joissa välimatka on todellinen rajoite eikä oletettu.",
    output: "Priorisoitu lista kohdekunnista",
  },
  "procure-option": {
    title: "Hinnoittele liikkuva yksikkö suhteessa matkatukeen",
    detail:
      "Kaksi reittiä samaan lopputulokseen: viedään seulonta asukkaan luo tai maksetaan asukkaan matka. Hinnoiteltuna lisäosallistumista kohden, jotta valinta tehdään vaikutuksen eikä hankinnan helppouden perusteella.",
    output: "Vaihtoehtojen arviointi ja hinta lisäosallistumista kohden",
  },
  "procure-notice": {
    title: "Toteuta hankinta",
    detail:
      "EU-kynnysarvon ylittyessä tämä on Hilma-ilmoitus omine lakisääteisine aikatauluineen, ja juuri se aikataulu — ei kliininen työ — ratkaisee milloin ensimmäinen auto voi liikkua.",
    output: "Tehty hankintasopimus",
  },
  "sites-agree": {
    title: "Sovi paikat ja kulkuyhteydet kunkin kunnan kanssa",
    detail:
      "Pysäköinti, sähkö, jätehuolto ja odotustila joka on riittävän yksityinen seulontakäyntiin. Sovitaan kunnittain, koska kukin kunta omistaa omat tilansa.",
    output: "Allekirjoitetut sopimukset toimipaikoista",
  },
  "sites-staff": {
    title: "Rakenna työvuorot ja varmista kliininen kate",
    detail:
      "Röntgenhoitaja ja kliininen kate jokaiselle aikataulutetulle pysähdykselle, mukaan lukien kapasiteetti yksikön tuottamien kuvien lausumiseen — pullonkaula on yleensä lausunnassa, ei kuvauksessa.",
    output: "Vahvistetut työvuorot ja lausuntakapasiteetti",
  },
  "run-invite": {
    title: "Julkaise aikataulu ja kutsu kohdejoukko",
    detail:
      "Pysähdyskohtaiset kutsut Kannan kautta paperivarmistuksella, ajoitettuna niin että kukin kunta kuulee omasta päivämäärästään eikä koko alue kaikista.",
    output: "Julkaistu aikataulu, kohdejoukko kutsuttu pysähdyksittäin",
  },
  "run-monitor": {
    title: "Raportoi osallistumisen muutos pysähdyksittäin",
    detail:
      "Osallistuminen kunnittain ennen ja jälkeen, raportoituna seulontarekisteriin — se kertoo valtiolle, toimiko auto vai siirsikö se vain osallistumista.",
    output: "Kuntakohtainen osallistumisen muutos",
  },
  "owner-identify": {
    title: "Nimeä vastuullinen johtaja ja päättävä toimielin",
    detail:
      "Palvelulinjan johtaja joka voi muuttaa asiaa, ja alueen {region} hallitus joka rahoittaa sen. Yleisesti hyvinvointialueelle osoitettu määräys on sellainen, johon kenenkään ei tarvitse vastata.",
    output: "Nimetty omistaja ja päättävä toimielin",
  },
  "assess-capacity": {
    title: "Kapasiteetti- ja aikatauluarvio",
    detail:
      "Miehitetyt ajat suhteessa saapuneisiin lähetteisiin kuukausittain kyseisessä palvelussa. Erottaa henkilöstövajeen aikataulutusongelmasta — valtakunnallisissa luvuissa ne näyttävät samalta ja vaativat päinvastaiset korjaukset.",
    output: "Kapasiteettiarvio, jossa sitova rajoite on nimetty",
  },
  "assess-cost": {
    title: "Hinnoittele realistiset vaihtoehdot",
    detail:
      "Mitä eron sulkeminen vaatisi viroissa ja euroissa verrattuna siihen mitä alueella nyt on. Tuottaa luvun, jonka hallitus tosiasiassa tarvitsee päätöksen tekemiseen.",
    output: "Hinnoitellut vaihtoehdot hallitukselle",
  },
  "commit-board": {
    title: "Vie korjaussuunnitelma aluehallitukseen",
    detail:
      "Päivätty suunnitelma välitavoitteineen, tai dokumentoitu toteamus siitä miksi eroa ei voida sulkea nykyisillä voimavaroilla — mikä on sinänsä hyödyllinen vastaus ja se, joka perustelee kansallisen toimen.",
    output: "Hallituksen päätös: korjaussuunnitelma tai todettu rajoite",
  },
  "oversee-report": {
    title: "Raportoi edistyminen välitavoitteita vasten",
    detail:
      "Kuukausittain suunnitelman omia välitavoitteita vasten kansalliseen seurantaan — niin että valtio näkee liikkeen eikä joudu kysymään sitä.",
    output: "Kuukausittainen edistyminen välitavoitteita vasten",
  },
  "oversee-escalate": {
    title: "Eskalaatiopolku, jos vastausaika umpeutuu",
    detail:
      "Jos suunnitelmaa ei tule eikä rajoitetta todeta, valvonta siirtyy aluehallintovirastolle ja sieltä Valviralle. Todettu heti alussa, jotta se on tiedossa oleva seuraus eikä yllätys.",
    output: "Eskalaatio kirjattu tai suljettu tarpeettomana",
  },
};

const ROLE_FI: Record<string, string> = {
  "Ministry of Social Affairs and Health — owns the National Cancer Strategy":
    "Sosiaali- ja terveysministeriö — omistaa kansallisen syöpästrategian",
  "Finnish Institute for Health and Welfare — steers and monitors the national screening programme":
    "Terveyden ja hyvinvoinnin laitos — ohjaa ja seuraa kansallista seulontaohjelmaa",
  "Finnish Cancer Registry — holds the screening invitation and attendance register":
    "Suomen Syöpärekisteri — ylläpitää seulontakutsu- ja osallistumisrekisteriä",
  "Social Insurance Institution — operates Kanta services and travel reimbursement":
    "Kansaneläkelaitos — ylläpitää Kanta-palveluja ja matkakorvauksia",
  "Kela's national patient data service and citizen portal":
    "Kelan kansallinen potilastiedon palvelu ja kansalaisen asiointiportaali",
  "Digital and Population Data Services Agency — Population Information System and Suomi.fi Messages":
    "Digi- ja väestötietovirasto — väestötietojärjestelmä ja Suomi.fi-viestit",
  "Health and Social Data Permit Authority — permits secondary use of health data":
    "Sosiaali- ja terveysalan tietolupaviranomainen — myöntää luvat terveystiedon toissijaiseen käyttöön",
  "National Supervisory Authority for Welfare and Health — escalation if a statutory duty goes unmet":
    "Sosiaali- ja terveysalan lupa- ja valvontavirasto — eskalaatio, jos lakisääteinen velvoite jää täyttämättä",
  "Regional State Administrative Agency — regional supervision of social and health services":
    "Aluehallintovirasto — sosiaali- ja terveyspalvelujen alueellinen valvonta",
  "Postal operator — paper fallback for people who do not use Kanta":
    "Postiyhtiö — paperivarmistus niille jotka eivät käytä Kantaa",
  "National public procurement notice channel — required above the EU threshold":
    "Kansallinen julkisten hankintojen ilmoituskanava — pakollinen EU-kynnysarvon ylittyessä",
  "Transport and Communications Agency — broadband and mobile coverage data":
    "Liikenne- ja viestintävirasto — laajakaista- ja mobiilipeittotiedot",
  "The wellbeing services county responsible for delivering the service":
    "Palvelun järjestämisestä vastaava hyvinvointialue",
  "Decides the county's budget and service commitments":
    "Päättää alueen talousarviosta ja palvelusitoumuksista",
  "Own the local sites, venues and road access the delivery depends on":
    "Omistavat paikalliset tilat, toimipaikat ja kulkuyhteydet, joista toteutus riippuu",
  "Reach the groups a letter from the county does not":
    "Tavoittavat ne ryhmät, joita hyvinvointialueen kirje ei tavoita",
};

/** Workflow profiles, which are spliced into a step's detail. */
const PROFILE_FI: Record<string, string> = {
  "invitees whose recorded native language is not Finnish or Swedish":
    "kutsutut, joiden rekisteröity äidinkieli ei ole suomi tai ruotsi",
  "all invitees in this Region": "kaikki tämän alueen kutsutut",
  "all invitees in this Region (SMS/voice channel)":
    "kaikki tämän alueen kutsutut (tekstiviesti- ja puhekanava)",
  "the invited population": "kutsuttu väestö",
};

export function profileFi(profile: string, lang: Lang): string {
  return lang === "fi" ? PROFILE_FI[profile] ?? profile : profile;
}

/** Swap an English chain for the Finnish one, keyed by id. */
export function localizePhases(
  phases: PlaybookPhase[],
  lang: Lang,
  vars: { region: string; profile: string },
): PlaybookPhase[] {
  if (lang !== "fi") return phases;
  const fill = (s: string) => s.replaceAll("{region}", vars.region).replaceAll("{profile}", vars.profile);

  return phases.map((phase) => {
    const p = PHASE_FI[phase.id];
    return {
      ...phase,
      name: p?.name ?? phase.name,
      summary: p?.summary ?? phase.summary,
      steps: phase.steps.map((step) => {
        // The fallback step has two forms; the low-bandwidth one is a
        // different sentence, not a reworded one.
        const key =
          step.id === "channel-fallback" && step.title.startsWith("Set up SMS")
            ? "channel-fallback-low"
            : step.id;
        const fi = STEP_FI[key];
        return {
          ...step,
          title: fi?.title ?? step.title,
          detail: fi ? fill(fi.detail) : step.detail,
          output: fi?.output ?? step.output,
          counterparties: step.counterparties.map((c) => ({
            ...c,
            role: ROLE_FI[c.role] ?? c.role,
          })),
        };
      }),
    };
  });
}
