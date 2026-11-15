/** The chosen language, for server components. Do not import this from a
 *  client component: it calls next/headers, which only exists on the server.
 *
 *  Client components use `useLang()` from lib/lang.tsx; this is the same
 *  value read straight off the cookie for the server side, so a page that
 *  renders text itself does not have to push it through a client wrapper. */

import { cookies } from "next/headers";
import { LANG_COOKIE, toLang, t as translate, tf as formatTranslate, type Lang } from "@/lib/i18n";

export async function getLang(): Promise<Lang> {
  return toLang((await cookies()).get(LANG_COOKIE)?.value);
}

/** Language plus a bound translator, so a server component reads the same
 *  way a client one does: `const { t } = await serverLang();` */
export async function serverLang(): Promise<{
  lang: Lang;
  t: (en: string) => string;
  tf: (en: string, vars: Record<string, string | number>) => string;
}> {
  const lang = await getLang();
  return {
    lang,
    t: (en: string) => translate(lang, en),
    tf: (en: string, vars: Record<string, string | number>) => formatTranslate(lang, en, vars),
  };
}
