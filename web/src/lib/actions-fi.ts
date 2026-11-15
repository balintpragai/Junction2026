/** Candidate actions in Finnish.
 *
 *  Two different kinds of text arrive here, and they are treated differently
 *  on purpose:
 *
 *  - The five covariate-driven actions are this project's own writing
 *    (common/common/actions.py, COVARIATE_RULES). They are translated in
 *    full, with the per-Region figures lifted back out of the api's English
 *    and put into the Finnish wording.
 *
 *  - The 73 strategy actions quote Finland's National Cancer Strategy
 *    2026-2035. The repo holds that document only in English translation
 *    (zeneca_resources_en/), and the Strategy was written in Finnish. Putting
 *    my back-translation next to a page number would be quoting the document
 *    as saying something it does not say, so the framing around the citation
 *    is translated and the quoted clause is left in the English the project
 *    actually has, marked as such.
 */

import type { CandidateAction } from "@/lib/api";
import { fmtNumber, type Lang } from "@/lib/i18n";

type Rule = { title: string; description: string; why?: (nums: number[]) => string };

const COVARIATE_FI: Record<string, Rule> = {
  "multilingual-outreach": {
    title: "Monikielinen, yhteisölähtöinen seulontaviestintä",
    description:
      "Kohdennetut kutsut ja muistutukset alueen yleisimmillä muilla kuin suomen ja ruotsin kielillä, " +
      "toteutettuna yhdessä järjestöjen kanssa eikä yleisluontoisena käännöksenä.",
    why: ([v, m]) =>
      `Ulkomaalaistaustaisten osuus on täällä ${fmtNumber(v, "fi")} % eli yli valtakunnallisen mediaanin ` +
      `(${fmtNumber(m, "fi")} %), ja tämä on ainoa kovariaatti, joka ennustaa matalampaa seulontaan ` +
      `osallistumista sekä alue- että yksilötasolla (ks. menetelmät) — kahdesti vahvistettu ja ` +
      `perusteltavissa oleva kohdennussignaali.`,
  },
  "mobile-screening": {
    title: "Liikkuva seulontayksikkö tai paikallinen kuljetuskumppanuus",
    description:
      "Tuodaan seulonta-auto syrjäisempiin kuntiin tai tuetaan yhteiskuljetusta lähimpään " +
      "seulontapisteeseen sen sijaan, että asukkaat matkustavat omin neuvoin.",
    why: ([v, m]) =>
      `Kelan sairaanhoitomatkojen korvaukset ovat täällä ${fmtNumber(v, "fi")} euroa/asukas eli yli ` +
      `valtakunnallisen ${fmtNumber(m, "fi")} euron mediaanin — alueen asukkaat hakevat jo selvästi ` +
      `tavanomaista enemmän matkakorvauksia, mikä sopii siihen, että todellinen välimatka on este eikä ` +
      `pelkkä haluttomuus.`,
  },
  "travel-reimbursement-awareness": {
    title: "Matkakorvausten tunnettuuskampanja",
    description:
      "Varmistetaan, että potilaat tietävät Kelan korvaavan suurimman osan matkan hinnasta ennen kuin " +
      "he päättävät jättää menemättä — iso osa todellisesta esteestä voi olla tietämättömyys korvauksesta.",
    why: () =>
      "Alueen matkakorvausmenot asukasta kohden ovat jo yli mediaanin — korvausta käytetään, mutta sen " +
      "tunnettuus (eikä pelkkä olemassaolo) kannattaa tarkistaa ennen kuin oletetaan välimatkan yksin " +
      "selittävän jäljelle jäävän eron.",
  },
  "low-bandwidth-channel": {
    title: "Tekstiviesti- ja puhepainotteinen muistutuskanava",
    description:
      "Oletuksena tekstiviesti ja puhuttu viesti Oma Kanta -sovelluksen ilmoituksen sijaan niillä " +
      "alueilla, joilla nopea kotilaajakaista on heikommin saatavilla.",
    why: ([v, m]) =>
      `Gigabitin laajakaista tavoittaa täällä vain ${fmtNumber(v, "fi")} % kotitalouksista eli alle ` +
      `valtakunnallisen ${fmtNumber(m, "fi")} %:n mediaanin — sovellusvetoinen muistutus jää tässä ` +
      `todennäköisemmin huomaamatta kuin paremmin yhteydessä olevalla alueella.`,
  },
  "capacity-review": {
    title: "Perusterveydenhuollon ja erikoissairaanhoidon kapasiteettiarvio",
    description:
      "Suora henkilöstö- ja aikatauluarvio alueen oman erikoissairaanhoidon johdon kanssa — ei " +
      "tavoittamisen korjaus, koska data ei viittaa kysyntäpuolen syyhyn.",
    why: () =>
      "Pitkien odotusaikojen ja lähetteiden luvut ovat täällä ok-rajan ulkopuolella, eikä mikään " +
      "seuraamistamme kovariaateista selitä, millä alueilla tämä ongelma on (kaikki |r| <= 0,27 tätä " +
      "mittaria vastaan) — kuvio viittaa kapasiteettiin eikä saatavuuteen, joten tavoittamiskampanja on " +
      "väärä työkalu.",
  },
};

/** The figures the api already formatted into the English `why`. */
function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export function actionTitle(action: CandidateAction, lang: Lang): string {
  if (lang !== "fi") return action.title;
  const rule = COVARIATE_FI[action.id];
  if (rule) return rule.title;
  // A strategy action's title is the Strategy's own sentence: left as the
  // project has it, in English. See the note at the top of this file.
  return action.title;
}

export function actionDescription(action: CandidateAction, lang: Lang): string {
  const text = action.description ?? "";
  if (lang !== "fi") return text;
  const rule = COVARIATE_FI[action.id];
  if (rule) return rule.description;
  // "Sub-objective 2.4.1: <the Strategy's own wording>"
  return text.replace(/^Sub-objective\s+([\d.]+):/, "Alatavoite $1:");
}

export function actionWhy(action: CandidateAction, lang: Lang): string {
  const text = action.why ?? "";
  if (lang !== "fi") return text;

  const rule = COVARIATE_FI[action.id];
  if (rule?.why) return rule.why(numbersIn(text));

  // Strategy actions: translate the framing, keep the citation and the quote.
  let out = text.replace(
    /^Added from the National Cancer Strategy by hand — this one was not matched to a Gap in this Region by the rules\./,
    "Lisätty kansallisesta syöpästrategiasta käsin — säännöt eivät kohdistaneet tätä tämän alueen eroon.",
  );
  out = out.replace(/^Matched to the (.+?)\./, (_m, label: string) => `Kohdistettu: ${gapLabelFi(label)}.`);
  out = out.replace(/National Cancer Strategy (\d{4})–(\d{4})/, "Kansallinen syöpästrategia $1–$2");
  out = out.replace(/, p\.(\d+) \(action ([\d.]+)\)/, ", s. $1 (toimi $2)");
  out = out.replace(/ — linked via Roadmap p\.(\d+) \(measure ([\d.]+)\)/, " — kytketty tiekartan s. $1 kautta (toimenpide $2)");
  out = out.replace(/Strategy p\.(\d+):/, "Strategia s. $1 (lainaus englanninkielisestä käännöksestä):");
  return out;
}

/** "breast, cervical and colorectal screening Gaps" -> Finnish. */
function gapLabelFi(label: string): string {
  const map: Record<string, string> = {
    breast: "rintasyövän",
    cervical: "kohdunkaulasyövän",
    colorectal: "suolistosyövän",
    bowel: "paksusuolen syövän",
  };
  const types = Object.keys(map).filter((k) => label.includes(k));
  if (types.length === 0) return label;
  const fi = types.map((k) => map[k]);
  const joined = fi.length > 1 ? `${fi.slice(0, -1).join(", ")} ja ${fi[fi.length - 1]}` : fi[0];
  return `${joined} seulontaerot`;
}
