import { NextRequest, NextResponse } from "next/server";

const allowedRoutes = new Set(["regions", "indicators", "outreach-list"]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const isGapSummary = path.length === 3 && path[0] === "regions" && path[2] === "gap-summary";
  if (!allowedRoutes.has(path.join("/")) && !isGapSummary) {
    return NextResponse.json({ detail: "Unknown dashboard data route" }, { status: 404 });
  }

  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${apiUrl}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "The data service is not reachable" }, { status: 503 });
  }
}
