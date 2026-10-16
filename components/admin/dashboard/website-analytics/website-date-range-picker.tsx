"use client";

import { useId, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { parseAnalyticsTimeRange, type AnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { ReportDateRangePicker, type ReportDateRangePickerProps } from "../report-date-range-picker";
import { WebsiteTimeRangeFilter } from "./website-time-range-filter";
import { Button } from "../../../ui/button";

interface WebsiteDateRangePickerProps extends Omit<ReportDateRangePickerProps, "range" | "onChange" | "confirmSelection" | "renderSelection" | "canConfirm" | "onOpenChange" | "valueSuffix"> {
  range?: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
}

const singleDay = (draft: DateRange | undefined) => Boolean(draft?.from && draft.to && draft.from.getTime() === draft.to.getTime());
const fullDay: AnalyticsTimeRange = { timeFrom: "00:00", timeTo: "24:00" };
const hasTimeFilter = (range: AnalyticsDateRange | undefined) => Boolean(range?.timeFrom && range.timeTo && (range.timeFrom !== fullDay.timeFrom || range.timeTo !== fullDay.timeTo));

/** Date and hour edits are drafts until the popup's single Apply action. */
export function WebsiteDateRangePicker({ range, onChange, ...props }: WebsiteDateRangePickerProps) {
  const id = useId();
  const currentTime = (): AnalyticsTimeRange => ({ timeFrom: range?.timeFrom ?? "00:00", timeTo: range?.timeTo ?? "24:00" });
  const [time, setTime] = useState(currentTime);
  const [specifyTime, setSpecifyTime] = useState(() => hasTimeFilter(range));
  function validTime() {
    try { return Boolean(parseAnalyticsTimeRange(time.timeFrom, time.timeTo, { from: "2000-01-01", to: "2000-01-01" })); }
    catch { return false; }
  }
  return <ReportDateRangePicker compactShortcuts {...props} range={range} confirmSelection
    valueSuffix={range ? hasTimeFilter(range) ? `${range.from === range.to ? "" : "ทุกวัน "}${range.timeFrom}–${range.timeTo}` : "เต็มวัน 24 ชั่วโมง" : undefined}
    onOpenChange={open => { if (open) { setTime(currentTime()); setSpecifyTime(hasTimeFilter(range)); } }}
    canConfirm={() => !specifyTime || validTime()}
    renderSelection={draft => draft?.from && draft.to ? <div className="space-y-2 border-t p-3">
      <Button type="button" variant={specifyTime ? "secondary" : "outline"} aria-pressed={specifyTime} disabled={props.loading} onClick={() => {
        setSpecifyTime(!specifyTime);
        if (specifyTime) setTime(fullDay);
      }}>ระบุช่วงเวลา</Button>
      {specifyTime && <WebsiteTimeRangeFilter idPrefix={id} value={time} pending={props.loading} onChange={setTime} />}
      <p className="text-xs text-muted-foreground">เวลาไทย · {specifyTime ? singleDay(draft) ? "กราฟรายชั่วโมง" : "ใช้ช่วงเวลานี้ทุกวัน" : "เต็มวัน 24 ชั่วโมง (00:00–24:00)"}</p>
    </div> : undefined}
    onChange={draft => onChange({ ...draft, ...(specifyTime ? time : fullDay) })} />;
}
