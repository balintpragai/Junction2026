"use client";

import { allSteps, criticalPathDays, schedule, type PlaybookPhase } from "@/lib/playbook";
import { FUNCTION_LABEL, type TeamMember } from "@/lib/team";
import type { StepState, StepStatus } from "@/lib/program";

const BAR_TONE: Record<StepStatus, string> = {
  todo: "var(--line-strong)",
  active: "var(--watch)",
  done: "var(--good)",
  blocked: "var(--act)",
};

/** The whole directive on one time axis. Phases run in sequence, steps
 *  inside a phase in parallel, so the shape of the chart is the shape of
 *  the plan — and the long bar in the middle is visibly the reason the end
 *  date is where it is.
 *
 *  Days are working days from the directive's start, not calendar dates:
 *  the Region sets the actual start when it assigns the work. */
export function Timeline({
  phases,
  stepStates,
  team,
}: {
  phases: PlaybookPhase[];
  stepStates: StepState[];
  team: TeamMember[];
}) {
  const total = criticalPathDays(phases) || 1;
  const times = schedule(phases);
  const steps = allSteps(phases);
  const longest = steps.reduce((a, b) => (b.durationDays > a.durationDays ? b : a), steps[0]);

  // A tick roughly every 10 days, rounded to something readable.
  const tickEvery = total > 90 ? 30 : total > 45 ? 14 : 7;
  const ticks: number[] = [];
  for (let d = 0; d <= total; d += tickEvery) ticks.push(d);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: "62ch", lineHeight: 1.5 }}>
          <strong>{total} working days</strong> end to end. The critical path runs through{" "}
          <strong>{longest?.title}</strong> ({longest?.durationDays}d) — compressing anything else will not move the
          finish date.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {(["todo", "active", "done", "blocked"] as StepStatus[]).map((s) => (
            <span key={s} className="row" style={{ gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: BAR_TONE[s], flex: "none" }} />
              <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
                {s === "todo" ? "Not started" : s === "active" ? "In progress" : s === "done" ? "Done" : "Blocked"}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="scroll-y" style={{ maxHeight: 560, paddingRight: 4 }}>
        {phases.map((phase) => (
          <div key={phase.id} style={{ marginBottom: 14 }}>
            <p className="section-title" style={{ fontSize: 10.5, marginBottom: 6 }}>
              {phase.name}
            </p>
            <div className="col" style={{ gap: 5 }}>
              {phase.steps.map((step) => {
                const win = times.get(step.id)!;
                const st = stepStates.find((s) => s.stepId === step.id);
                const status = st?.status ?? "todo";
                const assignee = team.find((m) => m.id === st?.assigneeId);
                const left = (win.start / total) * 100;
                const width = Math.max(1.5, (step.durationDays / total) * 100);
                return (
                  <div
                    key={step.id}
                    style={{ display: "grid", gridTemplateColumns: "minmax(140px, 210px) 1fr", gap: 10, alignItems: "center" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p className="truncate" style={{ fontSize: 11.5, fontWeight: 600 }} title={step.title}>
                        {step.title}
                      </p>
                      <p className="truncate" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                        {assignee ? assignee.name : step.level === "state" ? "State" : "Unassigned"}
                      </p>
                    </div>
                    <div style={{ position: "relative", height: 22, background: "var(--bg-sunk)", borderRadius: 5 }}>
                      {ticks.map((d) => (
                        <span
                          key={d}
                          aria-hidden="true"
                          style={{ position: "absolute", left: `${(d / total) * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--line)" }}
                        />
                      ))}
                      <div
                        title={`${step.title} — day ${win.start} to ${win.end}, ${assignee?.name ?? "unassigned"}`}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 3,
                          height: 16,
                          borderRadius: 4,
                          background: BAR_TONE[status],
                          display: "flex",
                          alignItems: "center",
                          paddingLeft: 6,
                          overflow: "hidden",
                          // A 2px surface gap so neighbouring bars never
                          // read as one continuous block.
                          boxShadow: "0 0 0 2px var(--card)",
                        }}
                      >
                        {/* A bar narrower than its own label renders the
                            label clipped mid-character, so short steps carry
                            their duration in the tooltip only. */}
                        {width > 5 && (
                          <span
                            className="mono"
                            style={{ fontSize: 9.5, color: status === "todo" ? "var(--ink-2)" : "#fff", whiteSpace: "nowrap", fontWeight: 600 }}
                          >
                            {step.durationDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 210px) 1fr", gap: 10 }}>
        <span />
        <div style={{ position: "relative", height: 16 }}>
          {ticks.map((d) => (
            <span
              key={d}
              className="mono"
              style={{ position: "absolute", left: `${(d / total) * 100}%`, fontSize: 10, color: "var(--ink-3)", transform: "translateX(-50%)" }}
            >
              d{d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Who is carrying how much of this directive — the question a Regional
 *  Decision Maker asks before assigning the next step to the same person
 *  who already has five. */
export function TeamLoad({
  phases,
  stepStates,
  team,
}: {
  phases: PlaybookPhase[];
  stepStates: StepState[];
  team: TeamMember[];
}) {
  const steps = allSteps(phases);
  const rows = team
    .map((m) => {
      const mine = stepStates.filter((s) => s.assigneeId === m.id);
      const spec = mine.map((s) => steps.find((x) => x.id === s.stepId)).filter(Boolean);
      return {
        member: m,
        count: mine.length,
        days: spec.reduce((n, s) => n + (s?.durationDays ?? 0), 0),
        done: mine.filter((s) => s.status === "done").length,
        blocked: mine.filter((s) => s.status === "blocked").length,
      };
    })
    .sort((a, b) => b.days - a.days);

  const maxDays = Math.max(1, ...rows.map((r) => r.days + r.member.baseLoad));
  const unassigned = stepStates.filter((s) => {
    const spec = steps.find((x) => x.id === s.stepId);
    return spec && spec.level !== "state" && !s.assigneeId;
  }).length;

  return (
    <div className="col" style={{ gap: 12 }}>
      {unassigned > 0 && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--watch)",
            background: "var(--watch-soft)",
            border: "1px solid var(--watch-line)",
            borderRadius: "var(--radius-sm)",
            padding: "9px 12px",
          }}
        >
          {unassigned} step{unassigned > 1 ? "s" : ""} still unassigned — the timeline below assumes they start on
          schedule anyway.
        </p>
      )}

      <div className="col" style={{ gap: 9 }}>
        {rows.map(({ member, count, days, done, blocked }) => (
          <div key={member.id} className="card" style={{ padding: "11px 13px" }}>
            <div className="row" style={{ gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: count > 0 ? "var(--accent)" : "var(--bg-sunk)",
                  color: count > 0 ? "#fff" : "var(--ink-3)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  flex: "none",
                }}
              >
                {member.initials}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 650 }}>{member.name}</p>
                <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{FUNCTION_LABEL[member.func]}</p>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <p className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                  {count}
                </p>
                <p style={{ fontSize: 10, color: "var(--ink-3)" }}>step{count === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div
              aria-hidden="true"
              style={{ display: "flex", gap: 2, height: 6, marginTop: 9, borderRadius: 999, overflow: "hidden", background: "var(--bg-sunk)" }}
            >
              <span style={{ width: `${(member.baseLoad / maxDays) * 100}%`, background: "var(--line-strong)" }} />
              <span style={{ width: `${(days / maxDays) * 100}%`, background: blocked > 0 ? "var(--act)" : "var(--accent)" }} />
            </div>
            <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 5 }}>
              {member.baseLoad}d existing work · {days}d from this directive
              {done > 0 && ` · ${done} done`}
              {blocked > 0 && <strong style={{ color: "var(--act)" }}> · {blocked} blocked</strong>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
