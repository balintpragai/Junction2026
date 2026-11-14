/** Loading states that reserve the space their content will occupy, so
 *  nothing jumps when the data lands. Shown while the Region profiles are
 *  fetched — 23 requests, which is quick locally and is not quick on a
 *  ministry's VPN. */

function Block({ h, w = "100%", r = 10 }: { h: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function MapSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Loading the Decision Map
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <Block h={13} w={110} r={4} />
        <Block h={34} w="min(560px, 80%)" />
        <Block h={48} w="min(680px, 95%)" />
      </div>
      <Block h={58} r={14} />
      <div className="skeleton-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 22, marginTop: 14 }}>
        <Block h={580} r={20} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Block h={28} w={200} r={6} />
          <Block h={150} r={20} />
          <Block h={320} r={20} />
        </div>
      </div>
      <style>{`@media (max-width: 1080px) { .skeleton-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  );
}
