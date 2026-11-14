"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CandidateAction, Region, RegionProfile } from "@/lib/api";
import { buildPlaybook, criticalPathDays, uniqueCounterparties, allSteps } from "@/lib/playbook";
import { newDirective, useProgram, type Priority } from "@/lib/program";
import { regionalAccountFor } from "@/lib/roles";
import { SequenceView } from "@/components/sequence/SequenceView";
import { ActionSearch } from "@/components/planner/ActionSearch";

type Stage = "build" | "review" | "issued";

const PRIORITY_LABEL: Record<Priority, string> = {
  routine: "Routine — next planning cycle",
  high: "High — this quarter",
  urgent: "Urgent — immediate response required",
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
  const [stage, setStage] = useState<Stage>("build");
  const [priority, setPriority] = useState<Priority>("high");
  const [mandate, setMandate] = useState("");

  const planIds = useMemo(() => new Set(plan.map((a) => a.id)), [plan]);
  const focus = plan.find((a) => a.id === focusId) ?? plan[0] ?? null;
  const focusPhases = useMemo(() => (focus ? buildPlaybook(focus, region.name) : []), [focus, region.name]);

  const totals = useMemo(() => {
    const parties = new Set<string>();
    let steps = 0;
    let days = 0;
    for (const a of plan) {
      const phases = buildPlaybook(a, region.name);
      steps += allSteps(phases).length;
      days = Math.max(days, criticalPathDays(phases));
      for (const c of uniqueCounterparties(phases)) parties.add(c.name);
    }
    return { steps, days, parties: parties.size };
  }, [plan, region.name]);

  const worstGap = profile.gaps.find((g) => g.gap.severity === "act") ?? profile.gaps[0];
  // Splicing the action's own title into a sentence reads badly — strategy
  // titles are themselves full sentences. The default states the outcome and
  // leaves the method to the actions attached to it.
  const defaultMandate =
    `Close the Gap addressed by ${plan.length === 1 ? "this action" : `these ${plan.length} actions`} in ${region.name}, ` +
    `and report measured movement against the national target within the current screening round.`;
  const recipient = regionalAccountFor(region.code);

  function add(action: CandidateAction) {
    setPlan((prev) => (prev.some((a) => a.id === action.id) ? prev : [...prev, action]));
    setFocusId(action.id);
    setStage("build");
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
    return <IssuedConfirmation region={region} count={plan.length} recipientName={recipient?.name} />;
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <Stages stage={stage} canReview={plan.length > 0} onStage={setStage} />

      {stage === "build" ? (
        <div
          className="planner-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 20, alignItems: "flex-start" }}
        >
          <div className="col" style={{ gap: 14, position: "sticky", top: 78 }}>
            <ActionSearch recommended={recommended} library={library} addedIds={planIds} onAdd={add} />

            <div className="card" style={{ padding: "13px 15px" }}>
              <p className="section-title" style={{ marginBottom: 10 }}>
                In this plan ({plan.length})
              </p>
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
                            {buildPlaybook(a, region.name).reduce((n, p) => n + p.steps.length, 0)} steps ·{" "}
                            {criticalPathDays(buildPlaybook(a, region.name))}d
                          </span>
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          aria-label={`Remove ${a.title}`}
                          title="Remove"
                          style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0, flex: "none" }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 13 }}
                disabled={plan.length === 0}
                onClick={() => setStage("review")}
              >
                Review &amp; issue {plan.length > 0 ? `(${plan.length})` : ""}
              </button>
            </div>
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
                  <h3 style={{ fontSize: "1.25rem", marginTop: 10 }}>{focus.title}</h3>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 7, lineHeight: 1.6, maxWidth: "74ch" }}>
                    {focus.description}
                  </p>
                  <details className="sunk" style={{ padding: "10px 13px", marginTop: 11 }}>
                    <summary style={{ fontSize: 12, fontWeight: 650, cursor: "pointer", color: "var(--ink-2)" }}>
                      Why this action, for this Region ▾
                    </summary>
                    <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>{focus.why}</p>
                  </details>
                </header>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 15 }}>
                  <p className="section-title" style={{ marginBottom: 4 }}>
                    What this sets in motion
                  </p>
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
      ) : (
        <ReviewStage
          region={region}
          plan={plan}
          totals={totals}
          priority={priority}
          setPriority={setPriority}
          mandate={mandate}
          setMandate={setMandate}
          defaultMandate={defaultMandate}
          recipientName={recipient?.name}
          recipientOrg={recipient?.org}
          onBack={() => setStage("build")}
          onIssue={issuePlan}
        />
      )}

      <style>{`
        @media (max-width: 1040px) {
          .planner-grid { grid-template-columns: 1fr !important; }
          .planner-grid > div:first-child { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function Stages({ stage, canReview, onStage }: { stage: Stage; canReview: boolean; onStage: (s: Stage) => void }) {
  const items: { id: Stage; label: string; hint: string }[] = [
    { id: "build", label: "Build the plan", hint: "Choose actions and read what each one triggers" },
    { id: "review", label: "Review & issue", hint: "Confirm the mandate and hand it to the Region" },
  ];
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {items.map((item, i) => {
        const active = stage === item.id;
        const enabled = item.id === "build" || canReview;
        return (
          <button
            key={item.id}
            onClick={() => enabled && onStage(item.id)}
            disabled={!enabled}
            className="card"
            style={{
              flex: "1 1 240px",
              textAlign: "left",
              padding: "10px 14px",
              cursor: enabled ? "pointer" : "not-allowed",
              opacity: enabled ? 1 : 0.5,
              borderColor: active ? "var(--accent)" : "var(--line)",
              background: active ? "var(--accent-soft)" : "var(--card)",
            }}
          >
            <span className="row" style={{ gap: 8 }}>
              <span
                className="mono"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: active ? "var(--accent)" : "var(--bg-sunk)",
                  color: active ? "#fff" : "var(--ink-3)",
                  flex: "none",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: 650 }}>{item.label}</span>
            </span>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)", display: "block", marginTop: 3, marginLeft: 28 }}>
              {item.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewStage({
  region,
  plan,
  totals,
  priority,
  setPriority,
  mandate,
  setMandate,
  defaultMandate,
  recipientName,
  recipientOrg,
  onBack,
  onIssue,
}: {
  region: Region;
  plan: CandidateAction[];
  totals: { steps: number; days: number; parties: number };
  priority: Priority;
  setPriority: (p: Priority) => void;
  mandate: string;
  setMandate: (s: string) => void;
  defaultMandate: string;
  recipientName?: string;
  recipientOrg?: string;
  onBack: () => void;
  onIssue: () => void;
}) {
  return (
    <div className="review-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)", gap: 20, alignItems: "flex-start" }}>
      <div className="card-lg" style={{ padding: 22 }}>
        <p className="eyebrow">Step 2</p>
        <h3 style={{ fontSize: "1.3rem", marginTop: 7 }}>What you are about to issue</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6, maxWidth: "70ch" }}>
          Issuing hands these actions to {region.name}. You will not see work happen immediately — the Region has to
          assign each step to its own people and work out the detail. What comes back to you is reported progress.
        </p>

        <div style={{ marginTop: 20 }}>
          <label htmlFor="mandate" className="section-title" style={{ display: "block", marginBottom: 7 }}>
            The instruction
          </label>
          <textarea
            id="mandate"
            value={mandate}
            onChange={(e) => setMandate(e.target.value)}
            placeholder={defaultMandate}
            rows={3}
            style={{
              width: "100%",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 13.5,
              fontFamily: "inherit",
              lineHeight: 1.55,
              color: "var(--ink)",
              resize: "vertical",
            }}
          />
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 5 }}>
            Left blank, the default above is used. State the outcome and the deadline, not the method — the method is
            the Region&rsquo;s to choose.
          </p>
        </div>

        <div style={{ marginTop: 18 }}>
          <p className="section-title" style={{ marginBottom: 7 }}>
            Priority
          </p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {(["routine", "high", "urgent"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="btn btn-sm"
                style={{
                  background: priority === p ? "var(--ink)" : "var(--card)",
                  color: priority === p ? "var(--card)" : "var(--ink-2)",
                  border: `1px solid ${priority === p ? "var(--ink)" : "var(--line-strong)"}`,
                }}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <p className="section-title" style={{ marginBottom: 10 }}>
            The {plan.length} action{plan.length > 1 ? "s" : ""}
          </p>
          <div className="col" style={{ gap: 9 }}>
            {plan.map((a) => {
              const phases = buildPlaybook(a, region.name);
              return (
                <div key={a.id} className="sunk" style={{ padding: "11px 13px" }}>
                  <p style={{ fontSize: 13, fontWeight: 650 }}>{a.title}</p>
                  <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>
                    {allSteps(phases).length} steps · {criticalPathDays(phases)} working days ·{" "}
                    {uniqueCounterparties(phases).length} bodies involved
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 14, position: "sticky", top: 78 }}>
        <div className="card-lg" style={{ padding: 18 }}>
          <p className="section-title" style={{ marginBottom: 11 }}>
            Lands on
          </p>
          {recipientName ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{recipientName}</p>
              <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{recipientOrg}</p>
              <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 9, lineHeight: 1.5 }}>
                They are notified immediately and own every step from there. Their response window is set by the
                priority above.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--watch)", lineHeight: 1.5 }}>
              No Regional Decision Maker account is registered for {region.name} in this demo. The directive is still
              issued and will appear for that Region once an account exists.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 15 }}>
            <Mini value={String(totals.steps)} label="steps created" />
            <Mini value={`${totals.days}d`} label="critical path" />
            <Mini value={String(totals.parties)} label="bodies notified" />
            <Mini value={String(plan.length)} label="directives" />
          </div>

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={onIssue} disabled={plan.length === 0}>
            Issue to {region.name.replace(/ wellbeing services county$/, "")}
          </button>
          <button className="btn btn-quiet btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={onBack}>
            Back to the plan
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px) {
          .review-grid { grid-template-columns: 1fr !important; }
          .review-grid > div:last-of-type { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="sunk" style={{ padding: "8px 10px" }}>
      <p className="mono" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

function IssuedConfirmation({ region, count, recipientName }: { region: Region; count: number; recipientName?: string }) {
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
        {recipientName ? `${recipientName} has been notified.` : "The Region has been notified."} Nothing is in motion
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
