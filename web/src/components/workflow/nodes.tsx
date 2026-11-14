import { Handle, Position } from "@xyflow/react";
import type { CandidateAction } from "@/lib/api";

export type RunStatus = "idle" | "sending" | "sent";

const STATUS_COLOR: Record<RunStatus, string> = {
  idle: "var(--line-strong)",
  sending: "var(--watch)",
  sent: "var(--good)",
};

const KIND_LABEL: Record<CandidateAction["kind"], string> = {
  strategy: "Strategy action",
  covariate: "Data-driven",
};

export function TriggerNode({ data }: { data: { regionName: string; subtitle: string } }) {
  return (
    <div
      style={{
        width: 210,
        background: "var(--ink)",
        color: "var(--card)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <p style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>Region</p>
      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{data.regionName}</p>
      <p style={{ fontSize: 11.5, opacity: 0.75, marginTop: 4 }}>{data.subtitle}</p>
      <Handle type="source" position={Position.Right} style={{ background: "var(--card)", width: 9, height: 9 }} />
    </div>
  );
}

export function ActionNode({
  data,
}: {
  data: { action: CandidateAction; included: boolean; status: RunStatus; onToggle: () => void };
}) {
  const { action, included, status, onToggle } = data;
  const tone = included ? STATUS_COLOR[status] : "var(--line-strong)";

  return (
    <div
      style={{
        width: 270,
        background: included ? "var(--card)" : "var(--bg)",
        border: `1.5px solid ${tone}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        opacity: included ? 1 : 0.55,
        boxShadow: included ? "var(--shadow-card)" : "none",
        transition: "border-color 0.2s ease, opacity 0.2s ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: tone, width: 9, height: 9 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "var(--ink-3)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "1px 7px",
          }}
        >
          {KIND_LABEL[action.kind]}
        </span>
        <label className="nodrag" style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, color: "var(--ink-2)" }}>
          <input type="checkbox" checked={included} onChange={onToggle} style={{ width: 14, height: 14 }} />
          include
        </label>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{action.title}</p>
      <p style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.4 }}>{action.description}</p>
      <details className="nodrag" style={{ marginTop: 7 }}>
        <summary style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", cursor: "pointer" }}>why</summary>
        <p style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.4 }}>{action.why}</p>
      </details>
      <Handle type="source" position={Position.Right} style={{ background: tone, width: 9, height: 9 }} />
    </div>
  );
}

export function OutputNode({ data }: { data: { action: CandidateAction; included: boolean; status: RunStatus } }) {
  const { action, included, status } = data;
  const tone = included ? STATUS_COLOR[status] : "var(--line-strong)";
  const workflow = action.workflow;

  return (
    <div
      style={{
        width: 230,
        background: included ? "var(--card)" : "var(--bg)",
        border: `1.5px solid ${tone}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        opacity: included ? 1 : 0.5,
        transition: "border-color 0.2s ease, opacity 0.2s ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: tone, width: 9, height: 9 }} />
      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)" }}>
        {workflow.type === "patient_message" ? "My Kanta message" : "Stakeholder message"}
      </p>
      <p style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
        {workflow.type === "patient_message" ? workflow.profile : workflow.target}
      </p>
      <p style={{ fontSize: 11, marginTop: 8, fontWeight: 650, color: tone }}>
        {!included ? "Not in plan" : status === "idle" ? "Queued" : status === "sending" ? "Sending..." : "Sent (mock)"}
      </p>
    </div>
  );
}
