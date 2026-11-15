"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CandidateAction, Region, RegionProfile } from "@/lib/api";
import { buildPlaybook, criticalPathDays } from "@/lib/playbook";
import { newDirective, useProgram, RESPONSE_WINDOW_DAYS, type Priority } from "@/lib/program";
import { SequenceView } from "@/components/sequence/SequenceView";
import { ActionSearch } from "@/components/planner/ActionSearch";

type Stage = "planning" | "issued";

/** Each priority names the response window it actually sets, so the choice
 *  reads as a commitment rather than a mood. */
const PRIORITY_LABEL: Record<Priority, string> = {
  routine: "Routine",
  high: "High",
  urgent: "Urgent",
};

/** Where a State Decision Maker turns a Region's Gaps into instructions.
 *
 *  Two stages, in order, because the old free-floating canvas let actions
 *  overlap and gave no answer to "and then what happens?". Build the plan;
 *  review exactly what each action sets in motion and who it lands on; then
 *  issue. Issuing ends the State's involvement — the Region picks it up. */
export function ActionPlanner({
  region,
  profile,
  recommended,
  library,
}: {
  region: Region;
  profile: RegionProfile;
  recommended: CandidateAction[];
  library: CandidateAction[];
}) {
  const { account, issue } = useProgram();
  const [plan, setPlan] = useState<CandidateAction[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("planning");
  const [priority, setPriority] = useState<Priority>("high");
  const [mandate, setMandate] = useState("");

  const planIds = useMemo(() => new Set(plan.map((a) => a.id)), [plan]);
  const focus = plan.find((a) => a.id === focusId) ?? plan[0] ?? null;
  const focusPhases = useMemo(() => (focus ? buildPlaybook(focus, region.name) : []), [focus, region.name]);

  const worstGap = profile.gaps.find((g) => g.gap.severity === "act") ?? profile.gaps[0];
  // Splicing the action's own title into a sentence reads badly — strategy
  // titles are themselves full sentences. The default states the outcome and
  // leaves the method to the actions attached to it.
  const defaultMandate =
    `Close the Gap addressed by ${plan.length === 1 ? "this action" : `these ${plan.length} actions`} in ${region.name}, ` +
    `and report measured movement against the national target within the current screening round.`;

  function add(action: CandidateAction) {
    setPlan((prev) => (prev.some((a) => a.id === action.id) ? prev : [...prev, action]));
    setFocusId(action.id);
  }

  function remove(id: string) {
    setPlan((prev) => prev.filter((a) => a.id !== id));
    if (focusId === id) setFocusId(null);
  }

  function issuePlan() {
    const text = mandate.trim() || defaultMandate;
    const evidence = worstGap
      ? `${worstGap.narrative.text}${
          profile.covariates.immigrant_background_pct != null
            ? ` Foreign-background share ${profile.covariates.immigrant_background_pct}% against a ${profile.covariate_meta.immigrant_background_pct.median}% national median.`
            : ""
        }`
      : "See the Region profile for the full evidence pack.";

    issue(
      plan.map((action) =>
        newDirective({
          action,
          regionCode: region.code,
          regionName: region.name,
          issuedByAccountId: account.id,
          priority,
          mandate: text,
          evidence,
        }),
      ),
    );
    setStage("issued");
  }

  if (stage === "issued") {
    return <IssuedConfirmation region={region} count={plan.length} />;
  }

  return (
    <div className="col" style={{ gap: 18 }}>

      <div
          className="planner-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 20, alignItems: "flex-start" }}
        >
          <div className="col" style={{ gap: 14, position: "sticky", top: 78 }}>
            <ActionSearch recommended={recommended} library={library} addedIds={planIds} onAdd={add} />

            <div className="card" style={{ padding: "13px 15px" }}>
              <h2 style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10 }}>
                In this plan ({plan.length})
              </h2>
              {plan.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  Nothing yet. Add a recommended action above, or search the full National Cancer Strategy.
                </p>
              ) : (
                <div className="col" style={{ gap: 7 }}>
                  {plan.map((a) => {
                    const active = focus?.id === a.id;
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          border: `1px solid ${active ? "var(--accent-line)" : "var(--line)"}`,
                          background: active ? "var(--accent-soft)" : "var(--card)",
                          borderRadius: 9,
                          padding: "8px 10px",
                        }}
                      >
                        <button
                          onClick={() => setFocusId(a.id)}
                          style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: 0, minWidth: 0 }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.35, display: "block" }}>{a.title}</span>
                          <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                            {buildPlaybook(a, region.name).reduce((n, p) => n + p.steps.length, 0)} steps over{" "}
                            {criticalPathDays(buildPlaybook(a, region.name))} working days
                          </span>
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          aria-label={`Remove ${a.title} from the plan`}
                          title="Remove from plan"
                          className="hit"
                          style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0, flex: "none" }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {plan.length > 0 && (
              <IssuePanel
                region={region}
                plan={plan}
                priority={priority}
                setPriority={setPriority}
                mandate={mandate}
                setMandate={setMandate}
                defaultMandate={defaultMandate}
                onIssue={issuePlan}
              />
            )}
          </div>

          <div>
            {focus ? (
              <div className="card-lg" style={{ padding: 20 }}>
                <header style={{ marginBottom: 15 }}>
                  <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                    <span className={`tag ${focus.recommended ? "tag-accent" : ""}`}>
                      {focus.kind === "strategy" ? "Strategy action" : "Data-driven"}
                    </span>
                    {focus.recommended && <span className="tag tag-accent">Recommended here</span>}
                    <span className="tag">
                      {focus.workflow.type === "patient_message" ? "Reaches patients" : "Reaches institutions"}
                    </span>
                  </div>
                  <h2 style={{ fontSize: "1.25rem", marginTop: 10 }}>{focus.title}</h2>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 7, lineHeight: 1.6, maxWidth: "74ch" }}>
                    {focus.description}
                  </p>
                  <details className="sunk" style={{ padding: "10px 13px", marginTop: 11 }}>
                    <summary style={{ fontSize: 12, fontWeight: 650, cursor: "pointer", color: "var(--ink-2)" }}>
                      Why this action, for this Region
                    </summary>
                    <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>{focus.why}</p>
                  </details>
                </header>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 15 }}>
                  <h3 style={{ fontSize: 13, marginBottom: 4 }}>What this sets in motion</h3>
                  <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 14, maxWidth: "74ch" }}>
                    Choosing this action does not send a message. It starts the chain below — every step the Region
                    has to complete, and every institution that has to be told, before anything reaches a patient.
                  </p>
                  <SequenceView phases={focusPhases} mode="preview" />
                </div>
              </div>
            ) : (
              <div className="card-lg" style={{ padding: "64px 32px", textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                  Add an action to see the chain of work it implies — the steps, the institutions that have to be
                  notified, and how long it actually takes.
                </p>
              </div>
            )}
          </div>
        </div>

      <style>{`
        @media (max-width: 1040px) {
          .planner-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .planner-grid > div:first-child { position: static !important; }
        }
      `}</style>
    </div>
  );
}

/** What issuing commits to, next to the plan it applies to. This replaced a
 *  separate review screen: a mode switch is a lot of ceremony around three
 *  fields, and it put the primary action somewhere you had to navigate to. */
function IssuePanel({
  region,
  plan,
  priority,
  setPriority,
  mandate,
  setMandate,
  defaultMandate,
  onIssue,
}: {
  region: Region;
  plan: CandidateAction[];
  priority: Priority;
  setPriority: (p: Priority) => void;
  mandate: string;
  setMandate: (s: string) => void;
  defaultMandate: string;
  onIssue: () => void;
}) {
  return (
    <div className="card" style={{ padding: "13px 15px" }}>
      <h2 style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10 }}>Issue to the Region</h2>

      <label htmlFor="mandate" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
        The instruction
      </label>
      <textarea
        id="mandate"
        value={mandate}
        onChange={(e) => setMandate(e.target.value)}
        placeholder={defaultMandate}
        rows={4}
        style={{
          width: "100%",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 10px",
          fontSize: 12.5,
          fontFamily: "inherit",
          lineHeight: 1.5,
          color: "var(--ink)",
          resize: "vertical",
        }}
      />
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.45 }}>
        State the outcome and the deadline, not the method. The method is the Region&rsquo;s to choose.
      </p>

      <p style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6 }}>Priority</p>
      <div className="col" style={{ gap: 5 }}>
        {(["urgent", "high", "routine"] as Priority[]).map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            aria-pressed={priority === p}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12.5,
              background: priority === p ? "var(--ink)" : "var(--card)",
              color: priority === p ? "var(--card)" : "var(--ink-2)",
              border: `1px solid ${priority === p ? "var(--ink)" : "var(--line-strong)"}`,
            }}
          >
            <span style={{ fontWeight: 650, textTransform: "capitalize" }}>{p}</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>{RESPONSE_WINDOW_DAYS[p]} working days</span>
          </button>
        ))}
      </div>

      <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={onIssue}>
        Issue {plan.length} action{plan.length > 1 ? "s" : ""} to{" "}
        {region.name.replace(/ wellbeing services county$/, "")}
      </button>
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="sunk" style={{ padding: "8px 10px" }}>
      <p className="tnum" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

function IssuedConfirmation({ region, count }: { region: Region; count: number }) {
  return (
    <div className="card-lg" style={{ padding: "44px 36px", maxWidth: 620, margin: "24px auto", textAlign: "center" }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "var(--good-soft)",
          border: "1px solid var(--good-line)",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 16px",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M5.5 11.5 9.5 15.5 16.5 7" stroke="var(--good)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 style={{ fontSize: "1.35rem" }}>
        {count} directive{count > 1 ? "s" : ""} issued to {region.name}
      </h2>
      <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 11, lineHeight: 1.65 }}>
        {region.name} has been notified. Nothing is in motion
        yet, and that is correct: the Region now has to assign each step to its own team and work out the detail only
        it can. Progress will appear under Programmes as they report it.
      </p>
      <div className="row" style={{ gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
        <Link href="/programmes" className="btn btn-primary">
          Track it under Programmes
        </Link>
        <Link href="/" className="btn btn-ghost">
          Back to the Decision Map
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 18, lineHeight: 1.5 }}>
        To see the other side of the handoff, switch to a Regional Decision Maker account in the menu at the top
        right — the directive is waiting there.
      </p>
    </div>
  );
}
