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
import { HELSINKI, KNOWN_REGION_CODES } from "@/lib/region-codes";
import { tf, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { regionName } from "@/lib/fi-data";

/** What each priority actually commits the Region to. Without this the
 *  choice was cosmetic — the planner said a response window followed from
 *  it and then no date was ever computed. */
export const RESPONSE_WINDOW_DAYS: Record<Priority, number> = {
  urgent: 5,
  high: 20,
  routine: 60,
};

/** Working days, not calendar days: a statutory response window is counted
 *  in them, and a 5-day urgent window that silently includes a weekend is
 *  the kind of error that loses a Region two days of a five-day clock. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

export function workingDaysUntil(iso: string): number {
  const target = new Date(iso);
  const now = new Date();
  const sign = target >= now ? 1 : -1;
  const [a, b] = sign > 0 ? [now, target] : [target, now];
  let n = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n * sign;
}

export type DirectiveStatus = "not_started" | "in_progress" | "blocked" | "complete";
export type StepStatus = "not_started" | "in_progress" | "blocked" | "complete";
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
  /** When the Region owes the State a response. Derived from `priority` at
   *  issue time so it survives a later change to the window lengths. */
  dueAt: string;
  /** What the State is asking for, in a sentence — the instruction itself. */
  mandate: string;
  /** The Gap that justifies it, carried along so the Region can see the case. */
  evidence: string;
  status: DirectiveStatus;
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

/** Bump this whenever the persisted shape OR the meaning of a field changes.
 *  A stored directive is matched to an account by `regionCode`, so when the app
 *  moved from slug Region codes ("helsinki") to the Sotkanet codes the api
 *  serves ("90"), every directive a browser already held stopped matching any
 *  regional account: the State account, which filters nothing, still showed
 *  them all, while every Regional account showed "Nothing has been issued".
 *  Old keys are cleared on load rather than migrated — this is demo state, and
 *  a half-migrated directive is worse than a clean reseed. */
const STORAGE_KEY = "frontiers-health:program:v4";
const RETIRED_STORAGE_KEYS = [
  "frontiers-health:program:v3",
  "frontiers-health:program:v2",
  "frontiers-health:program:v1",
];

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
    regionCode: HELSINKI,
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
  a.assignedAt = days(11);
  a.steps = a.steps.map((s, i) => ({
    ...s,
    status: i < 4 ? "complete" : i === 4 ? "in_progress" : "not_started",
  }));

  const b = newDirective({
    action: capacity,
    regionCode: HELSINKI,
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
    status: s.level === "state" && s.id.startsWith("mandate-") ? "complete" : "not_started",
    assigneeId: null,
  }));
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  return {
    id: `${input.regionCode}:${input.action.id}:${Math.random().toString(36).slice(2, 8)}`,
    regionCode: input.regionCode,
    regionName: input.regionName,
    action: input.action,
    issuedByAccountId: input.issuedByAccountId,
    issuedAt,
    priority: input.priority,
    dueAt: addWorkingDays(new Date(issuedAt), RESPONSE_WINDOW_DAYS[input.priority]).toISOString(),
    mandate: input.mandate,
    evidence: input.evidence,
    status: "not_started",
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
  const { lang } = useLang();

  // Hydrate after mount: localStorage doesn't exist during the server render,
  // and reading it in useState's initialiser would mismatch the markup.
  useEffect(() => {
    let loaded: ProgramState | null = null;
    try {
      for (const stale of RETIRED_STORAGE_KEYS) window.localStorage.removeItem(stale);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as ProgramState;
    } catch {
      loaded = null;
    }
    // A directive whose Region matches no account is unreachable: every
    // Regional account would show an empty page while State showed it. Treat
    // that as corrupt state and reseed, rather than rendering a dead handoff.
    if (loaded && loaded.directives.some((d) => !KNOWN_REGION_CODES.has(d.regionCode))) {
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
      markRead: (id) => update((s) => (s.readIds.includes(id) ? s : { ...s, readIds: [...s.readIds, id] })),
    assignAll: (id) =>
      patchDirective(id, (d) => {
        const phases = buildPlaybook(d.action, d.regionName);
        const byId = new Map(allSteps(phases).map((s) => [s.id, s]));
        return {
          ...d,
          assignedAt: new Date().toISOString(),
          status: d.status === "complete" ? d.status : "in_progress",
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
        const everyDone = steps.every((s) => s.status === "complete");
        const anyBlocked = steps.some((s) => s.status === "blocked");
        const anyMoving = steps.some((s) => s.status === "in_progress" || s.status === "complete");
        const next: DirectiveStatus = everyDone
          ? "complete"
          : anyBlocked
            ? "blocked"
            : anyMoving
              ? "in_progress"
              : d.status;
        return { ...d, steps, status: next };
      }),
    // Display only: the chain is rebuilt in the reader's language, with the
    // Region named as they see it elsewhere. Step ids are unchanged, so the
    // statuses and assignees stored against them still line up.
    phasesFor: (d) => buildPlaybook(d.action, regionName(d.regionCode, d.regionName, lang), lang),
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

export function isOverdue(d: Directive): boolean {
  return d.status !== "complete" && new Date(d.dueAt) < new Date();
}

/** "in 12 working days" / "3 working days overdue" — the phrasing a
 *  deadline needs, rather than a bare date the reader has to do maths on. */
export function dueLabel(d: Directive, lang: Lang = "en"): { text: string; overdue: boolean } {
  const n = workingDaysUntil(d.dueAt);
  if (d.status === "complete") return { text: tf(lang, "closed", {}), overdue: false };
  if (n < 0) return { text: tf(lang, "{n} working days overdue", { n: Math.abs(n) }), overdue: true };
  if (n === 0) return { text: tf(lang, "response due today", {}), overdue: true };
  return {
    text: tf(lang, n === 1 ? "response due in {n} working day" : "response due in {n} working days", { n }),
    overdue: false,
  };
}

export function progressOf(d: Directive): { done: number; total: number; pct: number } {
  const total = d.steps.length;
  const done = d.steps.filter((s) => s.status === "complete").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** One set of words for work, used for a directive and for a step alike. */
export const STATUS_LABEL: Record<DirectiveStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Done",
};

export const STATUS_TONE: Record<DirectiveStatus, "neutral" | "watch" | "good" | "act" | "brand"> = {
  not_started: "brand",
  in_progress: "watch",
  blocked: "act",
  complete: "good",
};
