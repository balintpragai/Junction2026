/** "What the data says", in Finnish.
 *
 *  A port of `common/common/synthesis.py`, which composes these sentences in
 *  English from a Region's Gaps and covariates. The api serves one language,
 *  so rather than translate finished English prose -- which would mean
 *  pattern-matching sentences the api is free to reword -- this re-derives
 *  them from the same profile fields under the same rules.
 *
 *  Keep in step with synthesis.py. If a rule changes there and not here, a
 *  Finnish reader gets a confidently worded sentence that is no longer true.
 */

import type { RegionProfile } from "@/lib/api";
import { fmtNumber } from "@/lib/i18n";
import { indicatorNameFromEnglish } from "@/lib/fi-data";

const FOREIGN_BACKGROUND = "foreign_background_pct";
const KELA_TRAVEL_PER_CAPITA = "3213";

/** The cancer types the screening indicators carry, in Finnish. */
const CANCER_FI: Record<string, string> = {
  breast: "rintasyöpä",
  cervical: "kohdunkaulasyöpä",
  colorectal: "suolistosyöpä",
  bowel: "paksusuolen syöpä",
};

/** "No 2024 data for: A, B." -> the same note with Finnish indicator names. */
export function missingNoteFi(note: string): string {
  const m = note.match(/^No (\d{4}) data for: (.*)\.$/);
  if (!m) return note;
  const names = m[2]
    .split(", ")
    .map((n) => indicatorNameFromEnglish(n, "fi"))
    .join(", ");
  return `Ei vuoden ${m[1]} tietoa: ${names}.`;
}

/** The Finnish synthesis for one Region, or null when the profile does not
 *  carry what the rules need -- the caller then keeps the api's English. */
export function synthesisFi(profile: RegionProfile, regionNameFi: string): string[] | null {
  const gaps = profile.gaps;
  if (!gaps) return null;

  const out: string[] = [];
  const isScreening = (g: RegionProfile["gaps"][number]) => g.indicator.cancer_type != null;
  const badScreening = gaps.filter((g) => isScreening(g) && g.gap.severity !== "ok");
  const badCapacity = gaps.filter((g) => !isScreening(g) && g.gap.severity !== "ok");

  if (badScreening.length === 0 && badCapacity.length === 0) {
    out.push(
      `${regionNameFi} on tavoitteessa tai sen yli kaikilla seuratuilla indikaattoreilla tänä vuonna — yksikään ero ei vaadi toimia.`,
    );
  } else {
    if (badScreening.length > 0) {
      const types = badScreening
        .map((g) => CANCER_FI[g.indicator.cancer_type ?? ""] ?? g.indicator.cancer_type)
        .filter(Boolean);
      out.push(`Seulontaan osallistuminen jää tavoitteesta: ${types.join(", ")}.`);

      const value = profile.covariates?.[FOREIGN_BACKGROUND];
      const meta = profile.covariate_meta?.[FOREIGN_BACKGROUND];
      if (value != null && meta != null) {
        if (value > meta.median) {
          out.push(
            `Alueen ulkomaalaistaustaisten osuus (${fmtNumber(value, "fi")} %) on yli valtakunnallisen ` +
              `mediaanin (${fmtNumber(meta.median, "fi")} %) — ainoa kovariaatti, joka ennustaa matalampaa ` +
              `osallistumista sekä alue- että yksilötasolla, vahvistettuna kahdella riippumattomalla tavalla ` +
              `(ks. menetelmät).`,
          );
        } else {
          out.push(
            `Alueen ulkomaalaistaustaisten osuus on valtakunnallisen mediaanin tasolla tai sen alle, joten se ` +
              `ei selitä eroa täällä — kannattaa tarkistaa alueen oman seulontaohjelman toteutus sen sijaan, ` +
              `että oletettaisiin kyseessä olevan tavoittamisen ongelma.`,
          );
        }
      }
    }
    if (badCapacity.length > 0) {
      out.push(
        `Erikoissairaanhoidon saatavuus (pitkät odotusajat ja/tai lähetteiden käsittely) on myös ok-rajan ` +
          `ulkopuolella, eikä mikään tässä projektissa tarkistetuista rakenteellisista tekijöistä ` +
          `(maahanmuutto, tulot, välimatka hoitoon, laajakaista) selitä, millä alueilla tämä ongelma on — ` +
          `tämä nollatulos viittaa tarjontapuolen kapasiteettirajoitteeseen eikä kysyntäpuolen ` +
          `saatavuusongelmaan, joten pelkkä tavoittaminen ei korjaa sitä.`,
      );
    }
  }

  const travel = profile.covariates?.[KELA_TRAVEL_PER_CAPITA];
  const travelMeta = profile.covariate_meta?.[KELA_TRAVEL_PER_CAPITA];
  if (travel != null && travelMeta != null && travel > travelMeta.median) {
    out.push(
      `Kelan sairaanhoitomatkojen korvaukset ovat täällä ${fmtNumber(travel, "fi")} euroa/asukas, yli ` +
        `valtakunnallisen ${fmtNumber(travelMeta.median, "fi")} euron mediaanin — mikä sopii todelliseen ` +
        `etäisyyteen hoitoon, ei pelkkään haluttomuuteen lähteä.`,
    );
  }

  if (profile.missing_data_notes?.length) {
    out.push(profile.missing_data_notes.map(missingNoteFi).join(" "));
  }

  return out;
}
