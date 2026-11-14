"use client";

import { useEffect, useRef, useState } from "react";
import {
  criticalPathDays,
  schedule,
  uniqueCounterparties,
  allSteps,
  type Counterparty,
  type PlaybookPhase,
  type PlaybookStep,
} from "@/lib/playbook";
import { FUNCTION_LABEL, type TeamMember } from "@/lib/team";
import type { StepState, StepStatus } from "@/lib/program";

const STATUS_TONE: Record<StepStatus, { fg: string; bg: string; line: string; label: string }> = {
  todo: { fg: "var(--ink-3)", bg: "var(--card)", line: "var(--line)", label: "Not started" },
  active: { fg: "var(--watch)", bg: "var(--watch-soft)", line: "var(--watch-line)", label: "In progress" },
  done: { fg: "var(--good)", bg: "var(--good-soft)", line: "var(--good-line)", label: "Done" },
  blocked: { fg: "var(--act)", bg: "var(--act-soft)", line: "var(--act-line)", label: "Blocked" },
};

/** An action, written out as the work it actually implies.
 *
 *  "Send a My Kanta message" is one line in a plan and a dozen steps in
 *  reality, half of them with an outside institution on the other end. This
 *  renders that chain: phases in sequence down the page, steps inside a
 *  phase side by side because they genuinely run in parallel, and every
 *  institution named where it is needed.
 *
 *  `preview` is what the State sees before issuing — read-only, no owners.
 *  `work` is the Region's copy, where each step has an assignee and a state. */
export function SequenceView({
  phases,
  mode,
  stepStates,
  team,
  onAssign,
  onStatus,
}: {
  phases: PlaybookPhase[];
  mode: "preview" | "work";
  stepStates?: StepState[];
  team?: TeamMember[];
  onAssign?: (stepId: string, memberId: string | null) => void;
  onStatus?: (stepId: string, status: StepStatus) => void;
}) {
  const days = criticalPathDays(phases);
  const times = schedule(phases);
  const parties = uniqueCounterparties(phases);
  const steps = allSteps(phases);
  const regionalCount = steps.filter((s) => s.level === "regional").length;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 10 }}>
        <Stat value={String(steps.length)} label="derived steps" />
        <Stat value={`${days}`} label="working days, end to end" />
        <Stat value={String(parties.length)} label="bodies to notify" />
        <Stat value={`${regionalCount}/${steps.length}`} label="steps the Region owns" />
      </div>

      <details className="card" style={{ padding: "11px 14px" }}>
        <summary style={{ fontSize: 12.5, fontWeight: 650, cursor: "pointer", color: "var(--ink-2)" }}>
          Who has to be involved ({parties.length}) ▾
        </summary>
        <div className="col" style={{ gap: 7, marginTop: 11 }}>
          {parties.map((c) => (
            <div key={c.name} className="row-top" style={{ gap: 9 }}>
              <PartyChip party={c} />
              <span style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45, paddingTop: 2 }}>{c.role}</span>
            </div>
          ))}
        </div>
      </details>

      <ol className="col" style={{ gap: 0, listStyle: "none", margin: 0, padding: 0 }}>
        {phases.map((phase, pi) => {
          const phaseSteps = phase.steps;
          const phaseDone =
            mode === "work" &&
            phaseSteps.every((s) => stepStates?.find((x) => x.stepId === s.id)?.status === "done");
          return (
            <li key={phase.id} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 14 }}>
              {/* the spine */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    background: phaseDone ? "var(--good)" : "var(--ink)",
                    color: "#fff",
                    flex: "none",
                  }}
                >
                  {phaseDone ? "✓" : pi + 1}
                </span>
                {pi < phases.length - 1 && (
                  <span style={{ flex: 1, width: 2, background: "var(--line)", minHeight: 20 }} />
                )}
              </div>

              <div style={{ paddingBottom: pi < phases.length - 1 ? 22 : 0 }}>
                <div className="row" style={{ gap: 9, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 14.5 }}>{phase.name}</h4>
                  <span className="tag">
                    {Math.max(0, ...phaseSteps.map((s) => s.durationDays))}d
                    {phaseSteps.length > 1 ? ` · ${phaseSteps.length} in parallel` : ""}
                  </span>
                  {phaseSteps.every((s) => s.level === "state") && <span className="tag tag-accent">State</span>}
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, maxWidth: "74ch" }}>{phase.summary}</p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: phaseSteps.length > 1 ? "repeat(auto-fit, minmax(270px, 1fr))" : "1fr",
                    gap: 10,
                    marginTop: 11,
                  }}
                >
                  {phaseSteps.map((step) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      mode={mode}
                      window={times.get(step.id)}
                      state={stepStates?.find((s) => s.stepId === step.id)}
                      team={team}
                      onAssign={onAssign}
                      onStatus={onStatus}
                    />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepCard({
  step,
  mode,
  window: win,
  state,
  team,
  onAssign,
  onStatus,
}: {
  step: PlaybookStep;
  mode: "preview" | "work";
  window?: { start: number; end: number };
  state?: StepState;
  team?: TeamMember[];
  onAssign?: (stepId: string, memberId: string | null) => void;
  onStatus?: (stepId: string, status: StepStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  // Whether the detail is actually clipped depends on the card's rendered
  // width, so it is measured rather than guessed from the string length --
  // otherwise a "more" link appears above text that is already complete.
  const [clipped, setClipped] = useState(false);
  const detailRef = useRef<HTMLParagraphElement>(null);
  const status = state?.status ?? "todo";
  const tone = STATUS_TONE[status];
  const working = mode === "work";
  const assignee = team?.find((m) => m.id === state?.assigneeId);
  const isState = step.level === "state";

  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step.detail, open]);

  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        borderColor: working ? tone.line : "var(--line)",
        background: working && status !== "todo" ? tone.bg : "var(--card)",
        opacity: isState && working ? 0.72 : 1,
      }}
    >
      <div className="row" style={{ gap: 7, flexWrap: "wrap", marginBottom: 7 }}>
        <span className={`tag ${isState ? "tag-accent" : ""}`}>{isState ? "State" : FUNCTION_LABEL[step.func]}</span>
        <span className="tag">{step.durationDays}d</span>
        {win && (
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
            day {win.start}–{win.end}
          </span>
        )}
        {working && (
          <span className="tag" style={{ marginLeft: "auto", color: tone.fg, borderColor: tone.line, background: tone.bg }}>
            {tone.label}
          </span>
        )}
      </div>

      <p style={{ fontSize: 13.5, fontWeight: 650, lineHeight: 1.35 }}>{step.title}</p>
      <p
        ref={detailRef}
        className={open ? undefined : "clamp-3"}
        style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.5 }}
      >
        {step.detail}
      </p>
      {(clipped || open) && (
        <button className="btn btn-quiet btn-sm" style={{ padding: "2px 0", fontSize: 11.5 }} onClick={() => setOpen((v) => !v)}>
          {open ? "less" : "more"}
        </button>
      )}

      {step.counterparties.length > 0 && (
        <div className="row" style={{ gap: 5, flexWrap: "wrap", marginTop: 9 }}>
          <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            notify
          </span>
          {step.counterparties.map((c) => (
            <PartyChip key={c.name} party={c} />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 9, lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ink-2)" }}>Output:</strong> {step.output}
      </p>

      {step.gate && (
        <p
          style={{
            fontSize: 11,
            color: "var(--watch)",
            background: "var(--watch-soft)",
            border: "1px solid var(--watch-line)",
            borderRadius: 7,
            padding: "6px 9px",
            marginTop: 8,
            lineHeight: 1.45,
          }}
        >
          <strong>Gate:</strong> {step.gate}
        </p>
      )}

      {working && !isState && (
        <div className="row" style={{ gap: 7, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <select
            value={state?.assigneeId ?? ""}
            onChange={(e) => onAssign?.(step.id, e.target.value || null)}
            aria-label={`Assignee for ${step.title}`}
            style={{ fontSize: 12, padding: "5px 8px", flex: "1 1 130px", minWidth: 0 }}
          >
            <option value="">Unassigned</option>
            {team?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {FUNCTION_LABEL[m.func]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => onStatus?.(step.id, e.target.value as StepStatus)}
            aria-label={`Status of ${step.title}`}
            style={{ fontSize: 12, padding: "5px 8px", flex: "0 0 auto" }}
          >
            <option value="todo">Not started</option>
            <option value="active">In progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      )}

      {working && assignee && (
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
          Assigned to <strong style={{ color: "var(--ink-2)" }}>{assignee.name}</strong>
        </p>
      )}
    </div>
  );
}

export function PartyChip({ party }: { party: Counterparty }) {
  const tone =
    party.kind === "national"
      ? { bg: "var(--brand-soft)", fg: "var(--brand)", line: "var(--brand-line)" }
      : party.kind === "regional"
        ? { bg: "var(--region-soft)", fg: "var(--region)", line: "var(--region-line)" }
        : { bg: "var(--bg-sunk)", fg: "var(--ink-2)", line: "var(--line-strong)" };
  return (
    <span
      title={party.role}
      className="truncate"
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        borderRadius: 6,
        padding: "2px 7px",
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.line}`,
        maxWidth: 220,
        cursor: "help",
      }}
    >
      {party.name}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="sunk" style={{ padding: "10px 12px" }}>
      <p className="mono" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}
