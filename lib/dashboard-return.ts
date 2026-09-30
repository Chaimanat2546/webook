import { parseDashboardQuery } from "./dashboard.ts";
import { dashboardHref } from "./dashboard-navigation.ts";

export interface DashboardReturnState {
  sourceHref: string;
  detailHref: string;
  originId: string;
  scrollTop: number;
  pending: boolean;
}

export function dashboardLocation(href: string): string | null {
  if (!href.startsWith("/admin/dashboard?") && href !== "/admin/dashboard") return null;
  const url = new URL(href, "https://dashboard.invalid");
  if (url.pathname !== "/admin/dashboard" || url.hash) return null;
  try {
    const raw: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      if (key in raw) return null;
      raw[key] = value;
    }
    return dashboardHref(parseDashboardQuery(raw));
  } catch { return null; }
}

export function dashboardReturnState(raw: string | null, sourceHref: string): DashboardReturnState | null {
  try {
    const state: unknown = JSON.parse(raw ?? "null");
    if (!state || typeof state !== "object") return null;
    const s = state as Record<string, unknown>;
    if (s.pending !== true || typeof s.sourceHref !== "string" || typeof s.detailHref !== "string"
      || !dashboardLocation(s.detailHref) || !dashboardLocation(s.sourceHref)
      || dashboardLocation(s.sourceHref) !== dashboardLocation(sourceHref)
      || typeof s.originId !== "string" || !s.originId.startsWith("dashboard-")
      || typeof s.scrollTop !== "number" || !Number.isFinite(s.scrollTop) || s.scrollTop < 0) return null;
    return { sourceHref: s.sourceHref, detailHref: s.detailHref, originId: s.originId, scrollTop: s.scrollTop, pending: true };
  } catch { return null; }
}
