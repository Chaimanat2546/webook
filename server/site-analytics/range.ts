import "server-only";
import { atOrAfterAnalyticsTimestamp } from "../../lib/website-analytics-time.ts";
import { addMetrics, type AnalyticsPeriod, type AnalyticsSite, type AnalyticsVilla, type SiteReportResult, type SourceReport } from "../../lib/website-analytics.ts";

// Upstream reports accept at most 90 inclusive days. Keep one snapshot and
// sequential chunks per site; the caller already bounds site concurrency.
export async function readSiteRange(site: AnalyticsSite, period: AnalyticsPeriod, read: (site: AnalyticsSite, period: AnalyticsPeriod) => Promise<SiteReportResult>): Promise<SiteReportResult> {
  if (period.contract_version === "1.1") return read(site, period);
  const end = Date.parse(period.to_date);
  let combined: SourceReport | undefined;
  const villas = new Map<string, AnalyticsVilla>();
  for (let start = Date.parse(period.from_date); start <= end; start += 90 * 86400000) {
    const chunk = { ...period, from_date: new Date(start).toISOString().slice(0, 10), to_date: new Date(Math.min(end, start + 89 * 86400000)).toISOString().slice(0, 10) };
    const result = await read(site, chunk);
    // Do not present incomplete chunk totals as a successful range total.
    if (!result.ok) return result;
    const report = result.report;
    for (const villa of report.villas) {
      const previous = villas.get(villa.villa_id);
      villas.set(villa.villa_id, previous ? { ...addMetrics(previous, villa), villa_id: villa.villa_id } : villa);
    }
    if (!combined) combined = { ...report, daily: [...report.daily], coverage: { ...report.coverage } };
    else {
      combined.totals = addMetrics(combined.totals, report.totals);
      combined.unattributed = addMetrics(combined.unattributed, report.unattributed);
      combined.daily.push(...report.daily);
      combined.coverage.range_complete &&= report.coverage.range_complete;
      combined.coverage.rows_complete &&= report.coverage.rows_complete;
      if (!atOrAfterAnalyticsTimestamp(combined.coverage.data_available_from, report.coverage.data_available_from)) {
        combined.coverage.data_available_from = report.coverage.data_available_from;
        combined.coverage.range_complete = false;
      }
    }
  }
  return combined ? { ok: true, report: { ...combined, villas: [...villas.values()] } } : { ok: false, reason: "invalid_report" };
}
