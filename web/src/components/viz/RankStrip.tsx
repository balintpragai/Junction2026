"use client";

import { useState } from "react";
import type { RegionProfile } from "@/lib/api";
import { formatValue } from "@/lib/viz";

/** Where this Region sits among all 23, one indicator per row.
 *
 *  The radar answers "what shape is this Region?"; this answers "is the
 *  whole country like that, or just us?" -- a question a radar structurally
 *  cannot, because it only ever draws two shapes. Every Region is a dot, so
 *  a tight cluster with one outlier and a wide even spread look different,
 *  which is the distinction that decides whether a Gap is a local problem
 *  or a national one. */
export function RankStrip({
  profile,
  all,
  onPick,
}: {
  profile: RegionProfile;
  all: Map<string, RegionProfile>;
  onPick?: (code: string) => void;
}) {
  const [hover, setHover] = useState<{ indicator: string; code: string } | null>(null);

  return (
    <div className="col" style={{ gap: 20 }} role="group" aria-label={`${profile.region.name} against every other Region, indicator by indicator`}>
      {profile.gaps.map((entry) => {
        const code = entry.indicator.code;
        const higher = entry.indicator.higher_is_better;

        const points: { code: string; name: string; value: number }[] = [];
        for (const p of all.values()) {
          const g = p.gaps.find((x) => x.indicator.code === code);
          if (g) points.push({ code: p.region.code, name: p.region.name, value: g.gap.value });
        }
        if (points.length === 0) return null;

        const lo = Math.min(...points.map((p) => p.value));
        const hi = Math.max(...points.map((p) => p.value));
        const span = hi - lo || 1;
        // Always plotted worse -> better, left to right, whichever direction
        // the indicator runs. Otherwise "further right" means two different
        // things on two rows of the same chart.
        const pos = (v: number) => ((higher ? v - lo : hi - v) / span) * 100;

        const target = entry.indicator.target;
        const self = entry.gap.value;
        const tone =
          entry.gap.severity === "act" ? "var(--act)" : entry.gap.severity === "watch" ? "var(--watch)" : "var(--good)";

        return (
          <div
            key={code}
            style={{
              paddingBottom: 16,
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 5, gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 650 }}>{entry.indicator.name}</span>
              <span className="row" style={{ gap: 8, flex: "none" }}>
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>
                  {formatValue(self, entry.indicator.unit)}
                </span>
                <span className="tnum" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  #{entry.gap.rank}/{entry.gap.n_regions}
                </span>
              </span>
            </div>

            <div style={{ position: "relative", height: 30 }}>
              {/* the axis */}
              <div
                style={{
                  position: "absolute",
                  top: 13,
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 999,
                  background: "linear-gradient(to right, var(--act-soft), var(--bg-sunk) 50%, var(--good-soft))",
                }}
              />

              {/* the target, where one exists */}
              {target != null && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.max(0, Math.min(100, pos(target)))}%`,
                    top: 4,
                    width: 2,
                    height: 22,
                    background: "var(--ink)",
                    transform: "translateX(-1px)",
                  }}
                  title={`Target: ${formatValue(target, entry.indicator.unit)}`}
                />
              )}

              {/* every other Region */}
              {points
                .filter((p) => p.code !== profile.region.code)
                .map((p) => {
                  const on = hover?.indicator === code && hover.code === p.code;
                  return (
                    <button
                      key={p.code}
                      tabIndex={-1}
                      onClick={() => onPick?.(p.code)}
                      onMouseEnter={() => setHover({ indicator: code, code: p.code })}
                      onMouseLeave={() => setHover(null)}
                      aria-label={`${p.name}: ${formatValue(p.value, entry.indicator.unit)}`}
                      style={{
                        position: "absolute",
                        left: `${pos(p.value)}%`,
                        top: 9,
                        width: 12,
                        height: 12,
                        marginLeft: -6,
                        padding: 0,
                        border: "2px solid var(--card)",
                        borderRadius: 999,
                        background: on ? "var(--ink-2)" : "var(--line-strong)",
                        cursor: onPick ? "pointer" : "default",
                        zIndex: on ? 3 : 1,
                      }}
                      title={`${p.name}: ${formatValue(p.value, entry.indicator.unit)}`}
                    />
                  );
                })}

              {/* this Region, on top and unmistakable */}
              <div
                style={{
                  position: "absolute",
                  left: `${pos(self)}%`,
                  top: 5,
                  width: 20,
                  height: 20,
                  marginLeft: -10,
                  borderRadius: 999,
                  background: tone,
                  border: "2.5px solid var(--card)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
                  zIndex: 4,
                }}
                title={`${profile.region.name}: ${formatValue(self, entry.indicator.unit)}`}
              />
            </div>

            <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 6 }}>
              {entry.narrative.text}
            </p>
            {entry.data_quality_notes.map((note, i) => (
              <p
                key={i}
                style={{
                  fontSize: 11.5,
                  color: "var(--watch)",
                  background: "var(--watch-soft)",
                  borderRadius: 6,
                  padding: "5px 9px",
                  marginTop: 6,
                }}
              >
                {note.message}
              </p>
            ))}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span className="tnum" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                worst {formatValue(higher ? lo : hi, entry.indicator.unit)}
              </span>
              {hover?.indicator === code && (
                <span style={{ fontSize: 10.5, color: "var(--ink-2)", fontWeight: 600 }}>
                  {points.find((p) => p.code === hover.code)?.name}
                </span>
              )}
              <span className="tnum" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                best {formatValue(higher ? hi : lo, entry.indicator.unit)}
              </span>
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 11, color: "var(--ink-3)", borderTop: "1px solid var(--line)", paddingTop: 9 }}>
        Each dot is one Region, always ordered worst to best left to right. The filled dot is{" "}
        {profile.region.name}; the vertical rule is the national target where the indicator has one. Click any dot to
        open that Region.
      </p>
    </div>
  );
}
