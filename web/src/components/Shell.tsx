"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Decision-maker" },
  { href: "/outreach", label: "Outreach list" },
  { href: "/patient", label: "Patient nudge" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--card)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            gap: 28,
            height: 60,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, flex: "none" }}>Reach Loop</span>
          <nav aria-label="Primary" style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {NAV.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-tab${active ? " nav-tab--active" : ""}`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: active ? "var(--brand)" : "var(--ink-2)",
                    background: active ? "var(--brand-soft)" : "transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-3)",
              flex: "none",
            }}
          >
            AstraZeneca × Junction 2026 — V1 demo
          </span>
        </div>
      </header>

      <main style={{ padding: "32px 32px 56px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
