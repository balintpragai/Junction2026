"use client";

import { useMemo, useState } from "react";
import type { CandidateAction } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { actionTitle, actionDescription } from "@/lib/actions-fi";

const MAX_RESULTS = 7;

/** The planner's palette: the Region's recommended actions without typing,
 *  and the whole National Cancer Strategy behind a search box — so a
 *  decision maker is never limited to what the engine matched. */
export function ActionSearch({
  recommended,
  library,
  addedIds,
  onAdd,
}: {
  recommended: CandidateAction[];
  library: CandidateAction[];
  addedIds: Set<string>;
  onAdd: (action: CandidateAction) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: CandidateAction[] = [];
    for (const a of [...recommended, ...library]) {
      if (seen.has(a.id)) continue;
      const haystack = `${a.title} ${a.description} ${actionTitle(a, "fi")} ${actionDescription(a, "fi")}`;
      if (haystack.toLowerCase().includes(q)) {
        seen.add(a.id);
        out.push(a);
      }
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }, [query, recommended, library]);

  const { lang, t, tf } = useLang();

  return (
    <div className="card" style={{ padding: "13px 15px" }}>
      <label htmlFor="action-search" style={{ display: "block", marginBottom: 8, fontSize: 12.5, fontWeight: 600 }}>
        {t("Add an action")}
      </label>
      <input
        id="action-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tf("Search {n} strategy actions", { n: library.length })}
        aria-label={tf("Search all {n} National Cancer Strategy actions", { n: library.length })}
        style={{ width: "100%", fontSize: 13 }}
      />

      {query.trim() ? (
        <div className="col scroll-y" style={{ marginTop: 11, gap: 6, maxHeight: 340 }}>
          {results.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{tf("No action matches “{query}”.", { query })}</p>
          )}
          {results.map((a) => (
            <Row key={a.id} action={a} added={addedIds.has(a.id)} onAdd={() => onAdd(a)} />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 11 }}>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 8, lineHeight: 1.45 }}>
            {t("Recommended here, matched to this Region’s own Gaps:")}
          </p>
          <div className="col scroll-y" style={{ gap: 6, maxHeight: 290, paddingRight: 2 }}>
            {recommended.map((a) => (
              <Row key={a.id} action={a} added={addedIds.has(a.id)} onAdd={() => onAdd(a)} compact />
            ))}
            {recommended.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                {t("No Gap in this Region triggered a recommendation — search the strategy above to add one anyway.")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  action,
  added,
  onAdd,
  compact,
}: {
  action: CandidateAction;
  added: boolean;
  onAdd: () => void;
  compact?: boolean;
}) {
  const { lang, t, tf } = useLang();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "9px 10px",
        borderRadius: 9,
        background: added ? "var(--good-soft)" : "var(--bg)",
        border: `1px solid ${added ? "var(--good-line)" : "var(--line)"}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.35 }}>{actionTitle(action, lang)}</p>
        <p className={compact ? "clamp-2" : "clamp-3"} style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.4 }}>
          {actionDescription(action, lang)}
        </p>
        {action.recommended && (
          <span className="tag tag-accent" style={{ marginTop: 6 }}>
            {t("recommended")}
          </span>
        )}
      </div>
      <button
        onClick={onAdd}
        disabled={added}
        aria-label={tf(added ? "{title} is in the plan" : "Add {title}", { title: actionTitle(action, lang) })}
        className="btn btn-sm"
        style={{
          flex: "none",
          background: added ? "transparent" : "var(--ink)",
          color: added ? "var(--good)" : "var(--card)",
          padding: "5px 11px",
        }}
      >
        {added ? "✓" : t("Add")}
      </button>
    </div>
  );
}
