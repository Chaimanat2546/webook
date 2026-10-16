"use client";

import { useId, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import { parseAnalyticsTimeRange, type AnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { dateKey, ReportDateRangePicker, type ReportDateRangePickerProps } from "../report-date-range-picker";
import { matchComparisonTime } from "../../../../lib/website-analytics-comparison-policy";
import { WebsiteTimeRangeFilter } from "./website-time-range-filter";
import { Button } from "../../../ui/button";
import { Switch } from "../../../ui/switch";

interface WebsiteDateRangePickerProps extends Omit<ReportDateRangePickerProps, "range" | "onChange" | "confirmSelection" | "renderSelection" | "canConfirm" | "onOpenChange" | "valueSuffix"> {
  range?: AnalyticsDateRange;
  matchPrimary?: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
}

const singleDay = (draft: DateRange | undefined) => Boolean(draft?.from && draft.to && draft.from.getTime() === draft.to.getTime());
const fullDay: AnalyticsTimeRange = { timeFrom: "00:00", timeTo: "24:00" };
const hasTimeFilter = (range: AnalyticsDateRange | undefined) => Boolean(range?.timeFrom && range.timeTo && (range.timeFrom !== fullDay.timeFrom || range.timeTo !== fullDay.timeTo));

/** Date and hour edits are drafts until the popup's single Apply action. */
export function WebsiteDateRangePicker({ range, matchPrimary, onChange, ...props }: WebsiteDateRangePickerProps) {
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
    renderSelection={draft => {
      const matched = matchPrimary && draft?.from && draft.to ? matchComparisonTime(matchPrimary, { from: dateKey(draft.from), to: dateKey(draft.to) }) : undefined;
      const reason = !matched ? "เลือกช่วงวันที่ของชุดเทียบก่อน" : undefined;
      return <>
      {matchPrimary && <div className="space-y-2 border-t p-3">
        <Button type="button" variant="outline" className="h-8 w-full text-xs" disabled={props.loading || Boolean(reason)} aria-describedby={reason ? `${id}-match-reason` : undefined} onClick={() => {
          if (!matched || reason) return;
          setTime({ timeFrom: matched.timeFrom ?? fullDay.timeFrom, timeTo: matched.timeTo ?? fullDay.timeTo });
          setSpecifyTime(hasTimeFilter(matched));
        }}>ใช้เวลาตามช่วงหลัก</Button>
        <p className="text-xs text-muted-foreground">คงวันที่ของชุดเทียบตามที่เลือกไว้</p>
        {reason && <p id={`${id}-match-reason`} className="text-xs text-muted-foreground">{reason}</p>}
      </div>}
      {draft?.from && draft.to && <div className="space-y-2 border-t p-3">
      <div className="flex h-8 items-center justify-between gap-3">
        <label htmlFor={`${id}-specify-time`} className="cursor-pointer text-sm">ระบุช่วงเวลา</label>
        <Switch id={`${id}-specify-time`} checked={specifyTime} disabled={props.loading} onCheckedChange={checked => {
          setSpecifyTime(checked);
          if (!checked) setTime(fullDay);
        }} />
      </div>
      {specifyTime && <WebsiteTimeRangeFilter idPrefix={id} value={time} pending={props.loading} onChange={setTime} />}
      <p className="text-xs text-muted-foreground">เวลาไทย · {specifyTime ? singleDay(draft) ? "กราฟรายชั่วโมง" : "ใช้ช่วงเวลานี้ทุกวัน" : "เต็มวัน 24 ชั่วโมง (00:00–24:00)"}</p>
    </div>}
      </>;
    }}
    onChange={draft => onChange({ ...draft, ...(specifyTime ? time : fullDay) })} />;
}
