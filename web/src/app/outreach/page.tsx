import { loadOutreachList } from "@/lib/api";
import { OutreachView } from "@/components/OutreachView";

export const dynamic = "force-dynamic";

const INDICATOR = "3621";
const YEAR = 2024;

export default async function OutreachPage() {
  const data = await loadOutreachList(INDICATOR, YEAR);

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Outreach list
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>Regions to prioritize next</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "64ch" }}>
          Every Region below target, ranked by Gap size, for a county or national outreach team to act on.
        </p>
      </header>

      {data ? (
        <OutreachView data={data} />
      ) : (
        <p style={{ color: "var(--act)" }}>
          Could not reach the API. Check that the <code>api</code> service is running and <code>API_URL</code> is set.
        </p>
      )}
    </div>
  );
}
