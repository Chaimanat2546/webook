"use client";

import { ChevronDown } from "lucide-react";
import type { WebsitePeriodRow } from "../../../../lib/website-analytics-comparison";
import { Button } from "../../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import { PeriodComparisonDetails, comparisonReasonLabel } from "./period-comparison-summary";
import { assessPeriodComparison, type ComparisonReason } from "../../../../lib/website-analytics-comparison-policy";

export function PeriodComparisonIssues({ rows }: { rows: WebsitePeriodRow[] }) {
  const dataReasons: ComparisonReason[] = ["load_failed", "coverage_incomplete", "not_started", "ongoing"];
  const assessed = rows.map(row => ({ row, reasons: assessPeriodComparison(row.current, row.previous, row).reasons.filter(reason => dataReasons.includes(reason)) }));
  const issues = assessed.filter(item => item.reasons.length > 0);
  if (!issues.length) return null;
  const firstReason = dataReasons.find(reason => issues.some(item => item.reasons.includes(reason)))!;
  const reasonCount = issues.filter(item => item.reasons.includes(firstReason)).length;
  const label = `${comparisonReasonLabel(firstReason)} (${reasonCount} เว็บ)`;
  return <Popover>
    <PopoverTrigger render={<Button type="button" variant="ghost" className="max-w-full gap-1 px-1 text-xs text-amber-700 dark:text-amber-400" />}>
      {label}<span className="sr-only"> ดูรายละเอียด</span><ChevronDown aria-hidden className="size-3" />
    </PopoverTrigger>
    <PopoverContent className="max-h-[70dvh] w-80 max-w-[calc(100vw-1.5rem)] min-w-0 overflow-y-auto">
      <div className="divide-y">{issues.map(({ row }) => <section key={row.key} aria-label={row.displayName} className="space-y-2 py-3 first:pt-0 last:pb-0">
        <h3 className="break-words text-sm font-medium">{row.displayName}</h3><PeriodComparisonDetails current={row.current} previous={row.previous} currentSelected={row.currentSelected} previousSelected={row.previousSelected} />
      </section>)}</div>
    </PopoverContent>
  </Popover>;
}
