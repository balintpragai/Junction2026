import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--card)" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            height: 56,
          }}
        >
          <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textDecoration: "none", color: "var(--ink)" }}>
            Reach Loop
          </Link>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
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
