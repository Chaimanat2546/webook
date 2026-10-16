"use client";
import { useState } from "react";
import { parseAnalyticsTimeRange, type AnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { Button } from "../../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";

interface WebsiteTimeRangeFilterProps { idPrefix: string; value: AnalyticsTimeRange; pending?: boolean; onApply: (value: AnalyticsTimeRange) => void }
export function WebsiteTimeRangeFilter({ idPrefix, value, pending, onApply }: WebsiteTimeRangeFilterProps) {
  const [draft, setDraft] = useState(value);
  let valid = true;
  try { parseAnalyticsTimeRange(draft.timeFrom, draft.timeTo, { from: "2000-01-01", to: "2000-01-01" }); } catch { valid = false; }
  const changed = draft.timeFrom !== value.timeFrom || draft.timeTo !== value.timeTo;
  return <div className="min-w-0 max-w-full space-y-1" aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      {(["timeFrom", "timeTo"] as const).map((field, index) => <div key={field} className="grid min-w-0 gap-1">
        <label htmlFor={`${idPrefix}-${field}`} className="text-xs text-muted-foreground">{index === 0 ? "เวลาเริ่ม" : "เวลาสิ้นสุด"}</label>
        <Select value={draft[field]} disabled={pending} onValueChange={next => { if (next) setDraft(current => ({ ...current, [field]: next })); }}>
          <SelectTrigger id={`${idPrefix}-${field}`} aria-invalid={!valid} aria-describedby={!valid ? `${idPrefix}-error` : undefined} className="h-8 min-w-24"><SelectValue>{draft[field]}</SelectValue></SelectTrigger>
          <SelectContent>{Array.from({ length: 24 }, (_, hour) => `${String(hour + index).padStart(2, "0")}:00`).map(hour => <SelectItem value={hour} key={hour}>{hour}</SelectItem>)}</SelectContent>
        </Select>
      </div>)}
      <Button type="button" variant="outline" className="h-8" disabled={pending || !valid || !changed} onClick={() => onApply(draft)}>ใช้เวลา</Button>
    </div>
    {!valid && <p id={`${idPrefix}-error`} role="alert" className="text-xs text-destructive">เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด</p>}
  </div>;
}
