import Link from "next/link";
import { notFound } from "next/navigation";
import { loadActionLibrary, loadRegionProfile } from "@/lib/api";
import { ActionPlanner } from "@/components/planner/ActionPlanner";
import { RoleGate } from "@/components/RoleGate";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [profile, library] = await Promise.all([loadRegionProfile(code), loadActionLibrary(code)]);
  if (!profile) notFound();

  return (
    <RoleGate allow="state">
      <Link href="/" className="btn btn-quiet btn-sm" style={{ marginLeft: -10 }}>
        ← Decision Map
      </Link>

      <header style={{ marginTop: 10, marginBottom: 18 }}>
        <p className="eyebrow">Action planner · {profile.region.name}</p>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", marginTop: 7 }}>
          What could help in {profile.region.name}
        </h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Recommended actions come from this Region&rsquo;s own Gaps — a real National Cancer Strategy action, or a
          data-driven suggestion from the structural covariates. Each one expands into the chain of work it actually
          sets off, so you are issuing a programme rather than a message.
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
