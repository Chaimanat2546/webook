import type { AnalyticsPeriod, AnalyticsSite } from "../../lib/website-analytics.ts";
export const sites: AnalyticsSite[] = [
  { key: "fluknasapoolvilla", siteId: "ce440408-3844-4a06-a5ae-56a4fac8acf8", displayName: "NASA", origin: "https://nasapoolvilla.com" },
  { key: "villamediapoolvilla", siteId: "f216699f-30cc-4076-822c-88657ca4efda", displayName: "Pukmood", origin: "https://pukmoodpoolvilla.com" },
];
export const period: AnalyticsPeriod = { from_date: "2026-10-01", to_date: "2026-10-01", timezone: "Asia/Bangkok", as_of: "2026-10-01T06:00:00.000Z", contract_version: "1.0", villa_id: null };
export function source(site = sites[0], query = period) {
  const metrics = { page_views: 4, phone_clicks: 3, chat_clicks: 0, line_clicks: 2, gallery_opens: 1 };
  const zero = { page_views: 0, phone_clicks: 0, chat_clicks: 0, line_clicks: 0, gallery_opens: 0 };
  return { site_id: site.siteId, contract_version: "1.0", query, generated_at: query.as_of,
    coverage: { data_available_from: "2026-09-01T00:00:00Z", range_complete: true, rows_complete: true },
    totals: metrics, unattributed: zero, daily: [{ ...metrics, date: query.from_date }], villas: [{ ...metrics, villa_id: "9" }] };
}
