import Link from "next/link";
import { notFound } from "next/navigation";
import { loadActionLibrary, loadRegionProfile } from "@/lib/api";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [profile, library] = await Promise.all([loadRegionProfile(code), loadActionLibrary(code)]);
  if (!profile) notFound();

  return (
    <div>
      <Link href="/" style={{ fontSize: 13, color: "var(--ink-2)", textDecoration: "none" }}>
        ← {profile.region.name}
      </Link>

      <header style={{ marginTop: 12, marginBottom: 20 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Action planner
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>What could help in {profile.region.name}</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "70ch" }}>
          Recommended actions come from this Region&rsquo;s own Gaps — a real National Cancer Strategy action, or a
          data-driven suggestion from the structural covariates. Search the full strategy to add anything else, then
          activate the plan.
        </p>
      </header>

      <WorkflowCanvas region={profile.region} recommended={profile.candidate_actions} library={library} />
    </div>
  );
}
