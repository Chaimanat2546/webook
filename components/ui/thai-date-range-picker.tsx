"use client"

import { useState, type ReactNode } from "react"
import { CalendarDaysIcon } from "lucide-react"
import { th } from "date-fns/locale"
import type { DateRange, Matcher } from "react-day-picker"

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
  renderShortcuts?: (select: (range: DateRange) => void, custom: () => void, draft: DateRange | undefined) => ReactNode;
}

const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });

function formatRange(value: DateRange | undefined): string {
  if (!value?.from) return "เลือกช่วงวันที่";
  if (!value.to) return thaiDate.format(value.from);
  return `${thaiDate.format(value.from)} – ${thaiDate.format(value.to)}`;
}

export function ThaiDateRangePicker({ onChange, className = "", portalContainer, value, label = "ช่วงวันที่เข้าพัก", disabled, autoApply = false, confirmSelection = false, loading = false, renderShortcuts }: ThaiDateRangePickerProps) {
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
  return <Popover modal open={open} onOpenChange={next => { setOpen(next); setDraft(value); setMonth(value?.from); setChoosingEnd(false); }}>
    <PopoverTrigger aria-label={label} disabled={loading} render={<Button className={`h-8 w-full min-w-0 justify-start border-field-border bg-field-background text-left font-normal disabled:bg-muted data-[empty=true]:text-muted-foreground dark:border-field-border dark:bg-field-background dark:disabled:bg-muted ${className}`} data-thai-date-range-picker="" data-empty={!value?.from} type="button" variant="outline" />}>
      <CalendarDaysIcon aria-hidden /><span className="truncate">{formatRange(value)}</span>
    </PopoverTrigger>
    <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] min-w-0 max-h-[min(90dvh,var(--available-height))] overflow-y-auto bg-background p-0" container={portalContainer} align="start">
      <div className="flex flex-col sm:flex-row">
        {renderShortcuts && <div className="border-b sm:border-r sm:border-b-0">{renderShortcuts(range => { setMonth(range.from); choose(range); }, () => { setDraft(undefined); setChoosingEnd(false); }, draft)}</div>}
        <div className="min-w-0"><Calendar className="relative mx-auto rounded-[calc(var(--radius-xl)-1px)]" locale={th} mode="range" disabled={disabled} month={month} onMonthChange={setMonth} onSelect={selectRange} selected={buffered ? draft : value} formatters={{ formatCaption: date => thaiDate.format(date) }} />{buffered && <p role="status" className="px-3 pb-3 text-xs text-muted-foreground">{choosingEnd ? "เลือกวันสิ้นสุด" : confirmSelection && draft?.from && draft.to ? formatRange(draft) : "เลือกวันเริ่มต้น"}</p>}</div>
      </div>
      {confirmSelection && <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-3">
        <Button type="button" variant="ghost" onClick={() => { setDraft(value); setChoosingEnd(false); setOpen(false); }}>ยกเลิก</Button>
        <Button type="button" disabled={loading || !draft?.from || !draft.to || choosingEnd} onClick={() => { if (draft?.from && draft.to) commit(draft); }}>ใช้</Button>
      </div>}
    </PopoverContent>
  </Popover>;
}
