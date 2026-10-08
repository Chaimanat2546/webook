import "server-only";
import { addMetrics, analyticsPeriod, compareWebsiteVillas, matchesWebsiteVilla, emptyMetrics, WebsiteAnalyticsError, type AnalyticsDay, type AnalyticsPeriod, type AnalyticsSite, type SiteReportResult, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport, type WebsiteSummary, type WebsiteVilla } from "../../lib/website-analytics.ts";
import { listAnalyticsSites } from "../site-analytics/registry.ts";
import { fetchSiteReport } from "../site-analytics/client.ts";
import { loadMonthlyHistory } from "../site-analytics/history.ts";

export interface WebsiteAnalyticsDependencies {
  now?: () => Date;
  sites?: () => AnalyticsSite[];
  read?: (site: AnalyticsSite, period: AnalyticsPeriod) => Promise<SiteReportResult>;
  titles?: (ids: string[]) => Promise<Map<string, string>>;
}
async function loadTitles(ids: string[]): Promise<Map<string, string>> {
  const [{ createSupabaseAdminClient }, { getAnalyticsListingTitles }] = await Promise.all([import("../../lib/supabase/admin"), import("../repositories/listings")]);
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("listing_titles_unavailable");
  return getAnalyticsListingTitles(client, ids);
}
export async function loadWebsiteAnalytics(query: WebsiteAnalyticsQuery, dependencies: WebsiteAnalyticsDependencies = {}): Promise<WebsiteAnalyticsReport> {
  const period = analyticsPeriod(query, (dependencies.now ?? (() => new Date()))());
  const sites = (dependencies.sites ?? listAnalyticsSites)().filter(site => query.site === "all" || query.site === site.key);
  if (!sites.length) throw new WebsiteAnalyticsError("invalid_query", 400);
  const results = new Map<string, SiteReportResult>();
  let next = 0;
  async function work() {
    while (next < sites.length) {
      const site = sites[next++];
      try { results.set(site.key, await (dependencies.read ?? fetchSiteReport)(site, period)); }
      catch { results.set(site.key, { ok: false, reason: "unavailable" }); }
    }
  }
  await Promise.all([work(), work()]);
  let totals = emptyMetrics(), unattributed = emptyMetrics(), availableSites = 0;
  const days = new Map<string, AnalyticsDay>(), villas: WebsiteVilla[] = [], websites: WebsiteSummary[] = [];
  for (const site of sites) {
    const result = results.get(site.key);
    const identity = { key: site.key, displayName: site.displayName, origin: site.origin };
    if (!result?.ok) { websites.push({ ...identity, status: result?.reason ?? "unavailable", totals: null, coverage: null }); continue; }
    const report = result.report;
    availableSites++;
    totals = addMetrics(totals, report.totals); unattributed = addMetrics(unattributed, report.unattributed);
    websites.push({ ...identity, status: report.coverage.range_complete && report.coverage.rows_complete ? "complete" : "partial", totals: report.totals, coverage: report.coverage });
    for (const day of report.daily) days.set(day.date, { ...addMetrics(days.get(day.date) ?? emptyMetrics(), day), date: day.date });
    for (const villa of report.villas) villas.push({ ...villa, siteKey: site.key, siteName: site.displayName });
  }
  let nameSortUnavailable = false, searchUnavailable = false;
  const search = query.search?.trim() ?? "";
  if ((query.sort === "name" || search) && villas.length) {
    try {
      const titles = await (dependencies.titles ?? loadTitles)([...new Set(villas.map(villa => villa.villa_id))]);
      for (const villa of villas) villa.title = titles.get(villa.villa_id);
    } catch { nameSortUnavailable = query.sort === "name"; searchUnavailable = Boolean(search); }
  }
  villas.sort((a, b) => compareWebsiteVillas(a, b, query.sort ?? "contacts"));
  const matchedVillas = search ? villas.filter(villa => matchesWebsiteVilla(villa, search)) : villas;
  const complete = websites.every(site => site.status === "complete");
  const lastPage = Math.max(1, Math.ceil(matchedVillas.length / 10));
  if (complete && !searchUnavailable && query.page > lastPage) throw new WebsiteAnalyticsError("invalid_query", 400);
  // Source loss can remove a previously valid page; keep its diagnostics and totals.
  const page = Math.min(query.page, lastPage);
  for (const site of websites) {
    const source = results.get(site.key);
    if (!source?.ok) continue;
    const rows = matchedVillas.filter(villa => villa.siteKey === site.key);
    const requested = query.pages?.[site.key] ?? 1;
    const last = Math.max(1, Math.ceil(rows.length / 10));
    if (site.status === "complete" && !searchUnavailable && requested > last) throw new WebsiteAnalyticsError("invalid_query", 400);
    const sitePage = Math.min(requested, last);
    site.unattributed = source.report.unattributed;
    site.villas = { rows: rows.slice((sitePage - 1) * 10, sitePage * 10), page: sitePage, total: rows.length };
  }
  const visible = websites.flatMap(site => site.villas?.rows ?? []);
  if (visible.length && query.sort !== "name" && !search) {
    try {
      const titles = await (dependencies.titles ?? loadTitles)([...new Set(visible.map(villa => villa.villa_id))]);
      for (const villa of visible) villa.title = titles.get(villa.villa_id);
    } catch { /* Counts remain usable when optional catalog metadata is unavailable. */ }
  }
  const monthly = query.granularity === "month" && query.view !== "houses" ? await loadMonthlyHistory(sites, period, results, dependencies.read ?? fetchSiteReport) : undefined;
  return {
    ...(searchUnavailable ? { searchUnavailable: true } : {}),
    ...(nameSortUnavailable ? { nameSortUnavailable: true } : {}),
    ...(monthly ? { monthly } : {}),
    period, status: availableSites === 0 ? "unavailable" : complete ? "complete" : "partial",
    selectedSites: sites.length, availableSites, totals: availableSites ? totals : null, unattributed: availableSites ? unattributed : null,
    websites, daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    villas: { rows: matchedVillas.slice((page - 1) * 10, page * 10), total: matchedVillas.length, page, pageSize: 10 },
  };
}
