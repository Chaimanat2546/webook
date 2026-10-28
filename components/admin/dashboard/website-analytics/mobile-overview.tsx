"use client";

import Link from "next/link";
import { ChevronRight, Eye, Images, Phone } from "lucide-react";
import { useIsMobile } from "../../../../hooks/use-mobile";
import { analyticsDateRange, analyticsPeriodGranularity, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import { websitePeriodHref } from "../../../../lib/website-analytics-comparison";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { Card, CardContent } from "../../../ui/card";
import { WebsiteMobileOverviewControls } from "./mobile-overview-controls";
import { WebsiteMobileOverviewTrend } from "./mobile-overview-trend";
import { MobileRanking } from "./mobile-ranking";
import type { WebsiteOption } from "./filters";
import { isFutureAnalyticsRange } from "../../../../lib/website-analytics-time";
import { labels } from "./table-metrics";

function SectionTitle({ title }: { title: string }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex min-w-0 items-center gap-2 text-base font-semibold"><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-primary" />{title}</h2></div>;
}

export function WebsiteAnalyticsMobileOverview({ report, query, sites, scope, compare = false, backHref = "/admin/dashboard" }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery; sites: WebsiteOption[]; scope?: WebsiteScopeSelection; compare?: boolean; backHref?: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  const advanced = compare || query.granularity === "month";
  const controls = <WebsiteMobileOverviewControls report={report} query={query} sites={sites} scope={scope} compare={compare} showPeriod={!advanced} backHref={!advanced ? backHref : undefined} />;
  if (advanced) return <div className="md:hidden">{controls}</div>;
  const count = (key: keyof NonNullable<WebsiteAnalyticsReport["totals"]>) => report.totals?.[key].toLocaleString("th-TH") ?? "—";
  const range = analyticsDateRange(report.period);
  const date = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  const periodLabel = date.formatRange(new Date(`${range.from}T00:00:00+07:00`), new Date(`${range.to}T00:00:00+07:00`));
  return <div data-website-mobile-overview className="min-w-0 pb-8 md:hidden">
    {controls}
    <div className="space-y-7">
    {report.availableSites < report.selectedSites && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">บางเว็บไซต์โหลดไม่ได้ กรุณาลองใหม่</p>}
    {isFutureAnalyticsRange(range, report.period.as_of) && <p role="status" className="text-sm text-muted-foreground">ยังไม่ถึงช่วงเวลาที่เลือก</p>}
    <section aria-label="ภาพรวมการติดต่อ"><SectionTitle title="ภาพรวมการติดต่อ" />
      <Card className="rounded-3xl py-5 shadow-none"><CardContent className="px-5">
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">กดติดต่อรวม</p><Phone aria-hidden className="size-5 text-primary-text" /></div>
        <p className="mt-3 text-4xl leading-tight font-bold tabular-nums text-primary-text">{count("contact_clicks")} <span className="text-lg font-normal text-muted-foreground">ครั้ง</span></p>
        <p className="mt-1 text-xs text-muted-foreground">โทร · LINE · แชท</p>
        <dl className="mt-5 grid grid-cols-3 divide-x border-t pt-4 text-center">{([["phone_clicks", "โทร"], ["line_clicks", "LINE"], ["chat_clicks", "แชท"]] as const).map(([key, label]) => <div key={key} className="min-w-0 px-1"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums text-primary-text">{count(key)}</dd></div>)}</dl>
      </CardContent></Card>
      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><p className="inline-flex items-center gap-1.5"><Eye aria-hidden className="size-4" />ยอดเข้าชม <strong className="tabular-nums text-foreground">{count("page_views")}</strong> ครั้ง</p><p className="inline-flex items-center gap-1.5"><Images aria-hidden className="size-4" />เปิดรูป <strong className="tabular-nums text-foreground">{count("gallery_opens")}</strong> ครั้ง</p></div>
    </section>
    <section aria-label="แนวโน้มการติดต่อ"><SectionTitle title="แนวโน้มการติดต่อ" /><p className="mb-3 text-xs text-muted-foreground">{analyticsPeriodGranularity(report.period) === "hour" ? "รายชั่วโมง" : "รายวัน"} · {periodLabel}</p><WebsiteMobileOverviewTrend report={report} query={query} scope={scope} /></section>
    <section aria-label="บ้านที่มีการกดติดต่อสูงสุด"><SectionTitle title="บ้านที่มีการกดติดต่อสูงสุด" /><p className="mb-4 text-xs text-muted-foreground">เรียงตามจำนวนการติดต่อ · {periodLabel}</p>
      {report.websites.map(site => <div key={site.key}>
        {report.websites.length > 1 && <h3 className="mt-4 text-sm font-semibold">{site.displayName}</h3>}
        {site.villas ? <MobileRanking site={site} presentation="overview" /> : <p role="status" className="py-4 text-sm text-muted-foreground">ยังแสดงข้อมูลบ้านไม่ได้ · {labels[site.status]}</p>}
        {site.villas && site.villas.total > 0 && <Link href={websitePeriodHref(query, { site: site.key, view: "houses", granularity: "day", page: 1, pages: {} }, false, scope)} className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-primary-text">ดูบ้านทั้งหมด<ChevronRight aria-hidden className="size-4" /></Link>}
      </div>)}
    </section>
    </div>
  </div>;
}
