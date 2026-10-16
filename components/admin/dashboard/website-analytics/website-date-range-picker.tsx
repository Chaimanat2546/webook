"use client";

import { useId, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { parseAnalyticsTimeRange, type AnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { ReportDateRangePicker, type ReportDateRangePickerProps } from "../report-date-range-picker";
import { WebsiteTimeRangeFilter } from "./website-time-range-filter";

interface WebsiteDateRangePickerProps extends Omit<ReportDateRangePickerProps, "range" | "onChange" | "confirmSelection" | "renderSelection" | "canConfirm" | "onOpenChange" | "valueSuffix"> {
  range?: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
}

const singleDay = (draft: DateRange | undefined) => Boolean(draft?.from && draft.to && draft.from.getTime() === draft.to.getTime());

/** Date and hour edits are drafts until the popup's single Apply action. */
export function WebsiteDateRangePicker({ range, onChange, ...props }: WebsiteDateRangePickerProps) {
  const id = useId();
  const currentTime = (): AnalyticsTimeRange => ({ timeFrom: range?.timeFrom ?? "00:00", timeTo: range?.timeTo ?? "24:00" });
  const [time, setTime] = useState(currentTime);
  function validTime() {
    try { return Boolean(parseAnalyticsTimeRange(time.timeFrom, time.timeTo, { from: "2000-01-01", to: "2000-01-01" })); }
    catch { return false; }
  }
  return <ReportDateRangePicker compactShortcuts {...props} range={range} confirmSelection
    valueSuffix={range?.from === range?.to && range?.timeFrom && range.timeTo ? `${range.timeFrom}–${range.timeTo}` : undefined}
    onOpenChange={open => { if (open) setTime(currentTime()); }}
    canConfirm={draft => !singleDay(draft) || validTime()}
    renderSelection={draft => singleDay(draft) ? <div className="border-t p-3"><WebsiteTimeRangeFilter idPrefix={id} value={time} pending={props.loading} onChange={setTime} /><p className="mt-2 text-xs text-muted-foreground">เวลาไทย · กราฟรายชั่วโมง</p></div> : undefined}
    onChange={draft => onChange({ ...draft, ...(draft.from === draft.to ? time : {}) })} />;
}
