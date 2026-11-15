"use client";

/** Which language the interface is in.
 *
 *  The choice lives in a cookie, not in the URL or localStorage, because the
 *  app renders on the server: the server reads the cookie, renders Finnish,
 *  and the client agrees. localStorage would mean rendering English and
 *  swapping it after hydration -- a visible flash of the wrong language on
 *  every page load -- and a URL parameter would have to be threaded through
 *  every link in the app to survive navigation.
 *
 *  Switching writes the cookie and calls router.refresh(), which re-renders
 *  the server components with the new language without a full page load. */

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { t as translate, tf as formatTranslate, LANG_COOKIE, type Lang } from "@/lib/i18n";

type LangValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  /** Translate one English source string. */
  t: (en: string) => string;
  /** Translate a sentence that has {placeholders} in it. */
  tf: (en: string, vars: Record<string, string | number>) => string;
};

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      // A year, path-wide, and SameSite=Lax so it survives ordinary
      // navigation. Nothing here is sensitive.
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang,
      t: (en: string) => translate(lang, en),
      tf: (en: string, vars: Record<string, string | number>) => formatTranslate(lang, en, vars),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Inside a client component: the current language, the switcher, and `t`. */
export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // A component rendered outside the provider should still show something
    // readable rather than crash the page.
    return {
      lang: "en",
      setLang: () => {},
      t: (en: string) => en,
      tf: (en: string, vars: Record<string, string | number>) => formatTranslate("en", en, vars),
    };
  }
  return ctx;
}
