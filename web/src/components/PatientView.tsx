/** Patient nudge — illustrative only, no API (BUILD.md: "keep the patient
 *  tab as-is, it's already appropriately simple for its audience"). Ported
 *  from the Reach Loop artifact's phone mockup onto the new tokens. */
export function PatientView() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 32, alignItems: "start" }} className="patient-grid">
      <div>
        <div
          style={{
            width: 240,
            border: "8px solid var(--ink)",
            borderRadius: 34,
            background: "var(--bg)",
            padding: "14px 10px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ width: 60, height: 6, background: "var(--ink)", borderRadius: 4, margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", textAlign: "center", marginBottom: 8 }}>
            My Kanta · notification
          </p>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Rintasyöpäseulonta / Breast screening</p>
            <p style={{ fontSize: 12.5 }}>Sinulla on oikeus maksuttomaan seulontaan. Varaa aikasi helposti.</p>
            <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 6 }}>
              You&rsquo;re eligible for a free breast-cancer screening. Booking takes two minutes.
            </p>
          </div>
          <button
            disabled
            style={{
              marginTop: 10,
              width: "100%",
              background: "var(--brand)",
              color: "var(--brand-ink)",
              border: "none",
              borderRadius: 8,
              padding: 9,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            🔊 Play voice message
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 10, fontFamily: "var(--font-mono)" }}>
          mockup — illustrative copy only
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <details
          style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 16px", background: "var(--card)" }}
          open
        >
          <summary style={{ cursor: "pointer", fontWeight: 650, color: "var(--brand)" }}>Why is this patient getting this?</summary>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>
            She lives in one of the Regions the engine flagged below target. This reinforces Finland&rsquo;s existing
            invitation-based screening programme — it doesn&rsquo;t collect any new personal data, it just decides who gets a
            reminder and when. Delivered via My Kanta first; SMS and voice narration as fallbacks for groups the broadband and
            literacy data flag as least reachable digitally.
          </p>
        </details>

        <div style={{ border: "1px dashed var(--act-line)", background: "var(--act-soft)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
          <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--act)" }}>Dropped from this version:</strong> pairing this nudge with priority treatment
            access for patients screened from remote areas. Finnish treatment order runs on clinical urgency by law — tying it to
            screening attendance would penalize patients least able to get screened in the first place.
          </p>
        </div>
      </div>

      <style>{`@media (max-width: 700px) { .patient-grid { grid-template-columns: 1fr !important; justify-items: center; } }`}</style>
    </div>
  );
}
