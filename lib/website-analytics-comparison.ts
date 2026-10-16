import { parseWebsiteAnalyticsQuery, websiteAnalyticsHref, WebsiteAnalyticsError, type AnalyticsDateRange, type WebsiteAnalyticsQuery, type WebsiteSummary } from "./website-analytics.ts";
import type { WebsiteChartMetric } from "./website-analytics-chart.ts";
import { parseWebsiteScope, scopeSearchParams, type WebsiteScopeSelection } from "./website-analytics-scope.ts";

const dayMs = 86400000;
import { hourlyBounds } from "./website-analytics-time.ts";
import { websiteChartData } from "./website-analytics-chart.ts";

export interface WebsitePeriodSeries {
  range: AnalyticsDateRange;
  total: number | null;
  availableDays: number;
  expectedDays: number;
  coverageComplete: boolean;
  status: "complete" | "partial" | "unavailable" | "ongoing";
  daily: { date: string; value: number | null }[];
  granularity?: "hour" | "day";
  asOf?: string;
  durationMinutes?: number;
  requestedEnd?: string;
}

export interface WebsitePreviousPeriod {
  range: AnalyticsDateRange;
  sites: WebsiteSummary[];
}

export interface WebsitePeriodPoint {
  date: string;
  previousDate: string;
  current: number | null;
  previous: number | null;
}

export interface WebsitePeriodRow {
  key: string;
  displayName: string;
  current: WebsitePeriodSeries;
  previous: WebsitePeriodSeries;
  currentSelected: boolean;
  previousSelected: boolean;
}

export interface WebsiteMultiPeriodPoint {
  date: string;
  previousDate: string;
  values: Record<string, { current: number | null; previous: number | null }>;
}

export type WebsitePeriodChange =
  | { kind: "percentage"; difference: number; percentage: number }
  | { kind: "zero_baseline"; difference: number }
  | { kind: "unchanged"; difference: 0 }
  | { kind: "unavailable" };

export function parseAnalyticsComparison(value: unknown): boolean {
  if (value === undefined) return false;
  if (value === "previous") return true;
  throw new WebsiteAnalyticsError("invalid_query", 400);
}

/** Adjacent calendar dates, never a fixed previous month or a weekday match. */
export function previousAnalyticsRange(range: AnalyticsDateRange): AnalyticsDateRange | undefined {
  const start = Date.parse(range.from);
  const length = Date.parse(range.to) - start + dayMs;
  if (!Number.isFinite(length) || length < dayMs) return undefined;
  const from = new Date(start - length).toISOString().slice(0, 10);
  if (from < "1900-01-01") return undefined;
  return { from, to: new Date(start - dayMs).toISOString().slice(0, 10), ...(range.timeFrom && range.timeTo ? { timeFrom: range.timeFrom, timeTo: range.timeTo } : {}) };
}

/** Keep source totals, confirmed zeroes and absent days distinct. */
export function websitePeriodSeries(site: WebsiteSummary | undefined, range: AnalyticsDateRange, asOf: string, metric: WebsiteChartMetric): WebsitePeriodSeries {
  if (range.from === range.to && range.timeFrom && range.timeTo) {
    const bounds = hourlyBounds(range.from, { timeFrom: range.timeFrom, timeTo: range.timeTo }, asOf);
    const total = site?.totals?.[metric] ?? null;
    const points = websiteChartData(site ? [site] : [], range.from.slice(0, 7), metric, "hour", range).map(point => ({ date: point.date, value: site ? point.values[site.key] : null }));
    const observed = points.filter(point => point.value !== null).length;
    const complete = Boolean(site?.status === "complete" && site.coverage?.range_complete && site.coverage.rows_complete && observed === points.length && points.reduce((sum, point) => sum + (point.value ?? 0), 0) === total);
    const status = total === null ? "unavailable" : Date.parse(asOf) < Date.parse(bounds.end) ? "ongoing" : complete ? "complete" : "partial";
    return { range, total, daily: points, expectedDays: points.length, availableDays: observed, coverageComplete: complete, status, asOf, granularity: "hour", durationMinutes: points.length * 60, requestedEnd: bounds.end };
  }
  const total = site?.totals?.[metric] ?? null;
  const retentionTime = site?.coverage ? Date.parse(site.coverage.data_available_from) : NaN;
  const availableFrom = Number.isFinite(retentionTime) ? new Date(retentionTime + 7 * 3600000).toISOString().slice(0, 10) : "";
  const rows = new Map((total === null ? [] : site?.daily ?? []).filter(row => row.date >= availableFrom).map(row => [row.date, row[metric]]));
  const daily: WebsitePeriodSeries["daily"] = [];
  for (let time = Date.parse(range.from); time <= Date.parse(range.to); time += dayMs) {
    const date = new Date(time).toISOString().slice(0, 10);
    daily.push({ date, value: rows.get(date) ?? null });
  }
  const availableDays = daily.filter(row => row.value !== null).length;
  const snapshot = Date.parse(asOf);
  const today = Number.isFinite(snapshot) ? new Date(snapshot + 7 * 3600000).toISOString().slice(0, 10) : "";
  const coverageComplete = Boolean(site?.status === "complete" && site.coverage?.range_complete && site.coverage.rows_complete && Number.isFinite(retentionTime)
    && availableDays === daily.length && daily.reduce((sum, row) => sum + (row.value ?? 0), 0) === total);
  const status = total === null ? "unavailable" : !today ? "partial" : range.to >= today ? "ongoing" : coverageComplete ? "complete" : "partial";
  return { range, total, availableDays, expectedDays: daily.length, coverageComplete, status, daily };
}

export function websitePeriodChange(current: WebsitePeriodSeries, previous: WebsitePeriodSeries): WebsitePeriodChange {
  if ((current.granularity ?? "day") !== (previous.granularity ?? "day") || current.durationMinutes !== previous.durationMinutes) return { kind: "unavailable" };
  if (current.status !== "complete" || previous.status !== "complete" || current.total === null || previous.total === null || current.expectedDays !== previous.expectedDays) return { kind: "unavailable" };
  const difference = current.total - previous.total;
  if (previous.total === 0) return difference === 0 ? { kind: "unchanged", difference: 0 } : { kind: "zero_baseline", difference };
  return { kind: "percentage", difference, percentage: difference / previous.total * 100 };
}

export function pairWebsitePeriods(current: WebsitePeriodSeries, previous: WebsitePeriodSeries): WebsitePeriodPoint[] {
  return Array.from({ length: Math.max(current.daily.length, previous.daily.length) }, (_, index) => ({ date: current.daily[index]?.date ?? "", previousDate: previous.daily[index]?.date ?? "", current: current.daily[index]?.value ?? null, previous: previous.daily[index]?.value ?? null }));
}

export function websitePeriodRows(sites: WebsiteSummary[], range: AnalyticsDateRange, previous: WebsitePreviousPeriod, asOf: string, metric: WebsiteChartMetric): WebsitePeriodRow[] {
  const all = [...sites, ...previous.sites.filter(site => !sites.some(current => current.key === site.key))];
  return all.map(site => {
    const current = sites.find(current => current.key === site.key), prior = previous.sites.find(prior => prior.key === site.key);
    return { key: site.key, displayName: site.displayName, currentSelected: Boolean(current), previousSelected: Boolean(prior), current: websitePeriodSeries(current, range, asOf, metric), previous: websitePeriodSeries(prior, previous.range, asOf, metric) };
  });
}

export function websiteMultiPeriodPoints(rows: WebsitePeriodRow[]): WebsiteMultiPeriodPoint[] {
  const paired = rows.map(row => pairWebsitePeriods(row.current, row.previous));
  return (paired[0] ?? []).map((point, index) => ({ date: point.date, previousDate: point.previousDate, values: Object.fromEntries(rows.map((row, rowIndex) => [row.key, { current: paired[rowIndex][index]?.current ?? null, previous: paired[rowIndex][index]?.previous ?? null }])) }));
}

/** One website toggle hides both periods without altering the source reports. */
export function visibleWebsitePeriodRows(rows: WebsitePeriodRow[], hiddenSites: readonly string[]): WebsitePeriodRow[] {
  return rows.filter(row => !hiddenSites.includes(row.key));
}

/** Website-page presentation state does not expand the reporting API contract. */
export function parseWebsiteComparisonQuery(raw: Record<string, unknown>, allowedKeys: readonly string[], now: Date): { query: WebsiteAnalyticsQuery; compare: boolean; scope?: WebsiteScopeSelection } {
  const { analyticsCompare, analyticsScope, ...filters } = raw;
  const legacy = parseAnalyticsComparison(analyticsCompare);
  const scope = parseWebsiteScope(analyticsScope, allowedKeys, now);
  return { query: parseWebsiteAnalyticsQuery(filters, allowedKeys, now, { singleSite: true }), compare: scope ? Boolean(scope.comparison) : legacy, scope };
}

export function websitePeriodHref(query: WebsiteAnalyticsQuery, changes: Partial<WebsiteAnalyticsQuery> = {}, compare = false, scope?: WebsiteScopeSelection): string {
  const href = websiteAnalyticsHref(query, changes);
  if (scope) {
    const [path, search] = href.split("?");
    // Choosing another primary report explicitly reveals that website in both periods.
    const sites = changes.site && changes.site !== "all" && changes.site !== query.site ? [...new Set([...scope.sites, changes.site])] : undefined;
    const next = sites ? { sites, ...(scope.comparison ? { comparison: { ...scope.comparison, sites } } : {}) } : scope;
    return `${path}?${scopeSearchParams(new URLSearchParams(search), next)}`;
  }
  return compare ? `${href}&analyticsCompare=previous` : href;
}
