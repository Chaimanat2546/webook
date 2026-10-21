"use client"

import { useState, type ReactNode } from "react"
import { CalendarDaysIcon, XIcon } from "lucide-react"
import { th } from "date-fns/locale"
import type { DateRange, Matcher } from "react-day-picker"

import { useIsMobile } from "../../hooks/use-mobile"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./sheet"

import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface ThaiDateRangePickerProps {
  className?: string;
  portalContainer?: HTMLElement | null;
  onChange: (range: DateRange | undefined) => void;
  value: DateRange | undefined;
  label?: string;
  disabled?: Matcher | Matcher[];
  autoApply?: boolean;
  confirmSelection?: boolean;
  loading?: boolean;
  renderSelection?: (draft: DateRange | undefined, selectDraft: (range: DateRange) => void, portalContainer?: HTMLElement | null) => ReactNode;
  canConfirm?: (draft: DateRange | undefined) => boolean;
  onOpenChange?: (open: boolean) => void;
  valueSuffix?: string;
  triggerContent?: ReactNode;
  renderShortcuts?: (select: (range: DateRange) => void, custom: () => void, draft: DateRange | undefined) => ReactNode;
}

const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });

function formatRange(value: DateRange | undefined): string {
  if (!value?.from) return "เลือกช่วงวันที่";
  if (!value.to || value.from.getTime() === value.to.getTime()) return thaiDate.format(value.from);
  return `${thaiDate.format(value.from)} – ${thaiDate.format(value.to)}`;
}

export function ThaiDateRangePicker({ onChange, className = "", portalContainer, value, label = "ช่วงวันที่เข้าพัก", disabled, autoApply = false, confirmSelection = false, loading = false, renderShortcuts, renderSelection, canConfirm, onOpenChange, valueSuffix, triggerContent }: ThaiDateRangePickerProps) {
  const isMobile = useIsMobile();
  const [sheetContainer, setSheetContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [month, setMonth] = useState<Date | undefined>(value?.from);
  const buffered = autoApply || confirmSelection;
  function commit(range: DateRange) {
    setOpen(false);
    onChange(range);
  }
  function choose(range: DateRange) {
    setDraft(range);
    setChoosingEnd(false);
    if (!confirmSelection) commit(range);
  }
  function selectRange(next: DateRange | undefined, day: Date) {
    if (!buffered) { onChange(next); return; }
    if (!choosingEnd || !draft?.from) {
      setDraft({ from: day });
      setChoosingEnd(true);
      return;
    }
    const completed = day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day };
    choose(completed);
  }
  const pickerContent = <>
      <div className="flex flex-col sm:flex-row">
        {renderShortcuts && <div className="border-b sm:border-r sm:border-b-0">{renderShortcuts(range => { setMonth(range.from); choose(range); }, () => { setDraft(undefined); setChoosingEnd(false); }, draft)}</div>}
        <div className="min-w-0"><Calendar className="relative mx-auto rounded-[calc(var(--radius-xl)-1px)]" locale={th} mode="range" disabled={disabled} month={month} onMonthChange={setMonth} onSelect={selectRange} selected={buffered ? draft : value} formatters={{ formatCaption: date => thaiDate.format(date) }} />{buffered && <p role="status" className="px-3 pb-3 text-xs text-muted-foreground">{choosingEnd ? "เลือกวันสิ้นสุด" : confirmSelection && draft?.from && draft.to ? formatRange(draft) : "เลือกวันเริ่มต้น"}</p>}{renderSelection?.(draft, next => { setMonth(next.from); choose(next); }, isMobile ? sheetContainer : portalContainer)}</div>
      </div>
      {confirmSelection && <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-3">
        <Button type="button" variant="ghost" onClick={() => { setDraft(value); setChoosingEnd(false); setOpen(false); }}>ยกเลิก</Button>
        <Button type="button" disabled={loading || !draft?.from || !draft.to || choosingEnd || (canConfirm && !canConfirm(draft))} onClick={() => { if (draft?.from && draft.to) commit(draft); }}>ใช้</Button>
      </div>}
  </>;
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange?.(next); setDraft(value); setMonth(value?.from); setChoosingEnd(false); };
  if (isMobile) return <Sheet open={open} onOpenChange={changeOpen}>
    <SheetTrigger asChild><Button aria-label={label} disabled={loading} className={`h-8 w-full min-w-0 justify-start border-field-border bg-field-background text-left font-normal disabled:bg-muted data-[empty=true]:text-muted-foreground dark:border-field-border dark:bg-field-background dark:disabled:bg-muted ${className}`} data-thai-date-range-picker="" data-empty={!value?.from} type="button" variant="outline">{triggerContent ?? <><CalendarDaysIcon aria-hidden /><span className="truncate" title={`${formatRange(value)}${valueSuffix ? ` · ${valueSuffix}` : ""}`}>{formatRange(value)}{valueSuffix && ` · ${valueSuffix}`}</span></>}</Button></SheetTrigger>
    <SheetContent ref={setSheetContainer} side="bottom" showCloseButton={false} className="max-h-[90dvh] gap-0 overflow-hidden rounded-t-3xl bg-background p-0 pb-[env(safe-area-inset-bottom)]">
      <div className="shrink-0 border-b px-4 pt-2 pb-3"><div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-foreground/25" /><div className="flex items-start justify-between gap-3"><div><SheetTitle>{label}</SheetTitle><SheetDescription className="mt-1 text-xs">{confirmSelection ? "เลือกช่วงวันที่ แล้วกดใช้เพื่อยืนยัน" : "เลือกวันเริ่มต้นและวันสิ้นสุด"}</SheetDescription></div><SheetClose asChild><Button type="button" variant="ghost" size="icon" aria-label="ปิดตัวเลือกวันที่"><XIcon aria-hidden className="size-4" /></Button></SheetClose></div></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">{pickerContent}</div>
    </SheetContent>
  </Sheet>;
  return <Popover modal open={open} onOpenChange={next => { setOpen(next); onOpenChange?.(next); setDraft(value); setMonth(value?.from); setChoosingEnd(false); }}>
    <PopoverTrigger aria-label={label} disabled={loading} render={<Button className={`h-8 w-full min-w-0 justify-start border-field-border bg-field-background text-left font-normal disabled:bg-muted data-[empty=true]:text-muted-foreground dark:border-field-border dark:bg-field-background dark:disabled:bg-muted ${className}`} data-thai-date-range-picker="" data-empty={!value?.from} type="button" variant="outline" />}>
      {triggerContent ?? <><CalendarDaysIcon aria-hidden /><span className="truncate" title={`${formatRange(value)}${valueSuffix ? ` · ${valueSuffix}` : ""}`}>{formatRange(value)}{valueSuffix && ` · ${valueSuffix}`}</span></>}
    </PopoverTrigger>
    <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] min-w-0 max-h-[min(90dvh,var(--available-height))] overflow-y-auto bg-background p-0" container={portalContainer} align="start">
      {pickerContent}
    </PopoverContent>
  </Popover>;
}
