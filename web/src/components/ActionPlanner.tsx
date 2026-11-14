"use client";

import { useState } from "react";
import type { CandidateAction, Region } from "@/lib/api";

type StepStatus = "pending" | "sending" | "sent";

const KIND_LABEL: Record<CandidateAction["kind"], string> = {
  strategy: "National Cancer Strategy action",
  covariate: "Data-driven suggestion",
};

export function ActionPlanner({ region, actions }: { region: Region; actions: CandidateAction[] }) {
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"plan" | "running" | "done">("plan");
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});

  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const plan = actions.filter((a) => included.has(a.id));

  function activate() {
    setPhase("running");
    const initial: Record<string, StepStatus> = {};
    plan.forEach((a) => (initial[a.id] = "pending"));
    setStatuses(initial);

    plan.forEach((action, i) => {
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sending" })), i * 550 + 150);
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sent" })), i * 550 + 650);
    });
    setTimeout(() => setPhase("done"), plan.length * 550 + 700);
  }

  if (phase !== "plan") {
    return <WorkflowRun region={region} plan={plan} statuses={statuses} done={phase === "done"} onReset={() => { setPhase("plan"); setIncluded(new Set()); }} />;
  }

  if (actions.length === 0) {
    return (
      <p style={{ color: "var(--ink-2)" }}>
        No candidate actions for {region.name} this year -- every tracked indicator is at or ahead of target.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {actions.map((action) => {
          const checked = included.has(action.id);
          return (
            <label
              key={action.id}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                background: checked ? "var(--brand-soft)" : "var(--card)",
                border: `1px solid ${checked ? "var(--brand-line)" : "var(--line)"}`,
                borderRadius: "var(--radius-md)",
                padding: "16px 18px",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(action.id)} style={{ marginTop: 4, width: 18, height: 18, flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{action.title}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      color: "var(--ink-3)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {KIND_LABEL[action.kind]}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 6 }}>{action.description}</p>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", cursor: "pointer" }}>Why this action</summary>
                  <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{action.why}</p>
                </details>
                <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>
                  {action.workflow.type === "stakeholder_message"
                    ? `Sends a message to: ${action.workflow.target}`
                    : `Sends a My Kanta message to: ${action.workflow.profile}`}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 16,
          background: "var(--ink)",
          color: "var(--card)",
          borderRadius: "var(--radius-md)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <span style={{ fontSize: 14 }}>
          {plan.length === 0 ? "No actions selected yet" : `${plan.length} action${plan.length > 1 ? "s" : ""} in this plan`}
        </span>
        <button
          onClick={activate}
          disabled={plan.length === 0}
          style={{
            background: plan.length === 0 ? "var(--ink-3)" : "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 650,
            fontSize: 14,
            cursor: plan.length === 0 ? "default" : "pointer",
          }}
        >
          Activate plan
        </button>
      </div>
    </div>
  );
}

function WorkflowRun({
  region,
  plan,
  statuses,
  done,
  onReset,
}: {
  region: Region;
  plan: CandidateAction[];
  statuses: Record<string, StepStatus>;
  done: boolean;
  onReset: () => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
        mock workflow -- nothing below is actually sent
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.map((action) => {
          const status = statuses[action.id] ?? "pending";
          return (
            <div
              key={action.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                padding: "14px 18px",
              }}
            >
              <StepDot status={status} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 650 }}>{action.title}</p>
                <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3 }}>
                  {status === "pending" && "Queued..."}
                  {status === "sending" &&
                    (action.workflow.type === "stakeholder_message"
                      ? `Drafting message to ${action.workflow.target}...`
                      : `Drafting My Kanta message for ${action.workflow.profile}...`)}
                  {status === "sent" &&
                    (action.workflow.type === "stakeholder_message"
                      ? `Sent to ${action.workflow.target}.`
                      : `Sent via My Kanta to ${action.workflow.profile}.`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div
          style={{
            marginTop: 20,
            background: "var(--good-soft)",
            border: "1px solid var(--good-line)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <p style={{ fontWeight: 650, color: "var(--good)" }}>
            Plan activated for {region.name} -- {plan.length} action{plan.length > 1 ? "s" : ""} sent (mock).
          </p>
          <button
            onClick={onReset}
            style={{ marginTop: 10, background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}
          >
            Build another plan
          </button>
        </div>
      )}
    </div>
  );
}

function StepDot({ status }: { status: StepStatus }) {
  const color = status === "sent" ? "var(--good)" : status === "sending" ? "var(--watch)" : "var(--ink-3)";
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        flex: "none",
        transition: "background 0.2s ease",
      }}
    />
  );
}
