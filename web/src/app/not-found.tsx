import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card-lg" style={{ padding: "40px 32px", maxWidth: 520, margin: "48px auto" }}>
      <h1 style={{ fontSize: "1.2rem" }}>No such Region</h1>
      <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.6 }}>
        The code in that link does not match any of Finland&rsquo;s 23 Regions. It may have been mistyped, or the
        link may predate a change to how Regions are named.
      </p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 18 }}>
        Back to the Decision Map
      </Link>
    </div>
  );
}
