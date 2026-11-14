"use client";

import Link from "next/link";
import { useProgram } from "@/lib/program";
import { ROLE_LABEL, type RoleId } from "@/lib/roles";

/** The two roles see genuinely different products, so a screen belonging to
 *  the other one isn't hidden — it's refused, with a way across. Showing the
 *  refusal rather than silently redirecting makes the boundary legible,
 *  which for a demo about who-decides-what is the interesting part. */
export function RoleGate({ allow, children }: { allow: RoleId; children: React.ReactNode }) {
  const { account, ready } = useProgram();

  if (!ready) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>Loading…</div>
    );
  }

  if (account.role === allow) return <>{children}</>;

  const home = account.role === "state" ? "/" : "/regional";
  return (
    <div className="card-lg" style={{ padding: "40px 36px", maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
      <p className="eyebrow">Not your desk</p>
      <h2 style={{ fontSize: "1.3rem", marginTop: 9 }}>This screen belongs to the {ROLE_LABEL[allow]}</h2>
      <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.6 }}>
        You are signed in as <strong>{account.name}</strong>, {ROLE_LABEL[account.role]} at {account.org}.{" "}
        {allow === "state"
          ? "The national map covers all 23 Regions; a Regional account works from the directives issued to its own Region."
          : "Regional workflow is run by the Region's own team — the State sees reported progress, not the working detail."}
      </p>
      <Link href={home} className="btn btn-primary" style={{ marginTop: 18 }}>
        Go to your dashboard
      </Link>
      <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 14 }}>
        Switch accounts from the menu at the top right to see the other side.
      </p>
    </div>
  );
}
