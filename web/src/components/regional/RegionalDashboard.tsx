"use client";

import { useMemo, useState } from "react";
import { RoleGate } from "@/components/RoleGate";
import { SequenceView } from "@/components/sequence/SequenceView";
import { Timeline, TeamLoad } from "@/components/regional/Timeline";
import { allSteps, criticalPathDays, uniqueCounterparties } from "@/lib/playbook";
import {
  progressOf,
  useProgram,
  dueLabel,
  isOverdue,
  STATUS_LABEL,
  STATUS_TONE,
  type Directive,
  type Priority,
} from "@/lib/program";
import { teamFor } from "@/lib/team";

const PRIORITY_TAG: Record<Priority, string> = {
  routine: "tag",
  high: "tag tag-watch",
  urgent: "tag tag-act",
};

const TONE_CLASS: Record<string, string> = {
  neutral: "tag",
  brand: "tag tag-accent",
  watch: "tag tag-watch",
  good: "tag tag-good",
  act: "tag tag-act",
};

type Tab = "workflow" | "timeline" | "team";

/** The Regional Decision Maker's desk. Not a smaller version of the State's
 *  map — a different product for a different job: what has been handed to
 *  this Region, who on this team is doing which part of it, and when it
 *  lands. The national picture is deliberately absent; it is not this
 *  person's decision to make. */
export function RegionalDashboard() {
  const { account, visibleDirectives, markRead, acknowledge } = useProgram();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...visibleDirectives].sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt)),
    [visibleDirectives],
  );
  const selected = sorted.find((d) => d.id === selectedId) ?? sorted[0] ?? null;

  const stats = useMemo(() => {
    const open = sorted.filter((d) => d.status !== "complete");
    const steps = sorted.flatMap((d) => d.steps);
    return {
      open: open.length,
      awaiting: sorted.filter((d) => d.status === "issued").length,
      active: steps.filter((s) => s.status === "active").length,
      blocked: steps.filter((s) => s.status === "blocked").length,
      overdue: sorted.filter(isOverdue).length,
      unassigned: sorted
        .filter((d) => d.status !== "complete")
        .flatMap((d) => d.steps)
        .filter((s) => !s.assigneeId && s.status !== "done").length,
    };
  }, [sorted]);

  function select(d: Directive) {
    setSelectedId(d.id);
    markRead(d.id);
    if (d.status === "issued") acknowledge(d.id);
  }

  return (
    <RoleGate allow="regional">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)" }}>{account.org}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 5, fontSize: 13.5, maxWidth: "78ch" }}>
          The State sets the outcome. Who does what, in which order and with which institution is yours.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Stat value={String(stats.open)} label={`open ${stats.open === 1 ? "directive" : "directives"}`} />
        <Stat value={String(stats.awaiting)} label="not yet acknowledged" tone={stats.awaiting > 0 ? "brand" : undefined} />
        <Stat value={String(stats.active)} label={plural(stats.active, "step")} />
        <Stat value={String(stats.unassigned)} label={`${stats.unassigned === 1 ? "step" : "steps"} unassigned`} tone={stats.unassigned > 0 ? "watch" : undefined} />
        <Stat value={String(stats.blocked)} label="blocked" tone={stats.blocked > 0 ? "act" : undefined} />
        <Stat value={String(stats.overdue)} label="past the response window" tone={stats.overdue > 0 ? "act" : undefined} />
      </div>

      {sorted.length === 0 ? (
        <div className="card-lg" style={{ padding: "56px 32px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.2rem" }}>Nothing has been issued to this Region</h2>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 9, maxWidth: 460, margin: "9px auto 0", lineHeight: 1.6 }}>
            When the national programme issues a directive for {account.org}, it arrives here with its evidence and
            its full chain of work. Switch to the State account to issue one.
          </p>
        </div>
      ) : (
        <div
          className="regional-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 330px) minmax(0, 1fr)", gap: 20, alignItems: "flex-start" }}
        >
          <div className="col" style={{ gap: 9, position: "sticky", top: 78 }}>
            <h2 style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Inbox</h2>
            {sorted.map((d) => (
              <DirectiveRow key={d.id} directive={d} active={selected?.id === d.id} onClick={() => select(d)} />
            ))}
          </div>

          {selected && <DirectiveDetail key={selected.id} directive={selected} />}
        </div>
      )}

      <style>{`
        @media (max-width: 1040px) {
          .regional-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .regional-grid > div:first-child { position: static !important; }
        }
      `}</style>
    </RoleGate>
  );
}

function DirectiveRow({ directive, active, onClick }: { directive: Directive; active: boolean; onClick: () => void }) {
  const { pct, done, total } = progressOf(directive);
  const due = dueLabel(directive);
  const isNew = directive.status === "issued";
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        textAlign: "left",
        padding: "12px 14px",
        cursor: "pointer",
        borderColor: active ? "var(--accent)" : isNew ? "var(--accent-line)" : "var(--line)",
        background: active ? "var(--accent-soft)" : "var(--card)",
        borderLeftWidth: isNew ? 3 : 1,
      }}
    >
      <span className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span className={TONE_CLASS[STATUS_TONE[directive.status]]}>{STATUS_LABEL[directive.status]}</span>
        <span className={PRIORITY_TAG[directive.priority]}>{directive.priority}</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 650, lineHeight: 1.35, display: "block" }}>{directive.action.title}</span>
      <span style={{ display: "block", marginTop: 8 }}>
        <span
          aria-hidden="true"
          style={{ display: "block", height: 4, borderRadius: 999, background: "var(--bg-sunk)", overflow: "hidden" }}
        >
          <span style={{ display: "block", width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--good)" : "var(--accent)" }} />
        </span>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, display: "block" }}>
          {done} of {total} steps, issued {relative(directive.issuedAt)}
        </span>
        <span
          style={{
            fontSize: 10.5,
            marginTop: 2,
            display: "block",
            fontWeight: due.overdue ? 650 : 400,
            color: due.overdue ? "var(--act)" : "var(--ink-3)",
          }}
        >
          {due.text}
        </span>
      </span>
    </button>
  );
}

function DirectiveDetail({ directive }: { directive: Directive }) {
  const { phasesFor, assignAll, setStepAssignee, setStepStatus } = useProgram();
  const [tab, setTab] = useState<Tab>("workflow");
  const phases = useMemo(() => phasesFor(directive), [directive, phasesFor]);
  const team = useMemo(() => teamFor(directive.regionCode), [directive.regionCode]);
  const { pct, done, total } = progressOf(directive);
  const detailDue = dueLabel(directive);
  const needsAssigning = directive.steps.some((s) => !s.assigneeId && s.status !== "done");
  const parties = uniqueCounterparties(phases);

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* What the State asked for — the top of this screen, because it is
          the thing everything below has to answer. */}
      <section
        style={{
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 20px",
        }}
      >
        <div className="row" style={{ gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>From the national programme</span>
          <span className={PRIORITY_TAG[directive.priority]} style={{ marginLeft: "auto" }}>
            {directive.priority}
          </span>
        </div>
        <h2 style={{ fontSize: "1.25rem" }}>{directive.action.title}</h2>
        <p style={{ fontSize: 14, color: "var(--ink)", marginTop: 9, lineHeight: 1.6 }}>
          <strong>Asked of this Region:</strong> {directive.mandate}
        </p>
        <p
          style={{
            fontSize: 12.5,
            marginTop: 9,
            fontWeight: detailDue.overdue ? 650 : 500,
            color: detailDue.overdue ? "var(--act)" : "var(--ink-2)",
          }}
        >
          {directive.priority === "urgent" ? "Urgent" : directive.priority === "high" ? "High priority" : "Routine"} —{" "}
          {detailDue.text}, by {new Date(directive.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
        </p>

        <details style={{ marginTop: 11 }}>
          <summary style={{ fontSize: 12, fontWeight: 650, cursor: "pointer", color: "var(--ink-2)" }}>
            The evidence behind it
          </summary>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>{directive.evidence}</p>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>{directive.action.why}</p>
        </details>
      </section>

      <div className="card" style={{ padding: "13px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 190px", minWidth: 160 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
              {done} of {total} steps complete
            </span>
            <span className="num" style={{ fontSize: 12 }}>
              {pct}%
            </span>
          </div>
          <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: "var(--bg-sunk)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--good)" : "var(--accent)" }} />
          </div>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
          {allSteps(phases).length} steps over {criticalPathDays(phases)} working days, involving {parties.length} bodies
        </span>
        {needsAssigning && (
          <button className="btn btn-primary btn-sm" onClick={() => assignAll(directive.id)} style={{ marginLeft: "auto" }}>
            Assign the whole chain to my team
          </button>
        )}
      </div>

      <div className="card-lg" style={{ overflow: "hidden" }}>
        <div role="tablist" aria-label="Directive views" style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
          {(
            [
              { id: "workflow", label: "Workflow" },
              { id: "timeline", label: "Timeline" },
              { id: "team", label: "Team load" },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  border: "none",
                  background: active ? "var(--card)" : "transparent",
                  padding: "11px 18px",
                  fontSize: 12.5,
                  fontWeight: active ? 650 : 500,
                  color: active ? "var(--ink)" : "var(--ink-2)",
                  cursor: "pointer",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 20 }}>
          {tab === "workflow" && (
            <SequenceView
              phases={phases}
              mode="work"
              stepStates={directive.steps}
              team={team}
              onAssign={(stepId, memberId) => setStepAssignee(directive.id, stepId, memberId)}
              onStatus={(stepId, status) => setStepStatus(directive.id, stepId, status)}
            />
          )}
          {tab === "timeline" && <Timeline phases={phases} stepStates={directive.steps} team={team} />}
          {tab === "team" && <TeamLoad phases={phases} stepStates={directive.steps} team={team} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "brand" | "watch" | "act" }) {
  const color = tone === "brand" ? "var(--accent)" : tone === "watch" ? "var(--watch)" : tone === "act" ? "var(--act)" : "var(--ink)";
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <p className="num" style={{ fontSize: 24, lineHeight: 1.1, color }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

function plural(n: number, word: string): string {
  return `${word}${n === 1 ? "" : "s"} in progress`;
}

function relative(iso: string): string {
  const days = Math.round((Date.now() - +new Date(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
