"use client";

import { ChevronDown } from "lucide-react";
import type { WebsitePeriodRow } from "../../../../lib/website-analytics-comparison";
import { Button } from "../../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import { PeriodComparisonDetails } from "./period-comparison-summary";

export function PeriodComparisonIssues({ rows }: { rows: WebsitePeriodRow[] }) {
  const issues = rows.filter(row => row.currentSelected && row.current.status !== "complete" || row.previousSelected && row.previous.status !== "complete");
  if (!issues.length) return null;
  const failed = issues.some(row => row.currentSelected && row.current.status === "unavailable" || row.previousSelected && row.previous.status === "unavailable");
  const partial = issues.some(row => row.currentSelected && !row.current.coverageComplete || row.previousSelected && !row.previous.coverageComplete);
  const label = failed ? `โหลดไม่ครบ (${issues.length} เว็บ)` : partial ? `ข้อมูลไม่ครบ (${issues.length} เว็บ)` : "ยังไม่จบวัน";
  return <Popover>
    <PopoverTrigger render={<Button type="button" variant="ghost" className="h-auto min-h-11 max-w-full gap-1 whitespace-normal px-1 text-xs text-amber-700 dark:text-amber-400" />}>
      {label}<span className="sr-only"> ดูรายละเอียด</span><ChevronDown aria-hidden className="size-3" />
    </PopoverTrigger>
    <PopoverContent className="max-h-[70dvh] w-80 max-w-[calc(100vw-1.5rem)] min-w-0 overflow-y-auto">
      <div className="divide-y">{issues.map(row => <section key={row.key} aria-label={row.displayName} className="space-y-2 py-3 first:pt-0 last:pb-0">
        <h3 className="break-words text-sm font-medium">{row.displayName}</h3><PeriodComparisonDetails {...row} />
      </section>)}</div>
    </PopoverContent>
  </Popover>;
}
