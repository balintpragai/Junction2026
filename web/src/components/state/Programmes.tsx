"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RoleGate } from "@/components/RoleGate";
import { progressOf, useProgram, STATUS_LABEL, STATUS_TONE, type Directive } from "@/lib/program";
import { criticalPathDays } from "@/lib/playbook";
import { regionalAccountFor } from "@/lib/roles";

const TONE_CLASS: Record<string, string> = {
  neutral: "tag",
  brand: "tag tag-accent",
  watch: "tag tag-watch",
  good: "tag tag-good",
  act: "tag tag-act",
};

/** What the State sees after issuing: reported progress, not the working
 *  detail. The asymmetry is the point — the State deliberately cannot watch
 *  a Region's team work, only what that Region reports back. */
export function Programmes() {
  const { directives, phasesFor } = useProgram();

  const byRegion = useMemo(() => {
    const map = new Map<string, Directive[]>();
    for (const d of directives) {
      const list = map.get(d.regionName) ?? [];
      list.push(d);
      map.set(d.regionName, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [directives]);

  const totals = useMemo(() => {
    const open = directives.filter((d) => d.status !== "complete").length;
    const waiting = directives.filter((d) => d.status === "issued").length;
    const blocked = directives.filter((d) => d.status === "blocked").length;
    const avg = directives.length
      ? Math.round(directives.reduce((s, d) => s + progressOf(d).pct, 0) / directives.length)
      : 0;
    return { open, waiting, blocked, avg };
  }, [directives]);

  return (
    <RoleGate allow="state">
      <header style={{ marginBottom: 18 }}>
        <p className="eyebrow">Programmes</p>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", marginTop: 7 }}>Directives in flight</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Everything issued from this office, and what each Region has reported back. You see progress, not the
          Region&rsquo;s working detail — assigning and sequencing the work is theirs to do.
        </p>
      </header>

      {directives.length === 0 ? (
        <div className="card-lg" style={{ padding: "56px 32px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.2rem" }}>Nothing issued yet</h2>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 9, lineHeight: 1.6 }}>
            Open a Region from the Decision Map and build an action plan.
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Go to the Decision Map
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
            <Stat value={String(directives.length)} label="directives issued" />
            <Stat value={String(totals.open)} label="still open" />
            <Stat value={String(totals.waiting)} label="not yet acknowledged" />
            <Stat value={`${totals.avg}%`} label="average progress" />
          </div>

          <div className="col" style={{ gap: 22 }}>
            {byRegion.map(([regionName, list]) => {
              const recipient = regionalAccountFor(list[0].regionCode);
              return (
                <section key={regionName}>
                  <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "1.05rem" }}>{regionName}</h2>
                    <span className="tag">{list.length} directive{list.length > 1 ? "s" : ""}</span>
                    {recipient && (
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        held by {recipient.name}, {recipient.title}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
                    {list.map((d) => {
                      const { pct, done, total } = progressOf(d);
                      const blocked = d.steps.filter((s) => s.status === "blocked").length;
                      return (
                        <div key={d.id} className="card-lg" style={{ padding: 16 }}>
                          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            <span className={TONE_CLASS[STATUS_TONE[d.status]]}>{STATUS_LABEL[d.status]}</span>
                            <span className="tag">{d.priority}</span>
                            {blocked > 0 && <span className="tag tag-act">{blocked} blocked</span>}
                          </div>
                          <p style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{d.action.title}</p>
                          <p className="clamp-2" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>
                            {d.mandate}
                          </p>

                          <div style={{ marginTop: 12 }}>
                            <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
                              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                                {done}/{total} steps reported
                              </span>
                              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                                {pct}%
                              </span>
                            </div>
                            <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "var(--bg-sunk)", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background: pct === 100 ? "var(--good)" : blocked > 0 ? "var(--act)" : "var(--accent)",
                                }}
                              />
                            </div>
                          </div>

                          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 9 }}>
                            {criticalPathDays(phasesFor(d))} working days end to end ·{" "}
                            {d.acknowledgedAt ? "acknowledged by the Region" : "awaiting acknowledgement"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </RoleGate>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <p className="mono" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{label}</p>
    </div>
  );
}
