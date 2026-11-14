"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ActionNode, OutputNode, TriggerNode, type RunStatus } from "@/components/workflow/nodes";
import { ActionSearch } from "@/components/workflow/ActionSearch";
import type { CandidateAction, Region } from "@/lib/api";

const ROW_H = 230;
// "output" collides with React Flow's own reserved built-in node type and
// leaks its default border styling through — named "destination" instead.
const nodeTypes = { trigger: TriggerNode, action: ActionNode, destination: OutputNode };

/** The action planner as a connected workflow. Actions are searched for and
 *  dropped in from the palette above; each one lands on the canvas wired
 *  from the Region trigger to the message it would send. Activate runs the
 *  chain, lighting up nodes and edges in sequence (mock sends only). */
export function WorkflowCanvas({
  region,
  recommended,
  library,
}: {
  region: Region;
  recommended: CandidateAction[];
  library: CandidateAction[];
}) {
  const [added, setAdded] = useState<CandidateAction[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({});
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const flow = useRef<ReactFlowInstance | null>(null);

  const addedIds = useMemo(() => new Set(added.map((a) => a.id)), [added]);

  // `fitView` as a prop only runs on mount, so the canvas would keep the
  // single-trigger-node framing and cut off everything added afterwards.
  useEffect(() => {
    const id = setTimeout(() => flow.current?.fitView({ padding: 0.2, duration: 320 }), 60);
    return () => clearTimeout(id);
  }, [added.length]);

  function addAction(action: CandidateAction) {
    setAdded((prev) => (prev.some((a) => a.id === action.id) ? prev : [...prev, action]));
    setDone(false);
  }

  function removeAction(id: string) {
    setAdded((prev) => prev.filter((a) => a.id !== id));
    setStatuses((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
    setDone(false);
  }

  function activate() {
    setRunning(true);
    setDone(false);
    setStatuses(Object.fromEntries(added.map((a) => [a.id, "idle" as RunStatus])));

    added.forEach((action, i) => {
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sending" })), i * 600 + 150);
      setTimeout(() => setStatuses((s) => ({ ...s, [action.id]: "sent" })), i * 600 + 700);
    });
    setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, added.length * 600 + 750);
  }

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const totalH = Math.max(0, (added.length - 1) * ROW_H);
    const triggerY = totalH / 2;

    const n: Node[] = [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 20, y: triggerY },
        data: {
          regionName: region.name,
          subtitle: added.length === 0 ? "no actions yet" : `${added.length} action${added.length !== 1 ? "s" : ""} in plan`,
        },
      },
      ...added.flatMap((action, i) => {
        const status = statuses[action.id] ?? "idle";
        const y = i * ROW_H;
        return [
          {
            id: `action-${action.id}`,
            type: "action",
            position: { x: 320, y },
            data: { action, status, onRemove: () => removeAction(action.id) },
          },
          {
            id: `destination-${action.id}`,
            type: "destination",
            position: { x: 660, y },
            data: { action, status },
          },
        ];
      }),
    ];

    const e: Edge[] = added.flatMap((action) => {
      const status = statuses[action.id] ?? "idle";
      const color = status === "sent" ? "var(--good)" : status === "sending" ? "var(--watch)" : "var(--brand)";
      const animated = status === "sending";
      return [
        { id: `e-trigger-${action.id}`, source: "trigger", target: `action-${action.id}`, style: { stroke: color, strokeWidth: 2 }, animated },
        { id: `e-action-${action.id}`, source: `action-${action.id}`, target: `destination-${action.id}`, style: { stroke: color, strokeWidth: 2 }, animated },
      ];
    });

    return { nodes: n, edges: e };
  }, [added, statuses, region.name]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ActionSearch recommended={recommended} library={library} addedIds={addedIds} onAdd={addAction} />

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
        }}
      >
        <span style={{ fontSize: 14, color: added.length === 0 ? "var(--ink-3)" : "var(--ink)" }}>
          {added.length === 0 ? "Nothing in the plan yet" : `${added.length} action${added.length > 1 ? "s" : ""} in this plan`}
        </span>
        <button
          onClick={activate}
          disabled={added.length === 0 || running}
          style={{
            background: added.length === 0 || running ? "var(--ink-3)" : "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontWeight: 650,
            fontSize: 14,
            cursor: added.length === 0 || running ? "default" : "pointer",
          }}
        >
          {running ? "Running…" : done ? "Run again" : "Activate plan"}
        </button>
      </div>

      {done && !running && (
        <div
          style={{
            background: "var(--good-soft)",
            border: "1px solid var(--good-line)",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            fontSize: 13.5,
            color: "var(--good)",
            fontWeight: 600,
          }}
        >
          Plan activated for {region.name} — {added.length} action{added.length > 1 ? "s" : ""} sent (mock, nothing was
          actually sent).
        </div>
      )}

      <div
        style={{
          position: "relative",
          // Capped: past a few actions the view zooms out rather than the
          // page growing a canvas taller than anyone's screen.
          height: Math.min(720, Math.max(380, added.length * ROW_H + 110)),
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
          fitViewOptions={{ padding: 0.2, minZoom: 0.3, maxZoom: 1 }}
          minZoom={0.2}
          onInit={(instance) => {
            flow.current = instance;
          }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          style={{ width: "100%", height: "100%" }}
        >
          <Background gap={18} color="var(--line)" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {added.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "14%",
              pointerEvents: "none",
            }}
          >
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", maxWidth: 260, textAlign: "center" }}>
              Search above and add an action — it drops straight onto this canvas, wired to the message it sends.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
