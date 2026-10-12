import type { WebsiteSummary } from "./website-analytics";

export type WebsiteChartMetric = "page_views" | "contact_clicks" | "gallery_opens";
export interface WebsiteChartPoint { date: string; values: Record<string, number | null> }

export interface WebsiteComparisonPoint {
  key: string;
  displayName: string;
  page_views: number | null;
  contact_clicks: number | null;
  gallery_opens: number | null;
}

/** Use the same selected-month totals as the summary table, preserving missing data. */
export function websiteComparisonData(sites: WebsiteSummary[]): WebsiteComparisonPoint[] {
  return sites.map(site => ({
    key: site.key,
    displayName: site.displayName,
    page_views: site.totals?.page_views ?? null,
    contact_clicks: site.totals?.contact_clicks ?? null,
    gallery_opens: site.totals?.gallery_opens ?? null,
  }));
}

/** Missing days and days outside source retention are gaps, never estimated zeros. */
export function websiteChartData(sites: WebsiteSummary[], month: string, metric: WebsiteChartMetric, period: "day" | "month" = "day"): WebsiteChartPoint[] {
  if (period === "month") {
    const rows = sites.map(site => new Map((site.monthly ?? []).filter(day => day.date <= month).map(day => [day.date, day[metric] ?? null])));
    return [...new Set(rows.flatMap(row => [...row.keys()]))].sort().map(date => ({ date, values: Object.fromEntries(sites.map((site, index) => [site.key, rows[index].get(date) ?? null])) }));
  }
  const rows = sites.map(site => {
    const available = site.coverage ? new Date(new Date(site.coverage.data_available_from).getTime() + 7 * 3600000).toISOString().slice(0, 10) : "";
    return new Map((site.totals ? site.daily ?? [] : []).filter(day => day.date.startsWith(`${month}-`) && day.date >= available).map(day => [day.date, day[metric]]));
  });
  const dates = [...new Set(rows.flatMap(row => [...row.keys()]))].sort();
  return dates.map(date => ({ date, values: Object.fromEntries(sites.map((site, index) => [site.key, rows[index].get(date) ?? null])) }));
}
