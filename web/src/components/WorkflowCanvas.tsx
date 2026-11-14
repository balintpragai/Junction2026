"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ActionNode, OutputNode, TriggerNode, type RunStatus } from "@/components/workflow/nodes";
import type { CandidateAction, Region } from "@/lib/api";

const ROW_H = 230;
// "output" collides with React Flow's own reserved built-in node type and
// leaks its default border styling through -- named "destination" instead.
const nodeTypes = { trigger: TriggerNode, action: ActionNode, destination: OutputNode };

/** The action planner as a connected workflow -- a Region trigger branching
 *  into one node per candidate action, each wired to the message it would
 *  send. Toggling "include" builds the plan; Activate runs it, lighting up
 *  nodes and edges in sequence, same mock-send semantics as before. */
export function WorkflowCanvas({ region, actions }: { region: Region; actions: CandidateAction[] }) {
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const plan = actions.filter((a) => included.has(a.id));

  function activate() {
    setRunning(true);
    setDone(false);
    const reset: Record<string, RunStatus> = {};
    actions.forEach((a) => (reset[a.id] = "idle"));
    setStatuses(reset);

    plan.forEach((action, i) => {
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sending" })), i * 600 + 150);
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sent" })), i * 600 + 700);
    });
    setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, plan.length * 600 + 750);
  }

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const totalH = Math.max(0, (actions.length - 1) * ROW_H);
    const triggerY = totalH / 2;

    const n: Node[] = [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 20, y: triggerY },
        data: { regionName: region.name, subtitle: `${actions.length} candidate action${actions.length !== 1 ? "s" : ""}` },
        draggable: true,
      },
      ...actions.flatMap((action, i) => {
        const isIncluded = included.has(action.id);
        const status = statuses[action.id] ?? "idle";
        const y = i * ROW_H;
        return [
          {
            id: `action-${action.id}`,
            type: "action",
            position: { x: 320, y },
            data: { action, included: isIncluded, status, onToggle: () => toggle(action.id) },
          },
          {
            id: `output-${action.id}`,
            type: "destination",
            position: { x: 660, y },
            data: { action, included: isIncluded, status },
          },
        ];
      }),
    ];

    const e: Edge[] = actions.flatMap((action) => {
      const isIncluded = included.has(action.id);
      const status = statuses[action.id] ?? "idle";
      const color = !isIncluded ? "var(--line-strong)" : status === "sent" ? "var(--good)" : status === "sending" ? "var(--watch)" : "var(--brand)";
      const animated = isIncluded && status === "sending";
      return [
        { id: `e-trigger-${action.id}`, source: "trigger", target: `action-${action.id}`, style: { stroke: color, strokeWidth: isIncluded ? 2 : 1.3 }, animated },
        { id: `e-action-${action.id}`, source: `action-${action.id}`, target: `output-${action.id}`, style: { stroke: color, strokeWidth: isIncluded ? 2 : 1.3 }, animated },
      ];
    });

    return { nodes: n, edges: e };
  }, [actions, included, statuses, region.name]);

  if (actions.length === 0) {
    return (
      <p style={{ color: "var(--ink-2)" }}>
        No candidate actions for {region.name} this year — every tracked indicator is at or ahead of target.
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md)",
          padding: "12px 18px",
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 14 }}>
          {plan.length === 0 ? "No actions selected — tick “include” on a node" : `${plan.length} action${plan.length > 1 ? "s" : ""} in this plan`}
        </span>
        <button
          onClick={activate}
          disabled={plan.length === 0 || running}
          style={{
            background: plan.length === 0 || running ? "var(--ink-3)" : "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 650,
            fontSize: 14,
            cursor: plan.length === 0 || running ? "default" : "pointer",
          }}
        >
          {running ? "Running..." : done ? "Run again" : "Activate plan"}
        </button>
      </div>

      {done && !running && (
        <div
          style={{
            background: "var(--good-soft)",
            border: "1px solid var(--good-line)",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            marginBottom: 14,
            fontSize: 13.5,
            color: "var(--good)",
            fontWeight: 600,
          }}
        >
          Plan activated for {region.name} — {plan.length} action{plan.length > 1 ? "s" : ""} sent (mock, nothing was actually sent).
        </div>
      )}

      <div
        style={{
          height: Math.max(420, actions.length * ROW_H + 100),
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25, minZoom: 0.3, maxZoom: 1 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          style={{ width: "100%", height: "100%" }}
        >
          <Background gap={18} color="var(--line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
        drag nodes to rearrange — tick "include" to add an action to the plan, then Activate
      </p>
    </div>
  );
}
