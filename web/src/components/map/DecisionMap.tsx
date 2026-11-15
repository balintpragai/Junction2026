"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FINLAND_CENTROIDS, FINLAND_PATHS, FINLAND_VIEWBOX } from "@/lib/finland-paths";
import {
  CAPITAL_AREA,
  GEOMETRY_SLUG,
  HELSINKI,
  KESKI_UUSIMAA,
  SMALL_REGIONS,
  VANTAA_KERAVA,
} from "@/lib/region-codes";
import { makeScale } from "@/lib/sequential";
import { ZoomControl } from "@/components/map/ZoomControl";
import type { Region } from "@/lib/api";

const [BX, BY, BW, BH] = FINLAND_VIEWBOX.split(" ").map(Number);
const MIN_K = 1;
const MAX_K = 9;
/** Past this zoom the Regions are big enough to carry their own labels. */
const LABEL_K = 2.1;
/** Regions whose drawn shape is too small to be a dependable pointer
 *  target at low zoom. */
/* Ordered back-to-front: Helsinki has the smallest real outline of the
   three and is the most often wanted, so it is drawn last and wins any
   overlap. */

/** The capital area: five Regions inside a few map units of each other,
 *  holding about a third of the country's population. At the zoom that
 *  shows all of Finland they are an unreadable knot, which is the whole
 *  reason this shortcut exists. */

interface View {
  x: number;
  y: number;
  k: number;
}

const FIT: View = { x: BX, y: BY, k: 1 };

/** Real Region boundaries (Statistics Finland, see finland-paths.ts), shaded
 *  by whatever magnitude `value()` returns on a sequential ramp -- the same
 *  convention the Cancer Registry's own charts use. Severity/status colors
 *  stay off this map: mixing a sequential and a status scale in one encoding
 *  makes neither readable.
 *
 *  Pan with a drag, zoom with the wheel or the control at the right. The
 *  southern Regions are small and crowded, which is exactly why this map
 *  needs real zoom rather than a static picture. */
export function DecisionMap({
  regions,
  value,
  label,
  unit,
  formatTick,
  selected,
  onSelect,
  height = 560,
}: {
  regions: Region[];
  value: (code: string) => number | null;
  label: (code: string) => string;
  unit: string;
  formatTick?: (v: number) => string;
  selected: string | null;
  onSelect: (code: string) => void;
  height?: number | string;
}) {
  const [view, setView] = useState<View>(FIT);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragFrom = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  const { scale, min, max } = useMemo(() => {
    const values = regions.map((r) => value(r.code)).filter((v): v is number => v != null);
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    return { scale: makeScale(lo, hi), min: lo, max: hi };
  }, [regions, value]);

  const vw = BW / view.k;
  const vh = BH / view.k;

  /** Keep the viewport inside the map: panning past the edge just shows
   *  empty background and feels broken. */
  const clamp = useCallback((v: View): View => {
    const w = BW / v.k;
    const h = BH / v.k;
    return {
      k: v.k,
      x: Math.max(BX, Math.min(BX + BW - w, v.x)),
      y: Math.max(BY, Math.min(BY + BH - h, v.y)),
    };
  }, []);

  /** Zoom about a point in map coordinates, so the thing under the cursor
   *  stays under the cursor. */
  const zoomTo = useCallback(
    (nextK: number, focus?: { x: number; y: number }) => {
      setView((v) => {
        const k = Math.max(MIN_K, Math.min(MAX_K, nextK));
        const fx = focus?.x ?? v.x + BW / v.k / 2;
        const fy = focus?.y ?? v.y + BH / v.k / 2;
        const ratio = v.k / k;
        return clamp({ k, x: fx - (fx - v.x) * ratio, y: fy - (fy - v.y) * ratio });
      });
    },
    [clamp],
  );

  /** Screen point -> map point, via the SVG's own coordinate transform so it
   *  stays correct at any CSS size. */
  const toMap = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { rx: (clientX - rect.left) / rect.width, ry: (clientY - rect.top) / rect.height };
  }, []);

  function onWheel(e: React.WheelEvent) {
    const p = toMap(e.clientX, e.clientY);
    if (!p) return;
    const focus = { x: view.x + p.rx * vw, y: view.y + p.ry * vh };
    zoomTo(view.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18), focus);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    // Deliberately NOT capturing the pointer here. Capturing on pointerdown
    // retargets the subsequent click event to the capturing element, so
    // every click landed on the <svg> instead of the Region path under the
    // cursor and selecting a Region silently did nothing. Capture is taken
    // below, only once a real drag begins.
    dragFrom.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const from = dragFrom.current;
    if (!from) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - from.px) / rect.width) * vw;
    const dy = ((e.clientY - from.py) / rect.height) * vh;
    if (!dragging && Math.hypot(e.clientX - from.px, e.clientY - from.py) > 3) {
      setDragging(true);
      // Now that this is a drag and not a click, capture so the pan keeps
      // tracking if the pointer leaves the map.
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Capture can be refused if the pointer is already gone; panning
        // still works inside the element without it.
      }
    }
    setView((v) => clamp({ ...v, x: from.vx - dx, y: from.vy - dy }));
  }

  function endDrag(e: React.PointerEvent) {
    dragFrom.current = null;
    // Cleared on the next frame so the click that ends a drag doesn't also
    // select whatever Region the pointer happens to be over.
    if (dragging) requestAnimationFrame(() => setDragging(false));
    const el = e.currentTarget as Element;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  /** Frame one Region — used by the control's "focus selection" and by a
   *  double-click on the Region itself. */
  /** Frame a set of Regions: fit their centroids plus a margin, so the
   *  result holds the whole cluster rather than cropping its edges. */
  const frameRegions = useCallback(
    (codes: string[], pad = 7) => {
      const svg = svgRef.current;
      if (!svg) return;

      // Union the Regions' real drawn extents. Centroids are a poor proxy:
      // West Uusimaa's shape reaches far further west than its centre, so
      // fitting centroids leaves the cluster small and off to one side.
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const code of codes) {
        const el = svg.querySelector<SVGGraphicsElement>(`[data-code="${code}"]`);
        if (!el) continue;
        const bb = el.getBBox();
        x0 = Math.min(x0, bb.x);
        y0 = Math.min(y0, bb.y);
        x1 = Math.max(x1, bb.x + bb.width);
        y1 = Math.max(y1, bb.y + bb.height);
      }
      if (!Number.isFinite(x0)) return;

      const w = x1 - x0 + pad * 2;
      const h = y1 - y0 + pad * 2;

      // The viewBox is portrait and the pane is usually landscape, so
      // preserveAspectRatio letterboxes and the area actually on screen is
      // wider than the viewBox. Fitting against BW/BH therefore zooms out
      // far too much. Solve against what is really visible instead.
      const rect = svg.getBoundingClientRect();
      const paneAspect = rect.height > 0 ? rect.width / rect.height : BW / BH;
      const fit =
        paneAspect > BW / BH
          ? Math.min(BH / h, (BH * paneAspect) / w) // height binds
          : Math.min(BW / w, BW / (h * paneAspect)); // width binds

      const k = Math.max(MIN_K, Math.min(MAX_K, fit));
      setView(clamp({ k, x: (x0 + x1) / 2 - BW / k / 2, y: (y0 + y1) / 2 - BH / k / 2 }));
    },
    [clamp],
  );

  const frameRegion = useCallback(
    (code: string) => {
      // A city-sized Region needs breathing room around it to read as part
      // of a country; a county already fills the frame.
      const tight = code === HELSINKI || code === VANTAA_KERAVA || code === KESKI_UUSIMAA;
      frameRegions([code], tight ? 26 : 10);
    },
    [frameRegions],
  );

  // Keyboard: the map is a real control, so it answers to arrows and +/-.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!svgRef.current?.contains(document.activeElement)) return;
      const step = vw * 0.15;
      if (e.key === "ArrowLeft") setView((v) => clamp({ ...v, x: v.x - step }));
      else if (e.key === "ArrowRight") setView((v) => clamp({ ...v, x: v.x + step }));
      else if (e.key === "ArrowUp") setView((v) => clamp({ ...v, y: v.y - step }));
      else if (e.key === "ArrowDown") setView((v) => clamp({ ...v, y: v.y + step }));
      else if (e.key === "+" || e.key === "=") zoomTo(view.k * 1.3);
      else if (e.key === "-") zoomTo(view.k / 1.3);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vw, view.k, clamp, zoomTo]);

  const hovered = hover ? regions.find((r) => r.code === hover.code) : null;
  const showLabels = view.k >= LABEL_K;

  return (
    <div
      className="map-frame"
      style={{ position: "relative", height, borderRadius: 12, overflow: "hidden", background: "var(--bg-sunk)" }}
    >
      <style>{`@media (max-width: 1080px) { .map-frame { height: 380px !important; } }`}</style>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
        role="application"
        aria-label="Map of Finland's 23 Regions. Click a Region for its profile; drag to pan, scroll to zoom."
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
          outline: "none",
        }}
      >
        <rect x={BX} y={BY} width={BW} height={BH} fill="var(--bg-sunk)" />

        {regions.map((region) => {
          const d = FINLAND_PATHS[GEOMETRY_SLUG[region.code]];
          if (!d) return null;
          const v = value(region.code);
          const isSelected = selected === region.code;
          const isHover = hover?.code === region.code;
          return (
            <path
              key={region.code}
              data-code={region.code}
              className="map-region"
              tabIndex={0}
              role="button"
              aria-label={label(region.code)}
              aria-pressed={isSelected}
              d={d}
              fill={v != null ? scale(v) : "var(--line)"}
              stroke={isSelected ? "var(--ink)" : isHover ? "var(--ink-2)" : "var(--card)"}
              strokeWidth={(isSelected ? 2.4 : isHover ? 1.6 : 0.9) / view.k}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ cursor: "pointer", outline: "none" }}
              onPointerEnter={(e) => setHover({ code: region.code, x: e.clientX, y: e.clientY })}
              onPointerMove={(e) => setHover({ code: region.code, x: e.clientX, y: e.clientY })}
              onClick={() => {
                if (!dragging) onSelect(region.code);
              }}
              onDoubleClick={() => frameRegion(region.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(region.code);
                }
              }}
            />
          );
        })}

        {/* The capital-area Regions are cities, not counties: their real
            outlines are correct but only a few pixels across when zoomed
            out. An invisible circle keeps each reliably clickable, and
            shrinks away once the shapes themselves are big enough to hit. */}
        {view.k < 4 &&
          SMALL_REGIONS.map((code) => {
            const c = FINLAND_CENTROIDS[GEOMETRY_SLUG[code]];
            if (!c || !regions.some((r) => r.code === code)) return null;
            return (
              <circle
                key={`hit-${code}`}
                cx={c[0]}
                cy={c[1]}
                r={6 / view.k}
                fill="transparent"
                aria-hidden="true"
                style={{ cursor: "pointer" }}
                onPointerEnter={(e) => setHover({ code, x: e.clientX, y: e.clientY })}
                onClick={() => {
                  if (!dragging) onSelect(code);
                }}
              />
            );
          })}

        {showLabels &&
          regions.map((region) => {
            const c = FINLAND_CENTROIDS[GEOMETRY_SLUG[region.code]];
            if (!c) return null;
            const v = value(region.code);
            const short = shortName(region.name);
            return (
              <g key={`l-${region.code}`} pointerEvents="none" transform={`translate(${c[0]} ${c[1]})`}>
                <text
                  textAnchor="middle"
                  style={{
                    fontSize: 11 / view.k,
                    fontFamily: "var(--font-body)",
                    fontWeight: 650,
                    fill: "var(--ink)",
                    paintOrder: "stroke",
                    stroke: "var(--card)",
                    strokeWidth: 3 / view.k,
                    strokeLinejoin: "round",
                  }}
                >
                  {short}
                </text>
                {v != null && (
                  <text
                    y={11 / view.k}
                    textAnchor="middle"
                    style={{
                      fontSize: 9.5 / view.k,
                      fontVariantNumeric: "tabular-nums",
                      fill: "var(--ink-2)",
                      paintOrder: "stroke",
                      stroke: "var(--card)",
                      strokeWidth: 3 / view.k,
                      strokeLinejoin: "round",
                    }}
                  >
                    {(formatTick ?? ((n: number) => n.toFixed(1)))(v)}
                  </text>
                )}
              </g>
            );
          })}
      </svg>

      {hovered && !dragging && (
        <Tooltip x={hover!.x} y={hover!.y} text={label(hovered.code)} />
      )}

      {/* The capital area is a knot at full-country zoom, so it gets a
          shortcut rather than asking for three wheel gestures. It sits on
          the map because that is what it acts on. */}
      <button
        onClick={() => frameRegions(CAPITAL_AREA)}
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          minHeight: 30,
          padding: "6px 11px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "rgba(255, 255, 255, 0.93)",
          backdropFilter: "blur(6px)",
          fontSize: 12.5,
          fontWeight: 550,
          color: "var(--ink)",
          cursor: "pointer",
          boxShadow: "var(--shadow-card)",
        }}
      >
        Helsinki and region
      </button>

      <div style={{ position: "absolute", top: 14, right: 14 }}>
        <ZoomControl
          k={view.k}
          min={MIN_K}
          max={MAX_K}
          onZoom={(k) => zoomTo(k)}
          onFit={() => setView(FIT)}
          onFocus={selected ? () => frameRegion(selected) : undefined}
        />
      </div>

      <div style={{ position: "absolute", left: 14, bottom: 14 }}>
        <Legend min={min} max={max} unit={unit} format={formatTick ?? ((v) => v.toFixed(1))} />
      </div>

      <p
        className="map-hint"
        style={{
          position: "absolute",
          right: 14,
          bottom: 12,
          fontSize: 11,
          color: "var(--ink-3)",
          background: "rgba(255,255,255,0.82)",
          padding: "3px 9px",
          borderRadius: 6,
          pointerEvents: "none",
        }}
      >
        Drag to pan, scroll to zoom, double-click to frame a Region
      </p>

      <style>{`
        @media (max-width: 720px) {
          .map-hint { display: none; }
        }
      `}</style>
    </div>
  );
}

/** "Southwest Finland wellbeing services county" won't fit on a Region at
 *  any zoom; the distinguishing part always comes first. */
function shortName(name: string): string {
  return name
    .replace(/ wellbeing services county$/, "")
    .replace(/^City of /, "");
}

function Tooltip({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: x + 14,
        top: y + 14,
        zIndex: 40,
        maxWidth: 260,
        background: "var(--ink)",
        color: "var(--card)",
        borderRadius: 8,
        padding: "7px 11px",
        fontSize: 12.5,
        lineHeight: 1.4,
        pointerEvents: "none",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {text}
    </div>
  );
}

function Legend({ min, max, unit, format }: { min: number; max: number; unit: string; format: (v: number) => string }) {
  // A small integer range (e.g. "0..4 indicators") gets one tick per integer
  // instead of 5 evenly-spaced floats that can round to the same label twice.
  const isSmallIntegerRange = Number.isInteger(min) && Number.isInteger(max) && max - min <= 6 && max - min >= 1;
  const raw = isSmallIntegerRange
    ? Array.from({ length: max - min + 1 }, (_, i) => max - i)
    : Array.from({ length: 5 }, (_, i) => max - ((max - min) / 4) * i);
  const seen = new Set<string>();
  const values = raw.filter((v) => {
    const l = format(v);
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 7, maxWidth: 118, lineHeight: 1.3 }}>
        {unit.charAt(0).toUpperCase() + unit.slice(1)}
      </p>
      <div style={{ display: "flex", gap: 10 }}>
      <div
        aria-hidden="true"
        style={{
          width: 14,
          height: 112,
          borderRadius: 4,
          background: "linear-gradient(to top, #feebe2, #fbb4b9, #f768a1, #c51b8a, #7a0177)",
          border: "1px solid var(--line)",
          flex: "none",
        }}
      />
      <div className="col" style={{ justifyContent: "space-between", height: 112 }}>
        {values.map((v, i) => (
          <span key={i} className="tnum" style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1 }}>
            {format(v)}
          </span>
        ))}
      </div>
      </div>
    </div>
  );
}
