"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { analyticsDateRange, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import { websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { AdminMobileBrandHeader } from "../../../layout/admin-mobile-brand-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { WebsiteDateRangePicker } from "./website-date-range-picker";
import { useWebsiteAnalyticsTransition } from "./analytics-loading";
import type { WebsiteOption } from "./filters";

export function WebsiteMobileOverviewControls({ report, query, sites, scope, compare = false, showPeriod = true, backHref }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery; sites: WebsiteOption[]; scope?: WebsiteScopeSelection; compare?: boolean; showPeriod?: boolean; backHref?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  const range = analyticsDateRange(report.period);
  const today = new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 10);
  const date = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  const navigate = (changes: Partial<WebsiteAnalyticsQuery>) => startTransition(() => router.replace(websitePeriodHref(query, changes, compare, scope), { scroll: false }));
  const subtitle = <Select disabled={pending} value={query.site} onValueChange={site => { if (site) navigate({ site, page: 1, pages: {} }); }}>
    <SelectTrigger aria-label="เลือกเว็บไซต์" className="h-5 min-h-0 w-full min-w-0 gap-1 border-0 bg-transparent p-0 text-[10px] text-muted-foreground shadow-none dark:bg-transparent"><SelectValue>{`สถิติเว็บไซต์ · ${sites.find(site => site.key === query.site)?.displayName ?? report.websites[0]?.displayName ?? "เว็บไซต์"}`}</SelectValue></SelectTrigger>
    <SelectContent>{sites.map(site => <SelectItem key={site.key} value={site.key}>{site.displayName}</SelectItem>)}</SelectContent>
  </Select>;
  return <>
    <AdminMobileBrandHeader subtitle={subtitle} asOf={report.period.as_of} className="-mx-4 -mt-5" />
    {backHref && <Link href={backHref} className="flex min-h-11 items-center gap-2 pt-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />กลับไปภาพรวม</Link>}
    {showPeriod && <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 py-3">
      <CalendarDays aria-hidden className="col-start-1 row-span-2 row-start-1 size-5 text-primary" />
      <h1 className="col-start-2 row-start-1 min-w-0 text-xs leading-relaxed font-semibold">{date.formatRange(new Date(`${range.from}T00:00:00+07:00`), new Date(`${range.to}T00:00:00+07:00`))}</h1>
      <WebsiteDateRangePicker month={range.to.slice(0, 7)} range={range} today={today} pastOnly loading={pending} label="เปลี่ยนช่วงสถิติเว็บไซต์" triggerContent={<>เปลี่ยนช่วง<ChevronDown aria-hidden className="size-3" /></>} className="col-start-3 row-span-2 row-start-1 h-9 w-auto rounded-full px-3 text-xs" onChange={next => navigate({ ...next, month: next.to.slice(0, 7), granularity: "day", page: 1, pages: {} })} />
      <p className="col-start-2 row-start-2 text-[11px] leading-relaxed text-muted-foreground">เวลาไทย · <span className="whitespace-nowrap">{range.timeFrom ?? "00:00"}–{range.timeTo ?? "24:00"}</span></p>
    </div>}
  </>;
}
