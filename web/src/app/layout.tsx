import { Archivo, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata = {
  title: "Frontiers Health",
  description: "Where Finnish cancer care falls short of national targets, Region by Region.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
