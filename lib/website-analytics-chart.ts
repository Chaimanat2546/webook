import type { AnalyticsDateRange, WebsiteSummary } from "./website-analytics";
import { atOrAfterAnalyticsTimestamp, hourlyBounds, parseAnalyticsTimeRange } from "./website-analytics-time.ts";

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
export function websiteChartData(sites: WebsiteSummary[], month: string, metric: WebsiteChartMetric, period: "hour" | "day" | "month" = "day", range?: AnalyticsDateRange): WebsiteChartPoint[] {
  if (period === "hour") {
    const time = parseAnalyticsTimeRange(range?.timeFrom, range?.timeTo, range);
    if (!range || !time) return [];
    const requested = hourlyBounds(range.from, time, `${range.from}T23:59:59.999+07:00`);
    return requested.buckets.map(bucket => ({ date: bucket.start, values: Object.fromEntries(sites.map(site => {
      const row = site.totals ? site.hourly?.find(hour => hour.start === bucket.start) : undefined;
      const retained = !site.coverage || atOrAfterAnalyticsTimestamp(bucket.start, site.coverage.data_available_from);
      return [site.key, row && retained ? row[metric] : null];
    })) }));
  }
  if (period === "month") {
    const rows = sites.map(site => new Map((site.monthly ?? []).filter(day => day.date <= month).map(day => [day.date, day[metric] ?? null])));
    return [...new Set(rows.flatMap(row => [...row.keys()]))].sort().map(date => ({ date, values: Object.fromEntries(sites.map((site, index) => [site.key, rows[index].get(date) ?? null])) }));
  }
  const rows = sites.map(site => {
    const available = site.coverage ? new Date(new Date(site.coverage.data_available_from).getTime() + 7 * 3600000).toISOString().slice(0, 10) : "";
    return new Map((site.totals ? site.daily ?? [] : []).filter(day => (range ? day.date >= range.from && day.date <= range.to : day.date.startsWith(`${month}-`)) && day.date >= available).map(day => [day.date, day[metric]]));
  });
  const dates = [...new Set(rows.flatMap(row => [...row.keys()]))].sort();
  if (!dates.length) return [];
  // Include absent dates so a line cannot bridge an unreported day.
  const start = Date.parse(range?.from ?? dates[0]);
  const end = Date.parse(range?.to ?? dates[dates.length - 1]);
  const days: WebsiteChartPoint[] = [];
  for (let time = start; time <= end; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({ date, values: Object.fromEntries(sites.map((site, index) => [site.key, rows[index].get(date) ?? null])) });
  }
  return days;
}
