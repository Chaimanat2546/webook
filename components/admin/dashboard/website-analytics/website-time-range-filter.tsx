"use client";
import { parseAnalyticsTimeRange, type AnalyticsTimeRange } from "../../../../lib/website-analytics-time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";

interface WebsiteTimeRangeFilterProps { idPrefix: string; value: AnalyticsTimeRange; pending?: boolean; onChange: (value: AnalyticsTimeRange) => void }
export function WebsiteTimeRangeFilter({ idPrefix, value, pending, onChange }: WebsiteTimeRangeFilterProps) {
  const draft = value;
  let valid = true;
  try { parseAnalyticsTimeRange(draft.timeFrom, draft.timeTo, { from: "2000-01-01", to: "2000-01-01" }); } catch { valid = false; }
  return <div className="min-w-0 max-w-full space-y-1" aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      {(["timeFrom", "timeTo"] as const).map((field, index) => <div key={field} className="grid min-w-0 gap-1">
        <label htmlFor={`${idPrefix}-${field}`} className="text-xs text-muted-foreground">{index === 0 ? "เวลาเริ่ม" : "เวลาสิ้นสุด"}</label>
        <Select value={draft[field]} disabled={pending} onValueChange={next => { if (next) onChange({ ...value, [field]: next }); }}>
          <SelectTrigger id={`${idPrefix}-${field}`} aria-invalid={!valid} aria-describedby={!valid ? `${idPrefix}-error` : undefined} className="h-8 min-w-24"><SelectValue>{draft[field]}</SelectValue></SelectTrigger>
          <SelectContent>{Array.from({ length: 24 }, (_, hour) => `${String(hour + index).padStart(2, "0")}:00`).map(hour => <SelectItem value={hour} key={hour}>{hour}</SelectItem>)}</SelectContent>
        </Select>
      </div>)}
    </div>
    {!valid && <p id={`${idPrefix}-error`} role="alert" className="text-xs text-destructive">เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด</p>}
  </div>;
}
