"use client";

import { useMemo } from "react";
import { RoleGate } from "@/components/RoleGate";
import { useProgram } from "@/lib/program";
import { allSteps } from "@/lib/playbook";
import { FUNCTION_LABEL, teamFor } from "@/lib/team";

/** Everyone on the Region's team, with everything currently on their desk
 *  across every directive — the view that answers "can I give this to
 *  Hanna?" without opening four directives to find out. */
export function TeamPage() {
  const { account, visibleDirectives, phasesFor } = useProgram();
  const team = useMemo(() => teamFor(account.regionCode ?? ""), [account.regionCode]);

  const workload = useMemo(() => {
    const map = new Map<string, { title: string; directive: string; days: number; status: string }[]>();
    for (const d of visibleDirectives) {
      if (d.status === "complete") continue;
      const steps = allSteps(phasesFor(d));
      for (const st of d.steps) {
        if (!st.assigneeId || st.status === "complete") continue;
        const spec = steps.find((s) => s.id === st.stepId);
        if (!spec) continue;
        const list = map.get(st.assigneeId) ?? [];
        list.push({ title: spec.title, directive: d.action.title, days: spec.durationDays, status: st.status });
        map.set(st.assigneeId, list);
      }
    }
    return map;
  }, [visibleDirectives, phasesFor]);

  return (
    <RoleGate allow="regional">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)" }}>Who is carrying what</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 5, fontSize: 13.5, maxWidth: "78ch" }}>
          Open work across every directive issued to {account.org}. A national playbook names a function; this is
          the person who holds it here.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {team.map((m) => {
          const work = workload.get(m.id) ?? [];
          const days = work.reduce((n, w) => n + w.days, 0);
          const blocked = work.filter((w) => w.status === "blocked").length;
          return (
            <div key={m.id} className="card-lg" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 11 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: work.length ? "var(--accent)" : "var(--bg-sunk)",
                    color: work.length ? "#fff" : "var(--ink-3)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12.5,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {m.initials}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</p>
                  <p style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{FUNCTION_LABEL[m.func]}</p>
                </div>
              </div>

              <div className="row" style={{ gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                <span className="tag">{work.length} open</span>
                <span className="tag">{days} {days === 1 ? "day" : "days"} assigned</span>
                <span className="tag">{m.baseLoad} {m.baseLoad === 1 ? "day" : "days"} existing</span>
                {blocked > 0 && <span className="tag tag-act">{blocked} blocked</span>}
              </div>

              {work.length > 0 ? (
                <div className="col" style={{ gap: 7, marginTop: 12 }}>
                  {work.map((w, i) => (
                    <div key={i} className="sunk" style={{ padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.35 }}>{w.title}</p>
                      <p className="truncate" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                        {w.directive}, {w.days} {w.days === 1 ? "day" : "days"}
                        {w.status === "in_progress" && <strong style={{ color: "var(--watch)" }}>, in progress</strong>}
                        {w.status === "blocked" && <strong style={{ color: "var(--act)" }}>, blocked</strong>}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12 }}>
                  Nothing assigned from the current directives.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </RoleGate>
  );
}
