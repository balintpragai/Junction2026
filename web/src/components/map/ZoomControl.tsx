"use client";

/** The map's zoom instrument. A slider rather than only +/- buttons, because
 *  the useful range here is wide (all of Finland down to a single city) and
 *  stepping through it a click at a time is tedious. The track is vertical
 *  and reads like a zoom scale: wide at the bottom, tight at the top. */
export function ZoomControl({
  k,
  min,
  max,
  onZoom,
  onFit,
  onFocus,
}: {
  k: number;
  min: number;
  max: number;
  onZoom: (k: number) => void;
  onFit: () => void;
  onFocus?: () => void;
}) {
  // The slider is linear in log(k) so each pixel is the same proportional
  // change — a linear k makes the low end useless and the high end twitchy.
  const t = (Math.log(k) - Math.log(min)) / (Math.log(max) - Math.log(min));
  const fromT = (v: number) => Math.exp(Math.log(min) + v * (Math.log(max) - Math.log(min)));

  return (
    <div
      className="col"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 6,
        gap: 4,
        alignItems: "center",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <IconButton label="Zoom in" onClick={() => onZoom(k * 1.45)} disabled={k >= max - 0.001}>
        <path d="M8 4.5v7M4.5 8h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </IconButton>

      <div style={{ position: "relative", height: 96, width: 22, display: "grid", placeItems: "center" }}>
        {/* The visible track; the real <input> sits on top of it, rotated and
            transparent, so this stays a native, keyboard-operable slider. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", width: 4, height: 96, borderRadius: 999, background: "var(--line)" }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            width: 4,
            height: `${Math.max(0, Math.min(1, t)) * 96}px`,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: `calc(${Math.max(0, Math.min(1, t)) * 96}px - 6px)`,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "var(--card)",
            border: "2px solid var(--accent)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={Math.max(0, Math.min(1, t))}
          onChange={(e) => onZoom(fromT(Number(e.target.value)))}
          aria-label={`Zoom level, ${k.toFixed(1)} times`}
          style={{
            position: "absolute",
            width: 96,
            height: 22,
            transform: "rotate(-90deg)",
            opacity: 0,
            cursor: "ns-resize",
            margin: 0,
          }}
        />
      </div>

      <IconButton label="Zoom out" onClick={() => onZoom(k / 1.45)} disabled={k <= min + 0.001}>
        <path d="M4.5 8h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </IconButton>

      <span
        className="mono"
        aria-hidden="true"
        style={{ fontSize: 9.5, color: "var(--ink-3)", padding: "1px 0", borderTop: "1px solid var(--line)", width: "100%", textAlign: "center" }}
      >
        {k.toFixed(1)}×
      </span>

      <IconButton label="Fit all of Finland" onClick={onFit} disabled={k <= min + 0.001}>
        <path
          d="M4 6.2V4h2.2M9.8 4H12v2.2M12 9.8V12H9.8M6.2 12H4V9.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </IconButton>

      {onFocus && (
        <IconButton label="Zoom to the selected Region" onClick={onFocus}>
          <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: 7,
        background: "transparent",
        color: disabled ? "var(--line-strong)" : "var(--ink-2)",
        cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--bg-sunk)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
