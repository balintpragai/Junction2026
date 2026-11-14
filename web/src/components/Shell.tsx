"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Decision-maker", icon: GridIcon },
  { href: "/outreach", label: "Outreach", icon: ListIcon },
  { href: "/patient", label: "Patient", icon: PersonIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100%" }}>
      <nav
        aria-label="Primary"
        style={{
          width: 76,
          flex: "none",
          background: "var(--rail)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 0",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>R</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "var(--rail-ink)" : "transparent",
                  color: active ? "var(--rail)" : "var(--rail-ink-dim)",
                  textDecoration: "none",
                }}
              >
                <Icon />
              </Link>
            );
          })}
        </div>

        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--chip-lavender)",
            color: "var(--chip-lavender-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          AZ
        </div>
      </nav>

      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px 56px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
      <rect x="11.5" y="2" width="6.5" height="6.5" rx="1.6" fill="currentColor" opacity="0.55" />
      <rect x="2" y="11.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" opacity="0.55" />
      <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="3.5" cy="4" r="1.6" fill="currentColor" />
      <circle cx="3.5" cy="10" r="1.6" fill="currentColor" />
      <circle cx="3.5" cy="16" r="1.6" fill="currentColor" />
      <rect x="7.5" y="2.8" width="10" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="7.5" y="8.8" width="10" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="7.5" y="14.8" width="10" height="2.4" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6.5" r="3.5" fill="currentColor" />
      <path d="M3 18c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
