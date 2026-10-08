import "server-only";
import { addMetrics, emptyMetrics, type AnalyticsMonth, type AnalyticsPeriod, type AnalyticsSite, type SiteReportResult } from "../../lib/website-analytics.ts";

export async function loadMonthlyHistory(sites: AnalyticsSite[], period: AnalyticsPeriod, current: Map<string, SiteReportResult>, read: (site: AnalyticsSite, period: AnalyticsPeriod) => Promise<SiteReportResult>): Promise<AnalyticsMonth[]> {
  const end = new Date(`${period.from_date}T00:00:00Z`);
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7));
  const start = Date.parse(`${months[0]}-01T00:00:00Z`), last = Date.parse(period.from_date) - 86400000;
  const ranges: AnalyticsPeriod[] = [];
  for (let day = start; day <= last; day += 90 * 86400000) ranges.push({ ...period, from_date: new Date(day).toISOString().slice(0, 10), to_date: new Date(Math.min(last, day + 89 * 86400000)).toISOString().slice(0, 10) });
  const jobs = sites.flatMap(site => ranges.map(range => ({ site, range })));
  const results: { range: AnalyticsPeriod; result: SiteReportResult }[] = [];
  let next = 0;
  async function work() {
    while (next < jobs.length) {
      const { site, range } = jobs[next++];
      let result: SiteReportResult;
      try { result = await read(site, range); } catch { result = { ok: false, reason: "unavailable" }; }
      results.push({ range, result });
    }
  }
  await Promise.all([work(), work()]);
  for (const site of sites) results.push({ range: period, result: current.get(site.key) ?? { ok: false, reason: "unavailable" } });
  return months.map(month => {
    let totals = emptyMetrics(), available = false, complete = true, failed = false;
    for (const { range, result } of results) {
      if (range.from_date.slice(0, 7) > month || range.to_date.slice(0, 7) < month) continue;
      if (!result.ok) { complete = false; failed = true; continue; }
      const [year, number] = month.split("-").map(Number);
      const monthEnd = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
      const to = range.to_date < monthEnd ? range.to_date : monthEnd;
      const coverageStart = Date.parse(result.report.coverage.data_available_from);
      const exclusiveEnd = Math.min(Date.parse(`${to}T00:00:00+07:00`) + 86400000, Date.parse(period.as_of));
      if (coverageStart >= exclusiveEnd) { complete = false; continue; }
      available = true;
      const from = range.from_date > `${month}-01` ? range.from_date : `${month}-01`;
      if (!result.report.coverage.rows_complete || Date.parse(result.report.coverage.data_available_from) > Date.parse(`${from}T00:00:00+07:00`)) complete = false;
      for (const day of result.report.daily) if (day.date.startsWith(month)) totals = addMetrics(totals, day);
    }
    return { date: month, page_views: available ? totals.page_views : null, contact_clicks: available ? totals.contact_clicks : null, status: !available ? failed ? "unavailable" : "no_data" : complete ? "complete" : "partial" };
  });
}
