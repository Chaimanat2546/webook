import { parseDashboardQuery } from "../../../../lib/dashboard";
import { loadWebsiteSummaryPeriods } from "../../../../server/services/website-analytics-comparison";
import { WebsiteSiteSummary } from "./site-summary";
import { analyticsPeriodGranularity, analyticsDateRange, type AnalyticsDateRange } from "../../../../lib/website-analytics";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { listAnalyticsSites } from "../../../../server/site-analytics/registry";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../ui/empty";

// Mounted only after the dashboard has authorized an admin scope.
export async function WebsiteSiteSummaryLoader({ month, range, compare = false, scope }: { month: string; range?: AnalyticsDateRange; compare?: boolean; scope?: WebsiteScopeSelection }) {
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
  const now = new Date();
  const query = { month, ...range, site: "all", page: 1, granularity: "day" as const };
  const options = listAnalyticsSites().map(({ key, displayName }) => ({ key, displayName }));
  // Fetch available series once per range. Website buttons only change graph visibility.
  const allKeys = options.map(site => site.key);
  const readScope = scope ? { sites: allKeys, ...(scope.comparison ? { comparison: { ...scope.comparison, sites: allKeys } } : {}) } : undefined;
  const { sites, period, previous } = await loadWebsiteSummaryPeriods(query, compare, { now: () => now }, readScope);
  const selectedRange = analyticsDateRange(period);
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  return <WebsiteSiteSummary granularity={analyticsPeriodGranularity(period)} sites={sites} month={month} range={selectedRange} today={today} asOf={period.as_of} compare={scope ? Boolean(scope.comparison) : compare} previous={previous} scope={scope} options={options} />;
}
