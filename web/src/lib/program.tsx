"use client";

/** The handoff. A State Decision Maker issues a directive and stops; a
 *  Regional Decision Maker picks it up and does the work. This store is the
 *  thing in between — the only place both roles read and write.
 *
 *  Persisted to localStorage so the handoff survives a reload and a role
 *  switch, which is the whole point of the demo: issue it as the State,
 *  switch account, and find it waiting. A real deployment replaces this with
 *  the api; nothing above this module knows which it is. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CandidateAction } from "@/lib/api";
import { buildPlaybook, allSteps, type PlaybookPhase } from "@/lib/playbook";
import { DEFAULT_ACCOUNT_ID, accountById, type Account } from "@/lib/roles";
import { memberForFunction } from "@/lib/team";

export type DirectiveStatus = "issued" | "acknowledged" | "in_progress" | "blocked" | "complete";
export type StepStatus = "todo" | "active" | "done" | "blocked";
export type Priority = "routine" | "high" | "urgent";

export interface StepState {
  stepId: string;
  status: StepStatus;
  /** A team member id from `team.ts`, or null while unassigned. */
  assigneeId: string | null;
  note?: string;
}

export interface Directive {
  id: string;
  regionCode: string;
  regionName: string;
  action: CandidateAction;
  issuedByAccountId: string;
  issuedAt: string;
  priority: Priority;
  /** What the State is asking for, in a sentence — the instruction itself. */
  mandate: string;
  /** The Gap that justifies it, carried along so the Region can see the case. */
  evidence: string;
  status: DirectiveStatus;
  acknowledgedAt: string | null;
  steps: StepState[];
  /** Set when the Region assigns the whole chain to its team in one go. */
  assignedAt: string | null;
}

export interface ProgramState {
  accountId: string;
  directives: Directive[];
  /** Directive ids the current regional user has already opened. */
  readIds: string[];
}

const STORAGE_KEY = "frontiers-health:program:v1";

// --- seeding ----------------------------------------------------------------

/** Two directives that already exist when the demo opens, so a Regional
 *  Decision Maker's dashboard is a working desk rather than an empty state —
 *  one part-done, one untouched. */
function seedDirectives(): Directive[] {
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000).toISOString();

  const multilingual: CandidateAction = {
    id: "multilingual-outreach",
    kind: "covariate",
    recommended: true,
    title: "Multilingual, community-based screening outreach",
    description:
      "Targeted invitations and reminders in the Region's most common non-Finnish/Swedish languages, run with community organisations rather than a generic translation.",
    why: "Foreign background share here is above the national median, and this is the one covariate that predicts lower screening attendance at both the Region and individual level.",
    workflow: { type: "patient_message", profile: "invitees whose recorded native language is not Finnish or Swedish" },
  };

  const capacity: CandidateAction = {
    id: "capacity-review",
    kind: "covariate",
    recommended: true,
    title: "Primary-care / specialist capacity review",
    description:
      "A direct staffing and scheduling review with the Region's own specialised-care management — not an outreach fix, because the data here doesn't point to a demand-side cause.",
    why: "The long-wait figures here are outside the ok range and none of the tracked covariates explain them — that pattern points at capacity, not access.",
    workflow: { type: "stakeholder_message", target: "City of Helsinki — specialised care management" },
  };

  const a = newDirective({
    action: multilingual,
    regionCode: "helsinki",
    regionName: "City of Helsinki",
    issuedByAccountId: "state-stm",
    priority: "high",
    mandate:
      "Raise breast screening attendance among non-Finnish/Swedish speaking invitees to within 3 pp of the 80% national target by the end of the next screening round.",
    evidence:
      "Attendance 74.3% against an 80% target — 5.7 pp below, ranking 22 of 23. Foreign-background share 19.6% against a 9.2% national median.",
    issuedAt: days(12),
  });
  a.status = "in_progress";
  a.acknowledgedAt = days(11);
  a.assignedAt = days(11);
  a.steps = a.steps.map((s, i) => ({
    ...s,
    status: i < 4 ? "done" : i === 4 ? "active" : "todo",
  }));

  const b = newDirective({
    action: capacity,
    regionCode: "helsinki",
    regionName: "City of Helsinki",
    issuedByAccountId: "state-stm",
    priority: "routine",
    mandate:
      "Establish whether the specialised-care waiting figure is a staffing or a scheduling constraint, and return a costed remedial plan to the board.",
    evidence:
      "Patients waiting over 6 months is outside the ok range against the peer median, and no tracked covariate explains the pattern (all |r| <= 0.27).",
    issuedAt: days(2),
  });

  return [a, b];
}

export function newDirective(input: {
  action: CandidateAction;
  regionCode: string;
  regionName: string;
  issuedByAccountId: string;
  priority: Priority;
  mandate: string;
  evidence: string;
  issuedAt?: string;
}): Directive {
  const phases = buildPlaybook(input.action, input.regionName);
  const steps: StepState[] = allSteps(phases).map((s) => ({
    stepId: s.id,
    // The two national steps are complete by definition — the State did them
    // in the act of issuing.
    status: s.level === "state" && s.id.startsWith("mandate-") ? "done" : "todo",
    assigneeId: null,
  }));
  return {
    id: `${input.regionCode}:${input.action.id}:${Math.random().toString(36).slice(2, 8)}`,
    regionCode: input.regionCode,
    regionName: input.regionName,
    action: input.action,
    issuedByAccountId: input.issuedByAccountId,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    priority: input.priority,
    mandate: input.mandate,
    evidence: input.evidence,
    status: "issued",
    acknowledgedAt: null,
    steps,
    assignedAt: null,
  };
}

// --- context ----------------------------------------------------------------

interface ProgramApi {
  ready: boolean;
  account: Account;
  setAccountId: (id: string) => void;
  directives: Directive[];
  /** Directives for the account's own Region (regional) or all (state). */
  visibleDirectives: Directive[];
  unreadCount: number;
  issue: (d: Directive[]) => void;
  acknowledge: (id: string) => void;
  markRead: (id: string) => void;
  assignAll: (id: string) => void;
  setStepAssignee: (directiveId: string, stepId: string, assigneeId: string | null) => void;
  setStepStatus: (directiveId: string, stepId: string, status: StepStatus) => void;
  phasesFor: (d: Directive) => PlaybookPhase[];
  reset: () => void;
}

const Ctx = createContext<ProgramApi | null>(null);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgramState>({ accountId: DEFAULT_ACCOUNT_ID, directives: [], readIds: [] });
  const [ready, setReady] = useState(false);

  // Hydrate after mount: localStorage doesn't exist during the server render,
  // and reading it in useState's initialiser would mismatch the markup.
  useEffect(() => {
    let loaded: ProgramState | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as ProgramState;
    } catch {
      loaded = null;
    }
    setState(loaded ?? { accountId: DEFAULT_ACCOUNT_ID, directives: seedDirectives(), readIds: [] });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // A private window with storage blocked still runs the demo; it just
      // won't survive a reload.
    }
  }, [state, ready]);

  const account = accountById(state.accountId);

  const update = useCallback((fn: (s: ProgramState) => ProgramState) => setState(fn), []);

  const patchDirective = useCallback(
    (id: string, fn: (d: Directive) => Directive) =>
      update((s) => ({ ...s, directives: s.directives.map((d) => (d.id === id ? fn(d) : d)) })),
    [update],
  );

  const visibleDirectives = useMemo(() => {
    if (account.role === "state") return state.directives;
    return state.directives.filter((d) => d.regionCode === account.regionCode);
  }, [state.directives, account]);

  const unreadCount = useMemo(() => {
    if (account.role !== "regional") return 0;
    return visibleDirectives.filter((d) => !state.readIds.includes(d.id)).length;
  }, [visibleDirectives, state.readIds, account.role]);

  const api: ProgramApi = {
    ready,
    account,
    setAccountId: (id) => update((s) => ({ ...s, accountId: id })),
    directives: state.directives,
    visibleDirectives,
    unreadCount,
    issue: (ds) => update((s) => ({ ...s, directives: [...ds, ...s.directives] })),
    acknowledge: (id) =>
      patchDirective(id, (d) => ({
        ...d,
        status: d.status === "issued" ? "acknowledged" : d.status,
        acknowledgedAt: d.acknowledgedAt ?? new Date().toISOString(),
      })),
    markRead: (id) => update((s) => (s.readIds.includes(id) ? s : { ...s, readIds: [...s.readIds, id] })),
    assignAll: (id) =>
      patchDirective(id, (d) => {
        const phases = buildPlaybook(d.action, d.regionName);
        const byId = new Map(allSteps(phases).map((s) => [s.id, s]));
        return {
          ...d,
          assignedAt: new Date().toISOString(),
          status: d.status === "complete" ? d.status : "in_progress",
          acknowledgedAt: d.acknowledgedAt ?? new Date().toISOString(),
          steps: d.steps.map((st) => {
            const spec = byId.get(st.stepId);
            if (!spec || spec.level === "state") return st;
            return { ...st, assigneeId: st.assigneeId ?? memberForFunction(d.regionCode, spec.func).id };
          }),
        };
      }),
    setStepAssignee: (directiveId, stepId, assigneeId) =>
      patchDirective(directiveId, (d) => ({
        ...d,
        steps: d.steps.map((s) => (s.stepId === stepId ? { ...s, assigneeId } : s)),
      })),
    setStepStatus: (directiveId, stepId, status) =>
      patchDirective(directiveId, (d) => {
        const steps = d.steps.map((s) => (s.stepId === stepId ? { ...s, status } : s));
        const everyDone = steps.every((s) => s.status === "done");
        const anyBlocked = steps.some((s) => s.status === "blocked");
        const anyMoving = steps.some((s) => s.status === "active" || s.status === "done");
        const next: DirectiveStatus = everyDone
          ? "complete"
          : anyBlocked
            ? "blocked"
            : anyMoving
              ? "in_progress"
              : d.status;
        return { ...d, steps, status: next };
      }),
    phasesFor: (d) => buildPlaybook(d.action, d.regionName),
    reset: () => update(() => ({ accountId: DEFAULT_ACCOUNT_ID, directives: seedDirectives(), readIds: [] })),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProgram(): ProgramApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgram must be used inside <ProgramProvider>");
  return ctx;
}

// --- derived helpers --------------------------------------------------------

export function progressOf(d: Directive): { done: number; total: number; pct: number } {
  const total = d.steps.length;
  const done = d.steps.filter((s) => s.status === "done").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export const STATUS_LABEL: Record<DirectiveStatus, string> = {
  issued: "Awaiting the Region",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
};

export const STATUS_TONE: Record<DirectiveStatus, "neutral" | "watch" | "good" | "act" | "brand"> = {
  issued: "brand",
  acknowledged: "neutral",
  in_progress: "watch",
  blocked: "act",
  complete: "good",
};
