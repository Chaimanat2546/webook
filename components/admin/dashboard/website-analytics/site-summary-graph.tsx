"use client";

import { useState, type ReactNode } from "react";
import { ChartColumn, ChevronDown, Grid2X2, SlidersHorizontal, TrendingUp, XIcon } from "lucide-react";
import type { AnalyticsDateRange, WebsiteSummary } from "../../../../lib/website-analytics";
import type { WebsiteChartMetric } from "../../../../lib/website-analytics-chart";
import { useIsMobile } from "../../../../hooks/use-mobile";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "../../../ui/sheet";
import { Button } from "../../../ui/button";
import { WebsiteSiteSummaryChart } from "./site-summary-chart";
import { WebsiteSiteTrendChart } from "./site-trend-chart";
import { SitePeriodComparison } from "./site-period-comparison";
import type { WebsitePreviousPeriod } from "../../../../lib/website-analytics-comparison";
import { dashboardAnalyticsFilterParams, type WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import { WebsiteChartLegend } from "./website-chart-legend";
import { useDatasetVisibility } from "./use-dataset-visibility";
import { AllSitesTrend } from "./all-sites-trend";
import { WebsiteChartLoading, useWebsiteAnalyticsPending } from "./analytics-loading";
import { WebsiteMobileFilterActions, WebsiteMobileFilterDraftContext, type WebsiteMobileFilterPeriod } from "./mobile-filter-draft";

interface WebsiteSiteSummaryGraphProps {
  granularity: "hour" | "day";
  sites: WebsiteSummary[];
  month: string;
  range?: AnalyticsDateRange;
  asOf?: string;
  compare?: boolean;
  previous?: WebsitePreviousPeriod;
  today?: string;
  scope?: WebsiteScopeSelection;
  mobileControls?: ReactNode;
  mobileOverview?: boolean;
}

export function WebsiteSiteSummaryGraph({ granularity, sites, month, range, asOf, compare = false, previous, scope, mobileControls, mobileOverview = false }: WebsiteSiteSummaryGraphProps) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"daily" | "total" | "combined">("daily");
  const [metric, setMetric] = useState<WebsiteChartMetric>("page_views");
  const pending = useWebsiteAnalyticsPending();
  const visibility = useDatasetVisibility(sites, previous?.sites ?? [], scope);
  const appliedPeriod: WebsiteMobileFilterPeriod | undefined = range ? { range, comparison: compare && previous ? { ...previous.range, sites: scope?.comparison?.sites ?? previous.sites.map(site => site.key) } : undefined } : undefined;
  const [draftView, setDraftView] = useState(view);
  const [draftMetric, setDraftMetric] = useState(metric);
  const [draftPeriod, setDraftPeriod] = useState(appliedPeriod);
  const viewLabel = view === "total" ? "ยอดรวมแต่ละเว็บ" : view === "combined" ? "ภาพรวมทุกเว็บ" : `กราฟ${granularity === "hour" ? "รายชั่วโมง" : "รายวัน"}`;
  const description = `${viewLabel} · ${metric === "page_views" ? "เข้าชม" : metric === "contact_clicks" ? "กดติดต่อรวม" : "เปิดรูป"} · ${sites.length} เว็บไซต์ · ${compare ? "กำลังเปรียบเทียบ" : "ยังไม่เปรียบเทียบ"}`;

  function changeFiltersOpen(next: boolean) {
    if (next) {
      setDraftView(view);
      setDraftMetric(metric);
      setDraftPeriod(appliedPeriod);
    }
    setFiltersOpen(next);
  }

  function applyFilters(): string | undefined {
    setView(draftView);
    setMetric(draftMetric);
    setFiltersOpen(false);
    if (!draftPeriod || JSON.stringify(draftPeriod) === JSON.stringify(appliedPeriod)) return;
    const selection: WebsiteScopeSelection = { sites: scope?.sites ?? sites.map(site => site.key), ...(draftPeriod.comparison ? { comparison: draftPeriod.comparison } : {}) };
    return `/admin/dashboard?${dashboardAnalyticsFilterParams(new URLSearchParams(window.location.search), month, draftPeriod.range, selection)}`;
  }

  const controls = <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="มุมมองกราฟเว็บไซต์" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Button type="button" disabled={pending} variant={view === "daily" ? "default" : "ghost"} aria-pressed={view === "daily"} onClick={() => setView("daily")}>{granularity === "hour" ? "แนวโน้มรายชั่วโมง" : "แนวโน้มรายวัน"}</Button>
        <Button type="button" disabled={pending} variant={view === "total" ? "default" : "ghost"} aria-pressed={view === "total"} onClick={() => setView("total")}>ยอดรวมแต่ละเว็บ</Button>
        <Button type="button" variant={view === "combined" ? "default" : "ghost"} aria-pressed={view === "combined"} disabled={pending || !range || !asOf} onClick={() => setView("combined")}>แนวโน้มรวมทุกเว็บ</Button>
      </div>
      {(view !== "total" || compare) && <div role="group" aria-label={compare ? "เลือกสถิติเปรียบเทียบ" : granularity === "hour" ? "เลือกสถิติรายชั่วโมง" : "เลือกสถิติรายวัน"} className="flex flex-wrap gap-1">
        {([
          ["contact_clicks", "กดติดต่อรวม"],
          ["page_views", "เข้าชม"],
          ["gallery_opens", "เปิดรูป"],
        ] as const).map(([key, label]) => <Button key={key} type="button" disabled={pending} variant={metric === key ? "default" : "outline"} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</Button>)}
      </div>}
    </div>;
  return <div className="min-w-0" data-dashboard-website-graph={mobileOverview || undefined}>
    {mobileOverview ? <><Sheet open={filtersOpen && isMobile} onOpenChange={changeFiltersOpen}><SheetTrigger asChild><Button type="button" variant="outline" className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-full border-primary/25 bg-primary/5 px-4 text-sm font-semibold text-primary-text shadow-none md:hidden"><SlidersHorizontal aria-hidden className="size-4" /><span className="flex-1 text-left">ตัวกรองและเปรียบเทียบ</span><ChevronDown aria-hidden className="size-4" /></Button></SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-3xl bg-background p-0 pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 border-b px-4 pt-2 pb-3"><div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-foreground/25" /><div className="flex items-start justify-between gap-3"><div><SheetTitle className="text-sm font-semibold">ตัวกรองและเปรียบเทียบ</SheetTitle><SheetDescription className="mt-1 text-[11px]">เลือกตัวกรอง แล้วกดใช้เพื่อเปลี่ยนกราฟ</SheetDescription></div><SheetClose asChild><Button type="button" variant="ghost" size="icon" aria-label="ปิดตัวกรองและเปรียบเทียบ"><XIcon aria-hidden className="size-4" /></Button></SheetClose></div></div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4">
          <section><h3 className="mb-2 text-xs font-semibold">มุมมองกราฟ</h3><div role="group" aria-label="มุมมองกราฟเว็บไซต์" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
            {([{ value: "daily", label: granularity === "hour" ? "กราฟรายชั่วโมง" : "กราฟรายวัน", icon: TrendingUp }, { value: "total", label: "ยอดรวมแต่ละเว็บ", icon: ChartColumn }, { value: "combined", label: "ภาพรวมทุกเว็บ", icon: Grid2X2 }] as const).map(({ value, label, icon: Icon }) => <Button key={value} type="button" variant="ghost" disabled={pending || (value === "combined" && (!range || !asOf))} aria-pressed={draftView === value} onClick={() => setDraftView(value)} className="h-auto min-h-11 min-w-0 gap-1 rounded-xl px-1 py-2 text-[10px] whitespace-normal aria-pressed:bg-primary aria-pressed:text-primary-foreground"><Icon aria-hidden className="size-3.5 shrink-0" /><span>{label}</span></Button>)}
          </div></section>
          {(draftView !== "total" || Boolean(draftPeriod?.comparison)) && <section><h3 className="mb-2 text-xs font-semibold">สถิติที่แสดง</h3><div role="group" aria-label="เลือกสถิติในกราฟ" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">{([["page_views", "เข้าชม"], ["contact_clicks", "กดติดต่อรวม"], ["gallery_opens", "เปิดรูป"]] as const).map(([key, label]) => <Button key={key} type="button" disabled={pending} variant="ghost" aria-pressed={draftMetric === key} onClick={() => setDraftMetric(key)} className="min-w-0 rounded-xl px-1 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground">{label}</Button>)}</div></section>}
          {mobileControls && <section className="space-y-3 border-t pt-4"><h3 className="text-xs font-semibold">ช่วงวันที่และการเปรียบเทียบ</h3><WebsiteMobileFilterDraftContext.Provider value={draftPeriod ? { ...draftPeriod, onRangeChange: next => setDraftPeriod(current => current ? { ...current, range: next } : current), onComparisonChange: comparison => setDraftPeriod(current => current ? { ...current, comparison } : current) } : null}>{mobileControls}</WebsiteMobileFilterDraftContext.Provider></section>}
        </div>
        <WebsiteMobileFilterActions onApply={applyFilters} onCancel={() => changeFiltersOpen(false)} />
      </SheetContent></Sheet><p className="mb-4 text-xs text-muted-foreground md:hidden">{description}</p><div className="hidden md:block">{controls}</div></> : controls}
    <WebsiteChartLoading>{view === "combined" && range && asOf ? <AllSitesTrend granularity={granularity} sites={sites} range={range} asOf={asOf} metric={metric} previous={compare ? previous : undefined} /> : compare && range && asOf && previous ? <SitePeriodComparison granularity={granularity} sites={sites} range={range} asOf={asOf} previous={previous} view={view === "total" ? "total" : "daily"} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} /> : <>
      {compare && <p role="status" className="mb-3 text-sm text-amber-700">ช่วงก่อนหน้าอยู่นอกวันที่ที่ระบบรองรับ ยังแสดงกราฟช่วงที่เลือกได้ตามปกติ</p>}
      {view === "total" ? <WebsiteSiteSummaryChart sites={sites.filter(site => !visibility.hidden.includes(site.key))} month={month} range={range} legend={<WebsiteChartLegend sites={sites} availableSites={sites.filter(site => site.totals !== null).map(site => site.key)} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />} /> : <WebsiteSiteTrendChart granularity={granularity} asOf={asOf} sites={sites} month={month} range={range} metric={metric} hiddenSites={visibility.hidden} onToggleSite={visibility.toggle} />}
    </>}</WebsiteChartLoading>
  </div>;
}
