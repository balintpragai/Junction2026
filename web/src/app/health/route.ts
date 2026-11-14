// GET /health for the compose healthcheck.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
