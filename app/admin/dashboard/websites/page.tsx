import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireWebsiteAnalyticsAccess } from "../../../../server/auth/website-analytics";
import { loadWebsiteAnalytics } from "../../../../server/services/website-analytics";
import { listAnalyticsSites } from "../../../../server/site-analytics/registry";
import { parseWebsiteAnalyticsQuery, WebsiteAnalyticsError } from "../../../../lib/website-analytics";
import { WebsiteAnalyticsView } from "../../../../components/admin/dashboard/website-analytics/view";

export default async function WebsiteAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireWebsiteAnalyticsAccess(); }
  catch (error) {
    if (error instanceof WebsiteAnalyticsError && error.status === 401) redirect("/login");
    if (error instanceof WebsiteAnalyticsError && error.status === 403) notFound();
    throw error;
  }
  const sites = listAnalyticsSites(), now = new Date();
  let query, report;
  try {
    query = parseWebsiteAnalyticsQuery(await searchParams, sites.map(site => site.key), now, { singleSite: true });
    // Overview always starts at the highest-ranked houses; paging belongs to the full list.
    if (query.view !== "houses") query = { ...query, sort: undefined, search: undefined, page: 1, pages: {} };
    report = await loadWebsiteAnalytics(query, { now: () => now });
  } catch (error) {
    if (!(error instanceof WebsiteAnalyticsError) || error.status !== 400) throw error;
    return <div role="alert" className="space-y-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">ตัวกรองสถิติไม่ถูกต้อง</h1><p>กรุณาเลือกเดือน เว็บไซต์ หรือเลขหน้าใหม่</p><Link className="underline" href="/admin/dashboard/websites">กลับหน้าสถิติ</Link></div>;
  }
  return <WebsiteAnalyticsView report={report} query={query} sites={sites.map(({ key, displayName }) => ({ key, displayName }))} />;
}
