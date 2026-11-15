"use client";

import { useLang } from "@/lib/lang";

/** An error boundary that says what broke and offers the one action that
 *  usually fixes it. The demo's data comes from a separate process, so the
 *  likeliest cause by far is that the API is not running — naming that is
 *  more useful than apologising. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, tf } = useLang();
  return (
    <div className="card-lg" style={{ padding: "40px 32px", maxWidth: 520, margin: "48px auto" }}>
      <h1 style={{ fontSize: "1.2rem" }}>{t("This screen could not load")}</h1>
      <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.6 }}>
        {t("Usually this means the API is unreachable. Check that it is running and that API_URL points at it, then try again.")}
      </p>
      {error.digest && (
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 12 }}>{tf("Reference {digest}", { digest: error.digest })}</p>
      )}
      <button onClick={reset} className="btn btn-primary" style={{ marginTop: 18 }}>
        {t("Try again")}
      </button>
    </div>
  );
}
