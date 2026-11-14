import Link from "next/link";
import { notFound } from "next/navigation";
import { loadRegionProfile } from "@/lib/api";
import { ActionPlanner } from "@/components/ActionPlanner";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = await loadRegionProfile(code);
  if (!profile) notFound();

  return (
    <div>
      <Link href={`/region/${code}`} style={{ fontSize: 13, color: "var(--ink-2)", textDecoration: "none" }}>
        ← {profile.region.name}
      </Link>

      <header style={{ marginTop: 12, marginBottom: 24 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Action planner
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>What could help in {profile.region.name}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "70ch" }}>
          Each candidate below is tied to a specific constraint found on this Region's page -- a real National
          Cancer Strategy action, or a data-driven suggestion from the structural covariates. Build a plan, then
          activate it.
        </p>
      </header>

      <ActionPlanner region={profile.region} actions={profile.candidate_actions} />
    </div>
  );
}
