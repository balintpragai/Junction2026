import { cookies } from "next/headers";
import { Archivo, Public_Sans } from "next/font/google";
import { Shell } from "@/components/Shell";
import { ProgramProvider } from "@/lib/program";
import { LangProvider } from "@/lib/lang";
import { LANG_COOKIE, toLang, type Lang } from "@/lib/i18n";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

// The root layout reads a cookie, so it must not be part of the static
// shell: without this Next prerenders <html> once and every visitor gets
// whatever language that render happened to use.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Frontiers Health",
  description: "Where Finnish cancer care falls short of national targets, Region by Region.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read on the server so the first paint is already in the right language,
  // and so <html lang> is correct for screen readers and the browser's own
  // translation prompt. See lib/lang.tsx for why this is a cookie.
  const lang: Lang = toLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={lang} className={`${display.variable} ${body.variable}`}>
      <body data-role="state">
        <LangProvider lang={lang}>
          <ProgramProvider>
            <Shell>{children}</Shell>
          </ProgramProvider>
        </LangProvider>
      </body>
    </html>
  );
}
