// Placeholder page for the compose skeleton (#2). The real tabs arrive in #10 and #11.
import type { components } from "@/lib/api-types";

type RegionList = components["schemas"]["RegionList"];

// Read at request time so the same image works in every environment.
export const dynamic = "force-dynamic";

async function loadRegions(): Promise<RegionList | null> {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/regions`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as RegionList) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const data = await loadRegions();
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Reach Loop</h1>
      <p>Frontend placeholder. The decision-maker, outreach and patient tabs are coming.</p>
      <p>
        {data
          ? `API reachable: ${data.regions.length} Regions loaded.`
          : "API not reachable. Check that the api service is running and API_URL is set."}
      </p>
    </main>
  );
}
