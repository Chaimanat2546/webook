import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireWebsiteAnalyticsAccess } from "../../../../server/auth/website-analytics";
import { loadWebsiteAnalytics } from "../../../../server/services/website-analytics";
import { listAnalyticsSites } from "../../../../server/site-analytics/registry";
import { WebsiteAnalyticsError, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import { parseWebsiteComparisonQuery, previousAnalyticsRange } from "../../../../lib/website-analytics-comparison";
import { loadPreviousWebsitePeriod } from "../../../../server/services/website-analytics-comparison";
import { WebsiteAnalyticsView } from "../../../../components/admin/dashboard/website-analytics/view";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";

export default async function WebsiteAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireWebsiteAnalyticsAccess(); }
  catch (error) {
    if (error instanceof WebsiteAnalyticsError && error.status === 401) redirect("/login");
    if (error instanceof WebsiteAnalyticsError && error.status === 403) notFound();
    throw error;
  }
  const sites = listAnalyticsSites(), now = new Date();
  let query: WebsiteAnalyticsQuery;
  let report: WebsiteAnalyticsReport;
  let compare = false;
  let scope: WebsiteScopeSelection | undefined;
  try {
    const parsed = parseWebsiteComparisonQuery(await searchParams, sites.map(site => site.key), now);
    query = parsed.query;
    compare = parsed.compare;
    scope = parsed.scope;
    // Overview always starts at the highest-ranked houses; paging belongs to the full list.
    if (query.view !== "houses") query = { ...query, sort: undefined, search: undefined, page: 1, pages: {} };
    if (compare && query.view !== "houses") query = { ...query, granularity: "day" };
    report = await loadWebsiteAnalytics(query, { now: () => now });
  } catch (error) {
    if (!(error instanceof WebsiteAnalyticsError) || error.status !== 400) throw error;
    return <div role="alert" className="space-y-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">ตัวกรองสถิติไม่ถูกต้อง</h1><p>กรุณาเลือกเดือน เว็บไซต์ หรือเลขหน้าใหม่</p><Link className="underline" href="/admin/dashboard/websites">กลับหน้าสถิติ</Link></div>;
  }
  const comparisonRange = scope?.comparison ?? previousAnalyticsRange({ from: report.period.from_date, to: report.period.to_date });
  const previous = compare && comparisonRange ? await loadPreviousWebsitePeriod(query, report.period, { sites: () => sites }, { ...comparisonRange, sites: sites.map(site => site.key) }) : undefined;
  return <WebsiteAnalyticsView report={report} query={query} compare={compare} previous={previous} scope={scope} sites={sites.map(({ key, displayName }) => ({ key, displayName }))} />;
}
