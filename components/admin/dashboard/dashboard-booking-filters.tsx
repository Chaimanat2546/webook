"use client";

import { type FormEvent, useState } from "react";
import type { DateRange } from "react-day-picker";
import { ListFilterIcon, SearchIcon, SlidersHorizontalIcon, TagIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DASHBOARD_BOOKING_SORTS, DASHBOARD_STATUSES, type DashboardBookingsQuery } from "../../../lib/dashboard";
import { dashboardBookingsHref } from "../../../lib/dashboard-routes";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Sheet, SheetContent, SheetTrigger } from "../../ui/sheet";
import { ThaiDateRangePicker } from "../../ui/thai-date-range-picker";
import { ThaiMonthPicker } from "../../ui/thai-month-picker";
import { DashboardListToolbar } from "./dashboard-list-toolbar";

interface DashboardBookingFiltersProps {
  query: DashboardBookingsQuery;
  href?: (changes: Partial<DashboardBookingsQuery>) => string;
}

const bookingStatusOptions = [{ value: "all", label: "ทุกสถานะ" }, ...DASHBOARD_STATUSES];

interface DashboardBookingAdvancedFiltersPanelProps {
  datePickerPortalContainer?: HTMLElement | null;
  query?: DashboardBookingsQuery;
  onFiltersApply?: (changes: Partial<DashboardBookingsQuery>) => void;
  onClose: () => void;
  showBookingControls?: boolean;
}

export function DashboardBookingAdvancedFiltersPanel({ datePickerPortalContainer, query, onFiltersApply, onClose, showBookingControls = false }: DashboardBookingAdvancedFiltersPanelProps) {
  const [amountFrom, setAmountFrom] = useState(() => amountValue(query?.amountFromCents));
  const [amountTo, setAmountTo] = useState(() => amountValue(query?.amountToCents));
  const [checkInRange, setCheckInRange] = useState<DateRange | undefined>(() => query?.checkInFrom && query.checkInTo ? { from: localDate(query.checkInFrom), to: localDate(query.checkInTo) } : undefined);
  const [status, setStatus] = useState<DashboardBookingsQuery["status"]>(query?.status ?? "confirmed");
  const [sort, setSort] = useState<DashboardBookingsQuery["sort"]>(query?.sort ?? "updated-desc");

  function clear() {
    setAmountFrom("");
    setAmountTo("");
    setCheckInRange(undefined);
    setStatus("confirmed");
    setSort("updated-desc");
  }

  function apply() {
    onFiltersApply?.({
      ...dateRangeChanges(checkInRange?.from && checkInRange.to ? checkInRange : undefined),
      amountFromCents: amountCents(amountFrom),
      amountToCents: amountCents(amountTo),
      ...(showBookingControls ? { status, sort } : {}),
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
    <fieldset className="space-y-2"><legend className="text-sm font-medium">ช่วงยอดจอง (บาท)</legend><div className="flex items-center gap-2"><Input aria-label="ยอดจองต่ำสุด" inputMode="decimal" onChange={event => setAmountFrom(event.target.value)} placeholder="ขั้นต่ำ" type="text" value={amountFrom} /><span aria-hidden className="text-muted-foreground">–</span><Input aria-label="ยอดจองสูงสุด" inputMode="decimal" onChange={event => setAmountTo(event.target.value)} placeholder="สูงสุด" type="text" value={amountTo} /></div></fieldset>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">ช่วงวันที่เข้าพัก</legend><ThaiDateRangePicker onChange={setCheckInRange} portalContainer={datePickerPortalContainer} value={checkInRange} /></fieldset>
    <Button className="w-full" onClick={apply} type="button">ใช้ตัวกรอง</Button>
  </div>;
}

export function DashboardBookingFilters({ query, href }: DashboardBookingFiltersProps) {
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
    <div className="w-full min-w-0 pb-1 md:overflow-x-auto">
      <div className="flex w-full min-w-0 gap-2 md:min-w-max">
        <ThaiMonthPicker all={Boolean(query.checkInFrom)} className="h-8 flex-1 min-w-0 text-sm md:flex-none" month={query.month} onMonthChange={month => navigate({ month, checkInFrom: undefined, checkInTo: undefined })} />
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

function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function dateRangeChanges(range: DateRange | undefined): Pick<DashboardBookingsQuery, "checkInFrom" | "checkInTo"> {
  if (!range?.from || !range.to) return { checkInFrom: undefined, checkInTo: undefined };
  return { checkInFrom: dateValue(range.from), checkInTo: dateValue(range.to) };
}

function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
