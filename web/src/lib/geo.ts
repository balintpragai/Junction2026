export type SeverityToken = "ok" | "watch" | "act";

export const SEVERITY_LABEL: Record<SeverityToken, string> = {
  ok: "On target",
  watch: "Watch",
  act: "Act",
};
