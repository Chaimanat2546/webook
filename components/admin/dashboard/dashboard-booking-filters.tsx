"use client";

import { type FormEvent, useState } from "react";
import { ArrowDownUp, ChevronDown, Filter, ListFilterIcon, SearchIcon, SlidersHorizontalIcon, TagIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DASHBOARD_BOOKING_SORTS, DASHBOARD_STATUSES, dashboardDate, type DashboardBookingsQuery } from "../../../lib/dashboard";
import { dashboardBookingsHref } from "../../../lib/dashboard-routes";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { WebsiteDateRangePicker } from "./website-analytics/website-date-range-picker";
import { DashboardListToolbar } from "./dashboard-list-toolbar";

interface DashboardBookingFiltersProps {
  query: DashboardBookingsQuery;
  mobileRedesign?: boolean;
  href?: (changes: Partial<DashboardBookingsQuery>) => string;
}

const bookingStatusOptions = [{ value: "all", label: "ทุกสถานะ" }, ...DASHBOARD_STATUSES];

export function DashboardBookingFilters(props: DashboardBookingFiltersProps) {
  if (!props.mobileRedesign) return <DashboardBookingStandardFilters {...props} />;
  return <><div className="hidden md:block"><DashboardBookingStandardFilters {...props} /></div><DashboardBookingMobileFilters {...props} /></>;
}

function bookingPeriodLabel(query: DashboardBookingsQuery): string {
  const [year, month] = query.month.split("-").map(Number);
  const from = query.dateFrom ?? `${query.month}-01`;
  const to = query.dateTo ?? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return `${dashboardDate(`${from}T00:00:00+07:00`)} – ${dashboardDate(`${to}T00:00:00+07:00`)}`;
}

function DashboardBookingMobileFilters({ query, href }: DashboardBookingFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const count = Number(query.status !== "all") + Number(Boolean(query.dateFrom)) + Number(query.amountFromCents !== undefined || query.amountToCents !== undefined) + Number(Boolean(query.checkInFrom)) + Number(Boolean(query.timeFrom && (query.timeFrom !== "00:00" || query.timeTo !== "24:00")));
  const navigate = (changes: Partial<DashboardBookingsQuery>) => router.push(href ? href(changes) : dashboardBookingsHref(query, changes));
  return <div className="mb-5 space-y-2.5 md:hidden">
    <form className="relative" onSubmit={event => { event.preventDefault(); navigate({ search: search.trim() }); }}>
      <Input aria-label="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" name="search" type="search" placeholder="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-full border-border bg-card pr-4 pl-11 text-xs shadow-none dark:border-border" />
      <button type="submit" aria-label="ค้นหา" className="absolute inset-y-0 left-1 flex w-10 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-2"><SearchIcon aria-hidden className="size-4" /></button>
    </form>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button type="button" variant="outline" className="h-12 w-full justify-start gap-3 rounded-full border-border bg-card px-4 text-xs shadow-none dark:border-border"><SlidersHorizontalIcon aria-hidden className="size-4" /><span className="font-semibold">ค้นหาและตัวกรอง</span>{count > 0 && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}<span className="ml-auto font-normal text-muted-foreground" aria-label="ตัวกรองที่ใช้">{count} ตัวกรอง</span><ChevronDown aria-hidden className="size-4 text-muted-foreground" /></Button></SheetTrigger>
      <SheetContent ref={setContainer} side="bottom" showCloseButton={false} className="max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetTitle className="sr-only">ค้นหาและตัวกรองรายการจอง</SheetTitle><SheetDescription className="sr-only">เลือกช่วงวัน สถานะ การเรียงลำดับ และยอดจอง แล้วกดใช้ตัวกรอง</SheetDescription>
        <DashboardBookingAdvancedFiltersPanel key={JSON.stringify(query)} datePickerPortalContainer={container} query={query} showBookingControls showPeriod onFiltersApply={navigate} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
    <p className="flex items-start gap-2 rounded-full border border-border/70 bg-muted/70 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-border dark:bg-muted"><Filter aria-hidden className="mt-0.5 size-3 shrink-0" /><span>{bookingPeriodLabel(query)} · {bookingStatusOptions.find(item => item.value === query.status)?.label} · {DASHBOARD_BOOKING_SORTS.find(item => item.value === query.sort)?.label}{query.timeFrom && ` · ทุกวัน ${query.timeFrom}–${query.timeTo}`}{query.checkInFrom && ` · เข้าพัก ${query.checkInFrom}–${query.checkInTo}`}{(query.amountFromCents !== undefined || query.amountToCents !== undefined) && ` · ยอด ${amountValue(query.amountFromCents) || "0"}–${amountValue(query.amountToCents) || "ไม่จำกัด"} บาท`}</span></p>
  </div>;
}

export function DashboardBookingMobileResults({ query, href, total, page }: DashboardBookingFiltersProps & { total: number; page: number }) {
  const router = useRouter();
  const from = total ? (page - 1) * 9 + 1 : 0;
  return <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs md:hidden"><p className="text-muted-foreground">ผลการค้นหา <span className="font-semibold text-foreground">({from}–{Math.min(page * 9, total)} จาก {total} รายการ)</span></p><Select items={DASHBOARD_BOOKING_SORTS} value={query.sort} onValueChange={sort => { if (sort) router.push(href ? href({ sort }) : dashboardBookingsHref(query, { sort })); }}><SelectTrigger aria-label="เรียงผลการค้นหา" className="h-8 w-auto gap-1 border-0 bg-transparent px-0 text-[11px] text-muted-foreground shadow-none [&>svg:last-child]:hidden"><SelectValue /><ArrowDownUp aria-hidden className="size-3" /></SelectTrigger><SelectContent align="end"><SelectGroup>{DASHBOARD_BOOKING_SORTS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></div>;
}

interface DashboardBookingAdvancedFiltersPanelProps {
  datePickerPortalContainer?: HTMLElement | null;
  query?: DashboardBookingsQuery;
  onFiltersApply?: (changes: Partial<DashboardBookingsQuery>) => void;
  onClose: () => void;
  showBookingControls?: boolean;
  showPeriod?: boolean;
}

export function DashboardBookingAdvancedFiltersPanel({ datePickerPortalContainer, query, onFiltersApply, onClose, showBookingControls = false, showPeriod = false }: DashboardBookingAdvancedFiltersPanelProps) {
  const [period, setPeriod] = useState(() => query?.dateFrom && query.dateTo ? { from: query.dateFrom, to: query.dateTo, timeFrom: query.timeFrom, timeTo: query.timeTo } : undefined);
  const [amountFrom, setAmountFrom] = useState(() => amountValue(query?.amountFromCents));
  const [amountTo, setAmountTo] = useState(() => amountValue(query?.amountToCents));
  const [amountError, setAmountError] = useState(false);
  const [status, setStatus] = useState<DashboardBookingsQuery["status"]>(query?.status ?? "confirmed");
  const [sort, setSort] = useState<DashboardBookingsQuery["sort"]>(query?.sort ?? "updated-desc");

  function clear() {
    setPeriod(undefined);
    setAmountFrom("");
    setAmountTo("");
    setAmountError(false);
    setStatus("confirmed");
    setSort("updated-desc");
  }

  function apply() {
    const from = amountCents(amountFrom), to = amountCents(amountTo);
    if (from !== undefined && to !== undefined && from > to) {
      setAmountError(true);
      return;
    }
    setAmountError(false);
    onFiltersApply?.({
      checkInFrom: undefined,
      checkInTo: undefined,
      amountFromCents: from,
      amountToCents: to,
      ...(showBookingControls ? { status, sort } : {}),
      ...(showPeriod ? { dateFrom: period?.from, dateTo: period?.to, timeFrom: period?.timeFrom, timeTo: period?.timeTo } : {}),
    });
    onClose();
  }

  return <div className="space-y-4 overflow-hidden">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">ตัวกรองเพิ่มเติม</h2>
      <div className="flex items-center gap-1">
        <button className="px-2 py-1 text-xs font-medium text-primary hover:underline" onClick={clear} type="button">ล้างค่า</button>
        <button aria-label="ปิดตัวกรองเพิ่มเติม" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button"><XIcon aria-hidden className="size-4" /></button>
      </div>
    </div>
    {query && showPeriod && <div className="space-y-2"><p className="text-sm font-medium">ช่วงวันที่อัปเดตการจอง</p><WebsiteDateRangePicker month={query.month} range={period} label="ช่วงวันที่อัปเดตการจอง" portalContainer={datePickerPortalContainer} onChange={next => setPeriod({ ...next, timeFrom: next.timeFrom, timeTo: next.timeTo })} /></div>}
    {query && showBookingControls ? <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="mobile-booking-status">สถานะการจอง</label>
        <Select items={bookingStatusOptions} value={status} onValueChange={value => { if (value) setStatus(value); }}>
          <SelectTrigger id="mobile-booking-status" aria-label="สถานะการจอง" className="w-full pl-3">
            <TagIcon aria-hidden className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" container={datePickerPortalContainer}><SelectGroup>{bookingStatusOptions.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="mobile-booking-sort">เรียงลำดับ</label>
        <Select items={DASHBOARD_BOOKING_SORTS} value={sort} onValueChange={value => { if (value) setSort(value); }}>
          <SelectTrigger id="mobile-booking-sort" aria-label="เรียงลำดับ" className="w-full pl-3">
            <ListFilterIcon aria-hidden className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" container={datePickerPortalContainer}><SelectGroup>{DASHBOARD_BOOKING_SORTS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </div>
    </div> : null}
    <fieldset className="space-y-2"><legend className="text-sm font-medium">ช่วงยอดจอง (บาท)</legend><div className="flex items-center gap-2"><Input aria-invalid={amountError} aria-label="ยอดจองต่ำสุด" inputMode="decimal" onChange={event => { setAmountFrom(event.target.value); setAmountError(false); }} placeholder="ขั้นต่ำ" type="text" value={amountFrom} /><span aria-hidden className="text-muted-foreground">–</span><Input aria-invalid={amountError} aria-label="ยอดจองสูงสุด" inputMode="decimal" onChange={event => { setAmountTo(event.target.value); setAmountError(false); }} placeholder="สูงสุด" type="text" value={amountTo} /></div>{amountError ? <p role="alert" className="text-sm text-destructive">ยอดสูงสุดต้องไม่น้อยกว่ายอดต่ำสุด</p> : null}</fieldset>
    <Button className="w-full" onClick={apply} type="button">ใช้ตัวกรอง</Button>
  </div>;
}

function DashboardBookingStandardFilters({ query, href }: DashboardBookingFiltersProps) {
  const router = useRouter();
  const [desktopAdvancedFiltersOpen, setDesktopAdvancedFiltersOpen] = useState(false);
  const [mobileAdvancedFiltersOpen, setMobileAdvancedFiltersOpen] = useState(false);
  const [mobileSheetContent, setMobileSheetContent] = useState<HTMLDivElement | null>(null);
  const [search, setSearch] = useState(query.search);
  const navigate = (changes: Partial<DashboardBookingsQuery>) => router.push(href ? href(changes) : dashboardBookingsHref(query, changes));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ search: search.trim() });
  }

  return <DashboardListToolbar onSubmit={submit}>
    <div className="relative w-full">
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" className="h-11 pl-9 pr-11" name="search" onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อบ้าน รหัส DV ชื่อลูกค้า หรือเอเจนซี่" type="search" value={search} />
      <button aria-label="ค้นหา" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2" type="submit"><SearchIcon aria-hidden className="size-4" /></button>
    </div>
    <div className="w-full min-w-0 pb-1">
      <div className="flex w-full min-w-0 flex-wrap gap-2">
        <WebsiteDateRangePicker className="h-8 w-auto min-w-0 max-w-full flex-none text-sm" month={query.month} label="ช่วงวันที่อัปเดตการจอง" range={query.dateFrom && query.dateTo ? { from: query.dateFrom, to: query.dateTo, timeFrom: query.timeFrom, timeTo: query.timeTo } : undefined} onChange={range => navigate({ dateFrom: range.from, dateTo: range.to, timeFrom: range.timeFrom, timeTo: range.timeTo, checkInFrom: undefined, checkInTo: undefined })} />
        <div className="hidden md:block"><Select items={bookingStatusOptions} value={query.status} onValueChange={status => { if (status) navigate({ status }); }}>
          <SelectTrigger id="booking-status" aria-label="สถานะการจอง" className="pl-3">
            <TagIcon aria-hidden className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start"><SelectGroup>{bookingStatusOptions.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select></div>
        <div className="hidden md:block"><Select items={DASHBOARD_BOOKING_SORTS} value={query.sort} onValueChange={sort => { if (sort) navigate({ sort }); }}>
          <SelectTrigger id="booking-sort" aria-label="เรียงลำดับ" className="pl-3">
            <ListFilterIcon aria-hidden className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start"><SelectGroup>{DASHBOARD_BOOKING_SORTS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select></div>
        <div className="hidden md:block"><Popover onOpenChange={setDesktopAdvancedFiltersOpen} open={desktopAdvancedFiltersOpen}>
          <PopoverTrigger aria-label="ตัวกรองเพิ่มเติม" render={<Button size="default" type="button" variant="outline" />}><SlidersHorizontalIcon aria-hidden />ตัวกรองเพิ่มเติม</PopoverTrigger>
          <PopoverContent className="w-[min(22rem,calc(100vw-2rem))]" align="end"><DashboardBookingAdvancedFiltersPanel query={query} onFiltersApply={navigate} onClose={() => setDesktopAdvancedFiltersOpen(false)} /></PopoverContent>
        </Popover></div>
        <div className="shrink-0 md:hidden"><Sheet onOpenChange={setMobileAdvancedFiltersOpen} open={mobileAdvancedFiltersOpen}>
          <SheetTrigger asChild><Button className="px-2" size="default" type="button" variant="outline"><SlidersHorizontalIcon aria-hidden />ตัวกรองเพิ่มเติม</Button></SheetTrigger>
          <SheetContent className="rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" ref={setMobileSheetContent} showCloseButton={false} side="bottom">
            <div aria-hidden className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <DashboardBookingAdvancedFiltersPanel datePickerPortalContainer={mobileSheetContent} query={query} onFiltersApply={navigate} onClose={() => setMobileAdvancedFiltersOpen(false)} showBookingControls />
          </SheetContent>
        </Sheet></div>
      </div>
    </div>
  </DashboardListToolbar>;
}

function amountCents(value: string): number | undefined {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const [baht, satang = ""] = value.split(".");
  return Number(baht) * 100 + Number(satang.padEnd(2, "0"));
}

function amountValue(cents: number | undefined): string {
  if (cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
