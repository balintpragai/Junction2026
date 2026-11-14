import { loadAllGapSummaries, loadRegions } from "@/lib/api";
import { DecisionMakerView } from "@/components/DecisionMakerView";

export const dynamic = "force-dynamic";

const INDICATOR = "3621";
const YEAR = 2024;
const DEFAULT_REGION = "helsinki";

export default async function Home() {
  const regionList = await loadRegions();
  const regions = regionList?.regions ?? [];
  const summaries = regions.length ? await loadAllGapSummaries(regions, INDICATOR, YEAR) : new Map();
  const indicator = summaries.values().next().value?.indicator;

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Decision-maker view
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>Where cancer care falls short of target</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "64ch" }}>
          Real data from THL Sotkanet and the Finnish Cancer Registry, scored against the National Cancer Strategy&rsquo;s own
          targets. Click any Region for the full picture.
        </p>
      </header>

      {regions.length === 0 || !indicator ? (
        <p style={{ color: "var(--act)" }}>
          Could not reach the API. Check that the <code>api</code> service is running and <code>API_URL</code> is set.
        </p>
      ) : (
        <DecisionMakerView regions={regions} indicator={indicator} summaries={summaries} defaultCode={DEFAULT_REGION} />
      )}
    </div>
  );
}
