import { loadOverview, loadRegions } from "@/lib/api";
import { OverviewMap } from "@/components/OverviewMap";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [regionList, overview] = await Promise.all([loadRegions(), loadOverview()]);
  const regions = regionList?.regions ?? [];
  const rows = overview?.rows ?? [];

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Overview
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>Where cancer care falls short of target</h1>
      </header>

      {regions.length === 0 || rows.length === 0 ? (
        <p style={{ color: "var(--act)" }}>
          Could not reach the API. Check that the backend is running and <code>API_URL</code> is set.
        </p>
      ) : (
        <OverviewMap regions={regions} rows={rows} />
      )}
    </div>
  );
}
