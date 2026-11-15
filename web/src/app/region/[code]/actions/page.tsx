import Link from "next/link";
import { notFound } from "next/navigation";
import { loadActionLibrary, loadRegionProfile } from "@/lib/api";
import { ActionPlanner } from "@/components/planner/ActionPlanner";
import { RoleGate } from "@/components/RoleGate";
import { serverLang } from "@/lib/lang-server";
import { regionName } from "@/lib/fi-data";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [profile, library] = await Promise.all([loadRegionProfile(code), loadActionLibrary(code)]);
  if (!profile) notFound();

  const { lang, t, tf } = await serverLang();

  return (
    <RoleGate allow="state">
      <Link href={`/?region=${code}`} className="btn btn-quiet btn-sm" style={{ marginLeft: -10 }}>
        {t("Back to the decision map")}
      </Link>

      <header style={{ marginTop: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)" }}>
          {tf("What could help in {region}", {
            region: regionName(profile.region.code, profile.region.name, lang),
          })}
        </h1>
        <p style={{ color: "var(--ink-2)", marginTop: 5, fontSize: 13.5, maxWidth: "78ch" }}>
          {t(
            "Each action expands into the chain of work it sets off, so you are issuing a programme rather than sending a message.",
          )}
        </p>
      </header>

      <ActionPlanner
        region={profile.region}
        profile={profile}
        recommended={profile.candidate_actions}
        library={library}
      />
    </RoleGate>
  );
}
