"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RoleGate } from "@/components/RoleGate";
import { progressOf, useProgram, dueLabel, isOverdue, STATUS_LABEL, STATUS_TONE, type Directive } from "@/lib/program";
import { criticalPathDays } from "@/lib/playbook";
import { regionalAccountFor } from "@/lib/roles";
import { useLang } from "@/lib/lang";
import { regionName } from "@/lib/fi-data";

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
  const { lang, t, tf } = useLang();

  const byRegion = useMemo(() => {
    const map = new Map<string, Directive[]>();
    for (const d of directives) {
      const list = map.get(d.regionCode) ?? [];
      list.push(d);
      map.set(d.regionCode, list);
    }
    // Sort by the name actually on screen, so A-Z matches what is read.
    return [...map.entries()].sort((a, b) =>
      regionName(a[0], a[1][0].regionName, lang).localeCompare(regionName(b[0], b[1][0].regionName, lang), lang),
    );
  }, [directives, lang]);

  const totals = useMemo(() => {
    const open = directives.filter((d) => d.status !== "complete").length;
    const waiting = directives.filter((d) => d.status === "not_started").length;
    const overdue = directives.filter(isOverdue).length;
    const avg = directives.length
      ? Math.round(directives.reduce((s, d) => s + progressOf(d).pct, 0) / directives.length)
      : 0;
    return { open, waiting, overdue, avg };
  }, [directives]);

  return (
    <RoleGate allow="state">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)" }}>{t("Directives in flight")}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 5, fontSize: 13.5, maxWidth: "78ch" }}>
          {t(
            "What each Region has reported back. You see progress, not their working detail — assigning and sequencing the work is theirs to do.",
          )}
        </p>
      </header>

      {directives.length === 0 ? (
        <div className="card-lg" style={{ padding: "56px 32px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.2rem" }}>{t("Nothing issued yet")}</h2>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 9, lineHeight: 1.6 }}>
            {t("Open a Region from the Decision Map and build an action plan.")}
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            {t("Go to the Decision Map")}
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
            <Stat value={String(directives.length)} label={t("directives issued")} />
            <Stat value={String(totals.open)} label={t("still open")} />
            <Stat value={String(totals.waiting)} label={t("not started by the Region")} />
            <Stat value={String(totals.overdue)} label={t("past the response window")} tone={totals.overdue > 0 ? "act" : undefined} />
            <Stat value={`${totals.avg}%`} label={t("average progress")} />
          </div>

          <div className="col" style={{ gap: 22 }}>
            {byRegion.map(([regionCode, list]) => {
              const recipient = regionalAccountFor(list[0].regionCode);
              return (
                <section key={regionCode}>
                  <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "1.05rem" }}>
                      {regionName(regionCode, list[0].regionName, lang)}
                    </h2>
                    <span className="tag">
                      {tf(list.length > 1 ? "{n} directives" : "{n} directive", { n: list.length })}
                    </span>
                    {recipient && (
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {tf("held by {name}, {title}", { name: recipient.name, title: t(recipient.title) })}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
                    {list.map((d) => {
                      const { pct, done, total } = progressOf(d);
                      const due = dueLabel(d, lang);
                      const blocked = d.steps.filter((s) => s.status === "blocked").length;
                      return (
                        <div key={d.id} className="card-lg" style={{ padding: 16 }}>
                          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            <span className={TONE_CLASS[STATUS_TONE[d.status]]}>{t(STATUS_LABEL[d.status])}</span>
                            <span className="tag">{t(d.priority)}</span>
                            {blocked > 0 && <span className="tag tag-act">{tf("{n} blocked", { n: blocked })}</span>}
                          </div>
                          <p style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{d.action.title}</p>
                          <p className="clamp-2" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>
                            {d.mandate}
                          </p>

                          <div style={{ marginTop: 12 }}>
                            <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                                {tf("{done} of {total} steps reported", { done, total })}
                              </span>
                              <span className="num" style={{ fontSize: 11.5 }}>
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

                          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 9 }}>
                            {tf("{n} working days of work end to end.", { n: criticalPathDays(phasesFor(d)) })}{" "}
                            {d.status === "not_started"
                              ? t("The Region has not started.")
                              : t("The Region has it in hand.")}
                          </p>
                          <p
                            style={{
                              fontSize: 11.5,
                              marginTop: 3,
                              fontWeight: due.overdue ? 650 : 400,
                              color: due.overdue ? "var(--act)" : "var(--ink-3)",
                            }}
                          >
                            {due.text.charAt(0).toUpperCase() + due.text.slice(1)}.
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

function Stat({ value, label, tone }: { value: string; label: string; tone?: "act" }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <p className="num" style={{ fontSize: 24, lineHeight: 1.1, color: tone === "act" ? "var(--act)" : "var(--ink)" }}>
        {value}
      </p>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>{label}</p>
    </div>
  );
}
