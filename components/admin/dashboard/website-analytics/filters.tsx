"use client";

import { Input } from "../../../ui/input";
import { SearchIcon, ListFilterIcon } from "lucide-react";
import { DashboardListToolbar } from "../dashboard-list-toolbar";
import { useRouter } from "next/navigation";
import { WEBSITE_ANALYTICS_SORTS, websiteAnalyticsHref, type WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { ReportDateRangePicker } from "../report-date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";

export interface WebsiteOption { key: string; displayName: string }
export function WebsiteAnalyticsFilters({ query, sites, today }: { query: WebsiteAnalyticsQuery; sites: WebsiteOption[]; today: string }) {
  const router = useRouter();
  const full = query.view === "houses";
  const controls = <div className={full ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-end gap-2"}>
    <div className={full ? "min-w-0 max-w-full" : "grid min-w-0 max-w-full gap-1"}><span className={full ? "sr-only" : "sr-only sm:not-sr-only sm:text-sm sm:font-medium"}>ช่วงวันที่</span><ReportDateRangePicker className={full ? "h-8 w-auto max-w-full text-sm" : "w-auto min-w-0 max-w-full"} month={query.month} today={today} pastOnly range={query.from && query.to ? { from: query.from, to: query.to } : undefined} onChange={range => router.push(websiteAnalyticsHref(query, { ...range, granularity: "day" }))} /></div>
    <div className={full ? "order-first w-full min-w-0 md:order-none md:w-64" : "grid min-w-0 max-w-full gap-1 sm:w-72"}><label htmlFor="analytics-site" className={full ? "sr-only" : "sr-only sm:not-sr-only sm:text-sm sm:font-medium"}>เว็บไซต์</label>
      <Select value={query.site} onValueChange={site => { if (site) router.push(websiteAnalyticsHref(query, { site })); }}>
        <SelectTrigger id="analytics-site" className={full ? "w-full" : "w-full"}><SelectValue>{sites.find(site => site.key === query.site)?.displayName}</SelectValue></SelectTrigger>
        <SelectContent>{sites.map(site => <SelectItem key={site.key} value={site.key}>{site.displayName}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {query.view === "houses" && <div className="min-w-0 max-w-full md:w-56"><label htmlFor="analytics-sort" className="sr-only">เรียงตาม</label>
      <Select value={query.sort ?? "contacts"} onValueChange={value => { const sort = WEBSITE_ANALYTICS_SORTS.find(option => option.value === value)?.value; if (sort) router.push(websiteAnalyticsHref(query, { sort })); }}>
        <SelectTrigger id="analytics-sort" className="w-full"><ListFilterIcon aria-hidden className="size-4 text-muted-foreground" /><SelectValue>{WEBSITE_ANALYTICS_SORTS.find(option => option.value === (query.sort ?? "contacts"))?.label}</SelectValue></SelectTrigger>
        <SelectContent>{WEBSITE_ANALYTICS_SORTS.map(option => <SelectItem key={option.value} value={option.value}>{option.label} · {option.direction}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
  </div>;
  const toolbar = full ? <DashboardListToolbar onSubmit={event => { event.preventDefault(); const search = new FormData(event.currentTarget).get("search"); router.push(websiteAnalyticsHref(query, { search: typeof search === "string" ? search.trim() : "" })); }}>
    <div className="relative w-full"><SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="ค้นหาบ้าน" className="h-11 pl-9 pr-11" name="search" type="search" maxLength={100} placeholder="ค้นหาชื่อบ้านหรือรหัสบ้าน..." defaultValue={query.search ?? ""} /><button type="submit" aria-label="ค้นหา" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"><SearchIcon aria-hidden className="size-4" /></button></div>
    {controls}</DashboardListToolbar> : controls;
  return <div className="space-y-2">{query.from && <p className="text-xs text-muted-foreground">ช่วงวันที่: {query.from} – {query.to} · เวลาไทย</p>}{toolbar}</div>;
}
