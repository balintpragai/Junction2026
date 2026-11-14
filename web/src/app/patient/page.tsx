import { PatientView } from "@/components/PatientView";

export default function PatientPage() {
  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", fontWeight: 600 }}>
          Patient nudge
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.3rem)", marginTop: 8 }}>What the patient sees</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "64ch" }}>
          Illustrative — the outreach list drives a reminder through My Kanta, not a new system collecting new data.
        </p>
      </header>
      <PatientView />
    </div>
  );
}
