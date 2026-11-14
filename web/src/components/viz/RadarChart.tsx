"use client";

import { useId, useState } from "react";
import { formatValue, type AxisPoint } from "@/lib/viz";

const SIZE = 330;
const CX = SIZE / 2;
const CY = SIZE / 2 + 6;
const R = 104;
/** Spoke labels sit outside the plot, so the viewBox is padded to hold them.
 *  Relying on `overflow: visible` instead lets the surrounding card clip the
 *  left- and right-most labels. */
const PAD_X = 78;
const PAD_Y = 16;
const RINGS = [25, 50, 75, 100];

/** The Region against the national median, across every tracked indicator at
 *  once -- the shape comparison the profile's prose can't give you.
 *
 *  Two series only, both direct-labelled and legended, because a radar with
 *  more lines than that stops being readable. Axes are *position in the
 *  national range* (see lib/viz.ts), and the raw measurement is printed on
 *  hover and in the table below, so the normalisation is never the only
 *  thing on offer. */
export function RadarChart({
  axes,
  regionName,
  showTable = true,
}: {
  axes: AxisPoint[];
  regionName: string;
  showTable?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const id = useId();

  if (axes.length < 3) {
    return <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Not enough tracked indicators to compare shapes.</p>;
  }

  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, score: number) => {
    const r = (score / 100) * R;
    return [CX + Math.cos(angle(i)) * r, CY + Math.sin(angle(i)) * r] as const;
  };
  const poly = (get: (a: AxisPoint) => number) =>
    axes.map((a, i) => point(i, get(a)).join(",")).join(" ");

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>{regionName} against the national median</p>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
          Each spoke is this Region&rsquo;s position in the national range for that indicator — 0 is the weakest of the
          23 Regions, 100 the strongest. Hover a point for the real measurement.
        </p>
      </figcaption>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <svg
          viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + PAD_X * 2} ${SIZE + PAD_Y * 2}`}
          role="img"
          aria-labelledby={`${id}-title`}
          style={{ width: "100%", maxWidth: SIZE + PAD_X, height: "auto", flex: "1 1 290px" }}
        >
          <title id={`${id}-title`}>
            Radar comparing {regionName} with the national median across {n} indicators.
          </title>

          {/* grid */}
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              points={axes.map((_, i) => point(i, ring).join(",")).join(" ")}
              fill="none"
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}
          {axes.map((_, i) => {
            const [x, y] = point(i, 100);
            return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
          })}
          {RINGS.map((ring) => (
            <text
              key={`t-${ring}`}
              x={CX + 3}
              y={CY - (ring / 100) * R - 2}
              className="mono"
              style={{ fontSize: 8.5, fill: "var(--ink-3)" }}
            >
              {ring}
            </text>
          ))}

          {/* national median first, so the Region's own line sits on top */}
          <polygon points={poly((a) => a.medianScore)} fill="rgba(42,120,214,0.10)" stroke="#2a78d6" strokeWidth={2} />
          <polygon points={poly((a) => a.score)} fill="rgba(138,25,96,0.14)" stroke="#8a1960" strokeWidth={2.4} />

          {/* markers: median behind, Region in front, each with a surface ring */}
          {axes.map((a, i) => {
            const [x, y] = point(i, a.medianScore);
            return <circle key={`m-${i}`} cx={x} cy={y} r={4} fill="#2a78d6" stroke="var(--card)" strokeWidth={2} />;
          })}
          {axes.map((a, i) => {
            const [x, y] = point(i, a.score);
            const on = hover === i;
            return (
              <circle
                key={`r-${i}`}
                cx={x}
                cy={y}
                r={on ? 7 : 5}
                fill="#8a1960"
                stroke="var(--card)"
                strokeWidth={2}
                style={{ transition: "r 0.12s ease" }}
              />
            );
          })}

          {/* spoke labels, with the Region's own value direct-labelled */}
          {axes.map((a, i) => {
            const [lx, ly] = point(i, 126);
            const anchor = Math.abs(lx - CX) < 12 ? "middle" : lx > CX ? "start" : "end";
            return (
              <g key={`l-${i}`}>
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  style={{ fontSize: 10.5, fontWeight: 650, fill: "var(--ink)", fontFamily: "var(--font-body)" }}
                >
                  {a.shortName}
                </text>
                <text
                  x={lx}
                  y={ly + 11}
                  textAnchor={anchor}
                  className="mono"
                  style={{ fontSize: 10, fill: hover === i ? "var(--ink)" : "var(--ink-3)" }}
                >
                  {formatValue(a.raw, a.unit)}
                </text>
              </g>
            );
          })}

          {/* generous invisible hit targets, bigger than the markers */}
          {axes.map((a, i) => {
            const [x, y] = point(i, a.score);
            return (
              <circle
                key={`h-${i}`}
                cx={x}
                cy={y}
                r={16}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <title>
                  {a.name}: {formatValue(a.raw, a.unit)} — rank {a.rank} of {a.nRegions}. National median{" "}
                  {formatValue(a.medianRaw, a.unit)}.
                </title>
              </circle>
            );
          })}
        </svg>

        <div className="col" style={{ gap: 10, flex: "0 0 auto", minWidth: 150 }}>
          <LegendRow color="#8a1960" label={regionName} />
          <LegendRow color="#2a78d6" label="National median" />
          {hover != null && (
            <div className="sunk" style={{ padding: "9px 11px", maxWidth: 190 }}>
              <p style={{ fontSize: 11.5, fontWeight: 650 }}>{axes[hover].name}</p>
              <p className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                {formatValue(axes[hover].raw, axes[hover].unit)}
              </p>
              <p style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 3 }}>
                Rank {axes[hover].rank} of {axes[hover].nRegions} · median {formatValue(axes[hover].medianRaw, axes[hover].unit)}
              </p>
            </div>
          )}
        </div>
      </div>

      {showTable && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-quiet btn-sm" onClick={() => setTableOpen((v) => !v)} aria-expanded={tableOpen}>
            {tableOpen ? "Hide" : "Show"} the numbers
          </button>
          {tableOpen && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-3)" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Indicator</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>This Region</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Median</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Rank</th>
                </tr>
              </thead>
              <tbody>
                {axes.map((a) => (
                  <tr key={a.code} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 8px" }}>{a.name}</td>
                    <td className="mono" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 650 }}>
                      {formatValue(a.raw, a.unit)}
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-2)" }}>
                      {formatValue(a.medianRaw, a.unit)}
                    </td>
                    <td className="mono" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-2)" }}>
                      {a.rank}/{a.nRegions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </figure>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <span className="row" style={{ gap: 7 }}>
      <span aria-hidden="true" style={{ width: 14, height: 3, borderRadius: 2, background: color, flex: "none" }} />
      <span style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.3 }}>{label}</span>
    </span>
  );
}
