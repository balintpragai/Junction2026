"use client";

import { useMemo, useState } from "react";
import type { CandidateAction } from "@/lib/api";

const MAX_RESULTS = 6;

/** The planner's palette: search every strategy action and the Region's
 *  recommended ones, and drop the chosen one straight onto the canvas.
 *  Recommended actions show without typing, so the common path is one click. */
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
    const pool = [...recommended, ...library];
    const matches: CandidateAction[] = [];
    for (const a of pool) {
      if (seen.has(a.id)) continue;
      const haystack = `${a.title} ${a.description}`.toLowerCase();
      if (haystack.includes(q)) {
        seen.add(a.id);
        matches.push(a);
      }
      if (matches.length >= MAX_RESULTS) break;
    }
    return matches;
  }, [query, recommended, library]);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
      }}
    >
      <label htmlFor="action-search" style={{ display: "block", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)", marginBottom: 8 }}>
        Add an action
      </label>
      <input
        id="action-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${library.length} National Cancer Strategy actions…`}
        style={{
          width: "100%",
          border: "1px solid var(--line-strong)",
          borderRadius: 9,
          padding: "10px 13px",
          fontSize: 14,
          fontFamily: "inherit",
          color: "var(--ink)",
          background: "var(--bg)",
        }}
      />

      {query.trim() ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {results.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-3)" }}>No action matches “{query}”.</p>}
          {results.map((action) => (
            <ResultRow key={action.id} action={action} added={addedIds.has(action.id)} onAdd={() => onAdd(action)} />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 8 }}>
            Recommended for this Region, from its own Gaps:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recommended.map((action) => {
              const added = addedIds.has(action.id);
              return (
                <button
                  key={action.id}
                  onClick={() => onAdd(action)}
                  disabled={added}
                  title={action.title}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    maxWidth: 420,
                    border: `1px solid ${added ? "var(--good-line)" : "var(--brand-line)"}`,
                    background: added ? "var(--good-soft)" : "var(--brand-soft)",
                    color: added ? "var(--good)" : "var(--brand)",
                    borderRadius: 999,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: added ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{added ? "✓" : "+"}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.title}</span>
                </button>
              );
            })}
            {recommended.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
                No Gap in this Region triggered a recommendation — search the strategy above to add one anyway.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ action, added, onAdd }: { action: CandidateAction; added: boolean; onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "9px 11px",
        borderRadius: 9,
        background: added ? "var(--good-soft)" : "var(--bg)",
        border: `1px solid ${added ? "var(--good-line)" : "var(--line)"}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--ink)" }}>{action.title}</span>
          {action.recommended && (
            <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--brand)", background: "var(--brand-soft)", border: "1px solid var(--brand-line)", borderRadius: 999, padding: "1px 7px" }}>
              recommended
            </span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>{action.description}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={added}
        style={{
          flex: "none",
          border: "none",
          borderRadius: 8,
          padding: "7px 13px",
          fontSize: 12.5,
          fontWeight: 650,
          background: added ? "transparent" : "var(--ink)",
          color: added ? "var(--good)" : "var(--card)",
          cursor: added ? "default" : "pointer",
        }}
      >
        {added ? "✓ Added" : "Add"}
      </button>
    </div>
  );
}
