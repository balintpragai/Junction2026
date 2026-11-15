import { Suspense } from "react";
import { loadAllRegionProfiles, loadRegions } from "@/lib/api";
import { Explorer } from "@/components/Explorer";
import { MapSkeleton } from "@/components/Skeletons";
import { serverLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const regionList = await loadRegions();
  const regions = regionList?.regions ?? [];
  const profiles = regions.length ? await loadAllRegionProfiles(regions) : new Map();

  const { t } = await serverLang();

  if (regions.length === 0 || profiles.size === 0) {
    return (
      <div className="card-lg" style={{ padding: "48px 32px", maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>{t("Could not reach the API")}</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.6 }}>
          {t(
            "The stack is running but web could not read api. Check docker compose ps (five services healthy, seed exited 0), that API_URL points at api, and that the rescore job has scored Gaps — /overview should return 23 rows.",
          )}
        </p>
      </div>
    );
  }

  // Explorer reads the selected Region out of the URL, which needs a
  // Suspense boundary to prerender.
  return (
    <Suspense fallback={<MapSkeleton />}>
      <Explorer regions={regions} profiles={profiles} />
    </Suspense>
  );
}
