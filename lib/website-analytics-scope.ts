import { parseAnalyticsDateRange, WebsiteAnalyticsError, type AnalyticsDateRange } from "./website-analytics.ts";
import { parseAnalyticsTimeRange } from "./website-analytics-time.ts";

export interface WebsiteDatasetSelection extends AnalyticsDateRange { sites: string[] }
export interface WebsiteScopeSelection { sites: string[]; comparison?: WebsiteDatasetSelection }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WebsiteAnalyticsError("invalid_query", 400);
  return value as Record<string, unknown>;
}
function siteKeys(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value) || !value.length || value.length > allowed.length || value.some(key => typeof key !== "string" || !allowed.includes(key)) || new Set(value).size !== value.length) throw new WebsiteAnalyticsError("invalid_query", 400);
  return value as string[];
}
/** Presentation-only state. Never accepts source endpoints or credentials. */
export function parseWebsiteScope(raw: unknown, allowed: readonly string[], now: Date): WebsiteScopeSelection | undefined {
  if (raw === undefined) return undefined;
  try {
    if (typeof raw !== "string" || raw.length > 4096) throw new Error();
    const value = object(JSON.parse(raw));
    if (Object.keys(value).some(key => key !== "sites" && key !== "comparison")) throw new Error();
    const sites = siteKeys(value.sites, allowed);
    if (value.comparison === undefined) return { sites };
    const comparison = object(value.comparison);
    if (Object.keys(comparison).some(key => !["sites", "from", "to", "timeFrom", "timeTo"].includes(key))) throw new Error();
    const range = parseAnalyticsDateRange(comparison.from, comparison.to, now);
    if (!range) throw new Error();
    return { sites, comparison: { ...range, ...parseAnalyticsTimeRange(comparison.timeFrom, comparison.timeTo, range), sites: siteKeys(comparison.sites, allowed) } };
  } catch { throw new WebsiteAnalyticsError("invalid_query", 400); }
}

export function scopeSearchParams(existing: URLSearchParams, scope: WebsiteScopeSelection): URLSearchParams {
  const params = new URLSearchParams(existing);
  params.delete("analyticsCompare");
  params.set("analyticsScope", JSON.stringify(scope));
  return params;
}

/** Apply one analytics selection while preserving the independent business period. */
export function dashboardAnalyticsFilterParams(existing: URLSearchParams, month: string, range: AnalyticsDateRange, scope?: WebsiteScopeSelection): URLSearchParams {
  const params = new URLSearchParams(existing);
  params.set("month", month);
  params.set("analyticsFrom", range.from);
  params.set("analyticsTo", range.to);
  const time = parseAnalyticsTimeRange(range.timeFrom, range.timeTo, range);
  if (time) {
    params.set("analyticsTimeFrom", time.timeFrom);
    params.set("analyticsTimeTo", time.timeTo);
  } else {
    params.delete("analyticsTimeFrom");
    params.delete("analyticsTimeTo");
  }
  return scope ? scopeSearchParams(params, scope) : params;
}
