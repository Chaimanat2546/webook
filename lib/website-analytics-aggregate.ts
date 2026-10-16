import type { AnalyticsDateRange, WebsiteSummary } from "./website-analytics.ts";
import type { WebsiteChartMetric } from "./website-analytics-chart.ts";
import { websitePeriodSeries, type WebsitePeriodSeries } from "./website-analytics-comparison.ts";

export interface WebsiteAggregatePeriod extends WebsitePeriodSeries {
  selectedSites: number;
  availableSites: number;
  pointSiteCounts: Record<string, number>;
}

/** Sum observed values only; a missing source never becomes a confirmed zero. */
export function aggregateWebsitePeriod(sites: WebsiteSummary[], range: AnalyticsDateRange, asOf: string, metric: WebsiteChartMetric, granularity: "hour" | "day"): WebsiteAggregatePeriod {
  const sources = sites.map(site => websitePeriodSeries(site, range, asOf, metric, granularity));
  const template = sources[0] ?? websitePeriodSeries(undefined, range, asOf, metric, granularity);
  const pointSiteCounts: Record<string, number> = {};
  const daily = template.daily.map((point, index) => {
    const values = sources.map(source => source.daily[index]?.value ?? null).filter((value): value is number => value !== null);
    pointSiteCounts[point.date] = values.length;
    return { date: point.date, value: values.length ? values.reduce((sum, value) => sum + value, 0) : null };
  });
  const totals = sources.flatMap(source => source.total === null ? [] : [source.total]);
  const coverageComplete = sources.length > 0 && sources.every(source => source.coverageComplete);
  const status = !totals.length ? "unavailable" : sources.some(source => source.status === "ongoing") ? "ongoing" : coverageComplete ? "complete" : "partial";
  return { ...template, daily, total: totals.length ? totals.reduce((sum, value) => sum + value, 0) : null, availableDays: daily.filter(point => point.value !== null).length, coverageComplete, status, selectedSites: sites.length, availableSites: totals.length, pointSiteCounts };
}
