import { loadAllRegionProfiles, loadRegions } from "@/lib/api";
import { Explorer } from "@/components/Explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const regionList = await loadRegions();
  const regions = regionList?.regions ?? [];
  const profiles = regions.length ? await loadAllRegionProfiles(regions) : new Map();

  if (regions.length === 0 || profiles.size === 0) {
    return (
      <div className="card-lg" style={{ padding: "48px 32px", maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Could not reach the API</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.6 }}>
          Check that the backend is running and <code>API_URL</code> is set. For the demo, <code>mock/mock_api.py</code>{" "}
          serves this contract on port 8000.
        </p>
      </div>
    );
  }

  return <Explorer regions={regions} profiles={profiles} />;
}
