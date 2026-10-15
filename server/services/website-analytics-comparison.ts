import "server-only";
import { analyticsPeriod, type AnalyticsPeriod, type WebsiteAnalyticsQuery, type WebsiteSummary } from "../../lib/website-analytics.ts";
import { previousAnalyticsRange, type WebsitePreviousPeriod } from "../../lib/website-analytics-comparison.ts";
import { listAnalyticsSites } from "../site-analytics/registry.ts";
import { loadWebsiteAnalytics, type WebsiteAnalyticsDependencies } from "./website-analytics.ts";
import type { WebsiteScopeSelection, WebsiteDatasetSelection } from "../../lib/website-analytics-scope.ts";

export interface WebsiteSummaryPeriods {
  period: AnalyticsPeriod;
  sites: WebsiteSummary[];
  previous?: WebsitePreviousPeriod;
}

/** Dashboard-only orchestration, called after admin authorization. */
export async function loadWebsiteSummaryPeriods(query: WebsiteAnalyticsQuery, compare: boolean, dependencies: WebsiteAnalyticsDependencies = {}, scope?: WebsiteScopeSelection): Promise<WebsiteSummaryPeriods> {
  const now = (dependencies.now ?? (() => new Date()))();
  const period = analyticsPeriod(query, now);
  const registry = (dependencies.sites ?? listAnalyticsSites)();
  const sites = registry.filter(site => scope ? scope.sites.includes(site.key) : query.site === "all" || query.site === site.key);
  const summaryQuery = { month: query.month, from: period.from_date, to: period.to_date, site: query.site, page: 1, granularity: "day" as const };
  async function read(selected: WebsiteAnalyticsQuery, targets = sites): Promise<WebsiteSummary[]> {
    if (!targets.length) return [];
    try {
      const report = await loadWebsiteAnalytics({ ...selected, site: "all" }, { ...dependencies, now: () => now, sites: () => targets, titles: async () => new Map() });
      return report.websites;
    } catch {
      return targets.map(site => ({ key: site.key, displayName: site.displayName, origin: site.origin, status: "unavailable", totals: null, coverage: null }));
    }
  }
  const current = await read(summaryQuery);
  const previousRange = scope ? scope.comparison : compare ? previousAnalyticsRange({ from: period.from_date, to: period.to_date }) : undefined;
  // Sequential period groups preserve the existing maximum of two upstream calls.
  const priorTargets = scope?.comparison ? registry.filter(site => scope.comparison?.sites.includes(site.key)) : sites;
  const previous = previousRange ? { range: { from: previousRange.from, to: previousRange.to }, sites: await read({ ...summaryQuery, from: previousRange.from, to: previousRange.to, month: previousRange.to.slice(0, 7) }, priorTargets) } : undefined;
  return { period, sites: current, ...(previous ? { previous } : {}) };
}

/** Reuse the authorized current report's timestamp without loading it again. */
export async function loadPreviousWebsitePeriod(query: WebsiteAnalyticsQuery, period: AnalyticsPeriod, dependencies: WebsiteAnalyticsDependencies = {}, selection?: WebsiteDatasetSelection): Promise<WebsitePreviousPeriod | undefined> {
  if (query.view === "houses") return undefined;
  const range = selection ?? previousAnalyticsRange({ from: period.from_date, to: period.to_date });
  if (!range) return undefined;
  const previous = await loadWebsiteSummaryPeriods({ ...query, from: range.from, to: range.to, month: range.to.slice(0, 7) }, false, { ...dependencies, now: () => new Date(period.as_of) }, selection ? { sites: selection.sites } : undefined);
  return { range: { from: range.from, to: range.to }, sites: previous.sites };
}
