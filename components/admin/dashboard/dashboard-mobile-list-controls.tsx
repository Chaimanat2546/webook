"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownUp, CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { DASHBOARD_AGENCY_LIST_SORTS, DASHBOARD_HOUSE_LIST_SORTS, type DashboardAgenciesQuery, type DashboardHousesQuery } from "../../../lib/dashboard";
import { dashboardAgenciesHref, dashboardHousesHref } from "../../../lib/dashboard-routes";
import type { AnalyticsDateRange } from "../../../lib/website-analytics";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { WebsiteDateRangePicker } from "./website-analytics/website-date-range-picker";

type ListQuery = DashboardAgenciesQuery & DashboardHousesQuery;
interface ListProps { query: ListQuery; kind: "agencies" | "houses" }
interface ListChanges { search?: string; sort?: string; dateFrom?: string; dateTo?: string; timeFrom?: string; timeTo?: string }
function configuration(query: ListQuery, kind: ListProps["kind"]) {
  return kind === "houses" ? { entity: "บ้าน", placeholder: "ค้นหาชื่อบ้าน รหัส DV...", sort: query.houseSort ?? "created-desc", options: DASHBOARD_HOUSE_LIST_SORTS } : { entity: "เอเจนซี่", placeholder: "ค้นหาชื่อเอเจนซี่...", sort: query.agencySort ?? "sales-desc", options: DASHBOARD_AGENCY_LIST_SORTS };
}
function listHref(query: ListQuery, kind: ListProps["kind"], changes: ListChanges) {
  const { sort, ...rest } = changes;
  if (kind === "houses") return dashboardHousesHref(query, { ...rest, ...(sort ? { houseSort: DASHBOARD_HOUSE_LIST_SORTS.find(item => item.value === sort)?.value } : {}) });
  return dashboardAgenciesHref(query, { ...rest, ...(sort ? { agencySort: DASHBOARD_AGENCY_LIST_SORTS.find(item => item.value === sort)?.value } : {}) });
}

function periodRange(query: ListQuery): AnalyticsDateRange {
  const [year, month] = query.month.split("-").map(Number);
  return { from: query.dateFrom ?? `${query.month}-01`, to: query.dateTo ?? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10), timeFrom: query.timeFrom, timeTo: query.timeTo };
}

export function DashboardMobileListControls({ query, kind }: ListProps) {
  const config = configuration(query, kind);
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const range = periodRange(query);
  const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); router.push(listHref(query, kind, { search: search.trim() })); }
  return <div className="mb-4 space-y-3 md:hidden">
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5"><CalendarDays aria-hidden className="size-5 shrink-0 text-primary-text" /><div className="min-w-0"><h1 className="text-sm font-semibold text-primary-text">{formatter.formatRange(new Date(`${range.from}T00:00:00+07:00`), new Date(`${range.to}T00:00:00+07:00`))}</h1><p className="text-xs text-muted-foreground">เวลาไทย · {range.timeFrom && (range.timeFrom !== "00:00" || range.timeTo !== "24:00") ? `${range.timeFrom}–${range.timeTo}` : "ทั้งวัน"}</p></div></div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" aria-label={`ตัวกรอง${config.entity}`} className="h-10 shrink-0 gap-2 rounded-full bg-card px-3 text-sm text-primary-text shadow-none"><SlidersHorizontal aria-hidden className="size-4" />ตัวกรอง</Button></SheetTrigger>
        <SheetContent ref={setContainer} side="bottom" showCloseButton={false} className="max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetTitle>ตัวกรอง{config.entity}</SheetTitle><SheetDescription>เลือกช่วงวันที่และการเรียงลำดับ แล้วกดใช้ตัวกรอง</SheetDescription>
          <ListFilterDraft kind={kind} query={query} container={container} onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
    <form className="relative" onSubmit={submit}><Input aria-label={`ค้นหา${config.entity}`} name="search" type="search" placeholder={config.placeholder} value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-xl bg-card pr-4 pl-10 text-sm shadow-sm" /><button type="submit" aria-label={`ค้นหา${config.entity}`} className="absolute inset-y-0 left-1 flex w-9 items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-2"><Search aria-hidden className="size-4" /></button></form>
  </div>;
}

function ListFilterDraft({ query, kind, container, onClose }: ListProps & { container: HTMLElement | null; onClose: () => void }) {
  const config = configuration(query, kind);
  const router = useRouter();
  const [range, setRange] = useState(() => periodRange(query));
  const [sort, setSort] = useState<string>(config.sort);
  return <div className="mt-4 space-y-4">
    <div className="space-y-2"><p className="text-sm font-medium">{kind === "houses" ? "ช่วงวันที่เพิ่มบ้าน" : "ช่วงวันที่อัปเดตการจอง"}</p><WebsiteDateRangePicker month={query.month} range={range} portalContainer={container} label={`ช่วงวันที่${config.entity}`} onChange={setRange} /></div>
    <div className="space-y-2"><p className="text-sm font-medium">เรียงลำดับ</p><Select items={config.options} value={sort} onValueChange={value => { if (value) setSort(value); }}><SelectTrigger aria-label={`เรียงลำดับในตัวกรอง${config.entity}`} className="w-full"><SelectValue /></SelectTrigger><SelectContent container={container}>{config.options.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={() => { router.push(listHref(query, kind, { dateFrom: range.from, dateTo: range.to, timeFrom: range.timeFrom, timeTo: range.timeTo, sort })); onClose(); }}>ใช้ตัวกรอง</Button></div>
  </div>;
}

export function DashboardMobileListResults({ query, kind, total, page = query.page, pageSize }: ListProps & { total: number; page?: number; pageSize?: number }) {
  const config = configuration(query, kind);
  const router = useRouter();
  return <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-2 text-xs md:hidden"><p className="font-semibold text-primary-text">{pageSize && total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} จาก ${total.toLocaleString("th-TH")}` : total.toLocaleString("th-TH")} รายการ</p><Select items={config.options} value={config.sort} onValueChange={sort => { if (sort) router.push(listHref(query, kind, { sort })); }}><SelectTrigger aria-label={`เรียงผล${config.entity}`} className="h-8 w-auto gap-1 border-0 bg-transparent px-0 text-[11px] text-muted-foreground shadow-none [&>svg:last-child]:hidden"><ArrowDownUp aria-hidden className="size-3" /><SelectValue /></SelectTrigger><SelectContent align="end">{config.options.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}
