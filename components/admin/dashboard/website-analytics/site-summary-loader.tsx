import { parseDashboardQuery } from "../../../../lib/dashboard";
import { loadWebsiteAnalytics } from "../../../../server/services/website-analytics";
import { listAnalyticsSites } from "../../../../server/site-analytics/registry";
import { WebsiteSiteSummary } from "./site-summary";
import { analyticsPeriod, type AnalyticsDateRange, type WebsiteSummary } from "../../../../lib/website-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

// Mounted only after the dashboard has authorized an admin scope.
export async function WebsiteSiteSummaryLoader({ month, range }: { month: string; range?: AnalyticsDateRange }) {
  const currentMonth = parseDashboardQuery({}).month;
  if (month > currentMonth && !range) return <Card>
    <CardHeader><CardTitle><h2>แนวโน้มประสิทธิภาพเว็บไซต์</h2></CardTitle></CardHeader>
    <CardContent><Empty className="min-h-60 border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ChartNoAxesColumnIncreasing aria-hidden /></EmptyMedia>
        <EmptyTitle>ยังไม่มีข้อมูลสถิติ</EmptyTitle>
        <EmptyDescription>ยังไม่มีสถิติสำหรับเดือนในอนาคต</EmptyDescription>
      </EmptyHeader>
    </Empty></CardContent>
  </Card>;
  const sites = listAnalyticsSites();
  const now = new Date();
  const query = { month, ...range, site: "all", page: 1, granularity: "day" as const };
  const period = analyticsPeriod(query, now);
  const selectedRange = { from: period.from_date, to: period.to_date };
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  if (!sites.length) return <WebsiteSiteSummary sites={[]} month={month} range={selectedRange} today={today} />;
  let summaries: WebsiteSummary[];
  try {
    const report = await loadWebsiteAnalytics(query, { now: () => now, sites: () => sites, titles: async () => new Map() });
    summaries = report.websites;
  } catch {
    summaries = sites.map(site => ({ key: site.key, displayName: site.displayName, origin: site.origin, status: "unavailable", totals: null, coverage: null }));
  }
  return <WebsiteSiteSummary sites={summaries} month={month} range={selectedRange} today={today} />;
}
