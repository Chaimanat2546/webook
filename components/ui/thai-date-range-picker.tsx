"use client"

import { CalendarDaysIcon } from "lucide-react"
import { th } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface ThaiDateRangePickerProps {
  portalContainer?: HTMLElement | null;
  onChange: (range: DateRange | undefined) => void;
  value: DateRange | undefined;
}

const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });

function formatRange(value: DateRange | undefined): string {
  if (!value?.from) return "เลือกช่วงวันที่";
  if (!value.to) return thaiDate.format(value.from);
  return `${thaiDate.format(value.from)} – ${thaiDate.format(value.to)}`;
}

export function ThaiDateRangePicker({ onChange, portalContainer, value }: ThaiDateRangePickerProps) {
  return <Popover>
    <PopoverTrigger aria-label="ช่วงวันที่เข้าพัก" render={<Button className="h-8 w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground" data-empty={!value?.from} type="button" variant="outline" />}>
      <CalendarDaysIcon aria-hidden />{formatRange(value)}
    </PopoverTrigger>
    <PopoverContent className="w-auto min-w-0 overflow-hidden bg-background p-0" container={portalContainer} align="start"><Calendar className="rounded-[calc(var(--radius-xl)-1px)]" locale={th} mode="range" onSelect={onChange} selected={value} formatters={{ formatCaption: date => thaiDate.format(date) }} /></PopoverContent>
  </Popover>;
}
