"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ACCOUNTS, ROLE_LABEL } from "@/lib/roles";
import { useProgram } from "@/lib/program";

/** The app frame. Both roles get the same frame and a different accent, so
 *  "whose screen is this?" is answerable at a glance without reading a word. */
export function Shell({ children }: { children: ReactNode }) {
  const { account, setAccountId, unreadCount, ready } = useProgram();

  // The role accent lives on <body> so every token below it re-resolves at
  // once. Set from the client because <body> is rendered on the server.
  useEffect(() => {
    document.body.dataset.role = account.role;
  }, [account.role]);

  const nav =
    account.role === "state"
      ? [
          { href: "/", label: "Decision Map" },
          { href: "/programmes", label: "Programmes" },
        ]
      : [
          { href: "/regional", label: "My directives" },
          { href: "/regional/team", label: "Team" },
        ];

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "var(--card)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1480,
            margin: "0 auto",
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            height: 60,
          }}
        >
          <Link
            href={account.role === "state" ? "/" : "/regional"}
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flex: "none" }}
          >
            <Mark />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>
              Frontiers Health
            </span>
          </Link>

          <nav style={{ display: "flex", gap: 2, marginLeft: 8 }}>
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="spacer" />

          {ready && account.role === "regional" && (
            <Link
              href="/regional"
              aria-label={unreadCount > 0 ? `${unreadCount} unread directives` : "No unread directives"}
              style={{ position: "relative", display: "flex", padding: 7, borderRadius: 8, textDecoration: "none" }}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: "var(--act)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {ready && <AccountMenu currentId={account.id} onPick={setAccountId} />}
        </div>
      </header>

      <main style={{ flex: 1, padding: "28px 28px 64px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      style={{
        padding: "7px 13px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: active ? 650 : 500,
        textDecoration: "none",
        color: active ? "var(--ink)" : "var(--ink-2)",
        background: active ? "var(--bg-sunk)" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}

/** The account switcher is a demo affordance made explicit rather than
 *  hidden: the whole product is the handoff between these two roles, so
 *  being able to stand in both is the point, not a shortcut. */
function AccountMenu({ currentId, onPick }: { currentId: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = ACCOUNTS.find((a) => a.id === currentId)!;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-ghost btn-sm"
        style={{ paddingLeft: 6, gap: 9 }}
      >
        <Avatar initials={current.initials} />
        <span className="col" style={{ alignItems: "flex-start", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, fontWeight: 650 }}>{current.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 600 }}>{ROLE_LABEL[current.role]}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="card-lg"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 332,
            padding: 7,
            boxShadow: "var(--shadow-pop)",
            zIndex: 60,
          }}
        >
          <p className="eyebrow eyebrow-muted" style={{ padding: "8px 10px 6px" }}>
            Signed in as
          </p>
          {(["state", "regional"] as const).map((role) => (
            <div key={role}>
              <p
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--ink-3)",
                  padding: "8px 10px 4px",
                  borderTop: role === "regional" ? "1px solid var(--line)" : "none",
                  marginTop: role === "regional" ? 5 : 0,
                }}
              >
                {ROLE_LABEL[role]}
              </p>
              {ACCOUNTS.filter((a) => a.role === role).map((a) => {
                const active = a.id === currentId;
                return (
                  <button
                    key={a.id}
                    role="menuitem"
                    onClick={() => {
                      onPick(a.id);
                      setOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: active ? "var(--bg-sunk)" : "transparent",
                      borderRadius: 9,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar initials={a.initials} muted={!active} />
                    <span className="col" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 650 }}>{a.name}</span>
                      <span className="truncate" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {a.title} · {a.org}
                      </span>
                    </span>
                    {active && <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ initials, muted }: { initials: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 28,
        height: 28,
        flex: "none",
        borderRadius: 8,
        background: muted ? "var(--bg-sunk)" : "var(--accent)",
        color: muted ? "var(--ink-2)" : "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
      }}
    >
      {initials}
    </span>
  );
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="26" height="26" rx="7" fill="var(--ink)" />
      <path d="M8 17.5V8.5h9" stroke="var(--card)" strokeWidth="2.1" strokeLinecap="round" fill="none" />
      <circle cx="17" cy="17.5" r="2.4" fill="var(--accent)" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3a5 5 0 0 0-5 5v3.2L3.8 13.4a.6.6 0 0 0 .53.9h11.34a.6.6 0 0 0 .53-.9L15 11.2V8a5 5 0 0 0-5-5Z"
        stroke="var(--ink-2)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.2 16.5a2 2 0 0 0 3.6 0" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flex: "none" }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="var(--ink-3)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
