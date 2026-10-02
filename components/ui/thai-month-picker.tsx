"use client";

import { useState } from "react";
import { CalendarDaysIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { MAX_GREGORIAN_YEAR, MIN_GREGORIAN_YEAR, parseThaiMonth, THAI_MONTH_NAMES, thaiMonthValue } from "../../lib/thai-month";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

export interface ThaiMonthPickerProps {
  all?: boolean;
  className?: string;
  month: string;
  onMonthChange: (month: string) => void;
}

const MIN_BUDDHIST_YEAR = MIN_GREGORIAN_YEAR + 543;
const MAX_BUDDHIST_YEAR = MAX_GREGORIAN_YEAR + 543;

export function ThaiMonthPicker({ all = false, className, month, onMonthChange }: ThaiMonthPickerProps) {
  const selected = parseThaiMonth(month);
  const [year, setYear] = useState(selected.year);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="เลือกเดือน" className={cn("h-11 min-w-48 justify-between px-3 text-base", className)} data-thai-month-picker disabled={all} type="button" variant="outline">
          <span className="flex items-center gap-2"><CalendarDaysIcon aria-hidden className="size-4" />{all ? "ทุกเดือน" : `${THAI_MONTH_NAMES[selected.month - 1]} ${selected.year}`}</span>
          <ChevronDownIcon aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3" sideOffset={8}>
        <div className="mb-3 flex items-center justify-between">
          <Button aria-label="ปีก่อนหน้า" disabled={year === MIN_BUDDHIST_YEAR} onClick={() => setYear((current) => current - 1)} size="icon-sm" type="button" variant="ghost"><ChevronLeftIcon aria-hidden /></Button>
          <span aria-live="polite" className="font-medium">{year}</span>
          <Button aria-label="ปีถัดไป" disabled={year === MAX_BUDDHIST_YEAR} onClick={() => setYear((current) => current + 1)} size="icon-sm" type="button" variant="ghost"><ChevronRightIcon aria-hidden /></Button>
        </div>
        <div aria-label={`เลือกเดือน ปี ${year}`} className="grid grid-cols-3 gap-1" role="group">
          {THAI_MONTH_NAMES.map((name, index) => {
            const monthNumber = index + 1;
            const active = selected.year === year && selected.month === monthNumber;
            return <DropdownMenuItem aria-current={active ? "true" : undefined} className={`min-h-11 justify-center px-2 text-center ${active ? "bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground" : ""}`} key={name} onSelect={() => onMonthChange(thaiMonthValue({ month: monthNumber, year }))}>{name}</DropdownMenuItem>;
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
