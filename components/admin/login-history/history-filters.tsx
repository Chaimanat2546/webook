"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CalendarDaysIcon, Search, SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "../../../hooks/use-mobile";
import { LOCATION_STATUS_LABELS, LoginHistoryError, parseHistoryFilter } from "../../../lib/login-history";
import { historyHref, type HistoryParams } from "../../../lib/login-history-view";
import type { AnalyticsDateRange } from "../../../lib/website-analytics";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { WebsiteDateRangePicker } from "../dashboard/website-analytics/website-date-range-picker";
import { useHistoryNavigation } from "./history-navigation";

interface HistoryFiltersProps { params: HistoryParams; dateError?: boolean; disabled?: boolean }
function calendarDate(value?: string): Date | undefined {
  if (!value) return undefined;
  try { parseHistoryFilter({from:value}); } catch { return undefined; }
  const [year,month,day] = value.split("-").map(Number);
  return new Date(year,month-1,day);
}
function initialRange(params:HistoryParams): AnalyticsDateRange | null {
  try {
    parseHistoryFilter({from:params.from,to:params.to,timeFrom:params.timeFrom,timeTo:params.timeTo});
    return params.from && params.to ? {from:params.from,to:params.to,timeFrom:params.timeFrom,timeTo:params.timeTo} : null;
  } catch { return null; }
}
const thaiDay = new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"numeric"});

export function HistoryFilters({ params, dateError = false, disabled = false }: HistoryFiltersProps) {
  const mobile = useIsMobile();
  const navigation = useHistoryNavigation();
  const [search, setSearch] = useState(params.q ?? "");
  const [range, setRange] = useState<AnalyticsDateRange | null>(() => initialRange(params));
  const [today] = useState(() => new Date(Date.now() + 7 * 3600000).toISOString().slice(0,10));
  const [error, setError] = useState(dateError);
  const [filterError, setFilterError] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(params.status ?? "");
  const [sort, setSort] = useState(params.sort === "oldest" ? "oldest" : "latest");
  const dateGroup = useRef<HTMLDivElement>(null);
  const dateTouched = useRef(false);
  const dateMessage = "ช่วงวันที่หรือเวลาไม่ถูกต้อง กรุณาเลือกใหม่";
  const partialDate = !range && Boolean(params.from) !== Boolean(params.to) ? calendarDate(params.from || params.to) : undefined;
  useEffect(() => { if (dateError) dateGroup.current?.querySelector("button")?.focus(); }, [dateError,mobile]);

  function apply(event?: FormEvent, fromSheet = false, selectedRange = range) {
    event?.preventDefault();
    const next = { ...params, q:search.trim(), from:dateTouched.current ? selectedRange?.from : params.from, to:dateTouched.current ? selectedRange?.to : params.to, timeFrom:dateTouched.current ? selectedRange?.timeFrom : params.timeFrom, timeTo:dateTouched.current ? selectedRange?.timeTo : params.timeTo, status:fromSheet ? status : params.status, sort:fromSheet ? sort : params.sort, page:undefined };
    try { parseHistoryFilter(next); }
    catch (failure) {
      const dateFailure = failure instanceof LoginHistoryError && failure.reason === "invalid_date";
      setError(dateFailure);setFilterError(!dateFailure);setOpen(false);
      if (dateFailure) requestAnimationFrame(() => dateGroup.current?.querySelector("button")?.focus());
      return;
    }
    setError(false);setFilterError(false);setOpen(false);navigation.navigate(historyHref(next));
  }
  function changeOpen(value:boolean) { setStatus(params.status ?? "");setSort(params.sort === "oldest" ? "oldest" : "latest");setOpen(value); }
  const options = <div className="space-y-6">
    <div className="space-y-3"><h3 id="history-status-label" className="text-sm font-semibold">สถานะตำแหน่ง</h3>
      <RadioGroup aria-labelledby="history-status-label" value={status} onValueChange={setStatus} className="grid-cols-1 gap-2">
        {[["","ทั้งหมด"],...["success","pending","skipped","denied","unavailable","timeout","unsupported"].map(value => [value,LOCATION_STATUS_LABELS[value as keyof typeof LOCATION_STATUS_LABELS]])].map(([value,label]) => <Label key={value} className="flex min-h-9 cursor-pointer gap-3 rounded-lg px-2 font-normal"><RadioGroupItem value={value} />{label}</Label>)}
      </RadioGroup>
    </div>
    <div className="space-y-3"><h3 id="history-order-label" className="text-sm font-semibold">เรียงตามเวลาเข้าสู่ระบบ</h3><RadioGroup aria-labelledby="history-order-label" value={sort} onValueChange={setSort}>
      <Label className="flex min-h-9 gap-3 px-2 font-normal"><RadioGroupItem value="latest" />ล่าสุดก่อน</Label>
      <Label className="flex min-h-9 gap-3 px-2 font-normal"><RadioGroupItem value="oldest" />เก่าสุดก่อน</Label>
    </RadioGroup></div>
    <Button type="button" className="h-11 w-full" onClick={() => apply(undefined,true)}>ใช้ตัวกรอง</Button>
  </div>;
  const filterLabel = <><SlidersHorizontal aria-hidden className="size-4" />ตัวกรอง{params.status ? <span className="size-1.5 rounded-full bg-primary" aria-label="มีตัวกรองที่ใช้งาน" /> : null}</>;

  return <form method="get" action="/admin/login-history" onSubmit={apply} className="space-y-2.5" aria-label="ค้นหาและกรองประวัติ">
    <div className="relative"><Label htmlFor="history-search" className="sr-only">ค้นหาชื่อหรืออีเมล</Label><Search aria-hidden className="absolute top-3 left-3 size-4 text-muted-foreground" />
      <Input id="history-search" name="q" value={search} onChange={event => setSearch(event.target.value)} maxLength={200} placeholder="ค้นหาชื่อหรืออีเมล" disabled={disabled} className="h-10 rounded-lg bg-card pr-11 pl-9" />
      <Button type="submit" aria-label="ค้นหาประวัติ" variant="ghost" size="icon" disabled={disabled} className="absolute top-0 right-0 size-10 text-primary-text"><Search aria-hidden className="size-4" /></Button>
    </div>
    <div className="flex items-start gap-2">
      <div ref={dateGroup} role="group" aria-label="ช่วงวันที่เข้าสู่ระบบ" className={`min-w-0 flex-1 rounded-lg ${error ? "ring-1 ring-destructive" : ""}`}>
        <WebsiteDateRangePicker
          label="ช่วงวันที่เข้าสู่ระบบ"
          month={today.slice(0,7)}
          today={today}
          range={range}
          singleDayTimeDescription="กรองเวลาเข้าสู่ระบบ"
          triggerContent={partialDate ? <><CalendarDaysIcon aria-hidden /><span className="truncate">{params.from ? "ตั้งแต่" : "ถึง"} {thaiDay.format(partialDate)}</span></> : undefined}
          invalid={error}
          describedBy={error ? "history-date-error" : undefined}
          loading={disabled || navigation.pending}
          onChange={next => {
            dateTouched.current=true;
            setRange(next);
            apply(undefined,false,next);
          }}
          className="h-10 rounded-lg"
        />
      </div>
      {mobile ? <Sheet open={open} onOpenChange={changeOpen}><SheetTrigger asChild><Button type="button" variant="outline" disabled={disabled} className="h-10 rounded-lg bg-card text-primary-text">{filterLabel}</Button></SheetTrigger><SheetContent side="bottom" className="audit-theme max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5"><SheetHeader className="px-0"><SheetTitle>ตัวกรองประวัติ</SheetTitle><SheetDescription>เลือกสถานะตำแหน่งและลำดับรายการ</SheetDescription></SheetHeader>{options}</SheetContent></Sheet>
        : <Popover open={open} onOpenChange={changeOpen}><PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} className="h-10 rounded-lg bg-card text-primary-text">{filterLabel}</Button>} /><PopoverContent className="audit-theme w-80 rounded-xl bg-card p-5" align="end">{options}</PopoverContent></Popover>}
    </div>
    {error ? <p id="history-date-error" role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle aria-hidden className="size-4 shrink-0" />{dateMessage}</p> : null}
    {filterError ? <p role="alert" className="text-xs text-destructive">ตัวกรองไม่ถูกต้อง กรุณาเลือกใหม่</p> : null}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {params.status && Object.hasOwn(LOCATION_STATUS_LABELS,params.status) ? <span>{LOCATION_STATUS_LABELS[params.status as keyof typeof LOCATION_STATUS_LABELS]}</span> : null}
      {params.sort === "oldest" ? <span>เก่าสุดก่อน</span> : null}
      {params.q || params.from || params.to || params.timeFrom || params.timeTo || params.status || params.sort === "oldest" ? <Button type="button" variant="link" className="h-auto px-0 py-1 text-xs" onClick={() => navigation.navigate("/admin/login-history")}>ล้างตัวกรอง</Button> : null}
    </div>
  </form>;
}
