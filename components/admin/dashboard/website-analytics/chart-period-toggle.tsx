"use client";

import { Button } from "../../../ui/button";

export type ChartPeriod = "day" | "month";
interface ChartPeriodToggleProps {
  value: ChartPeriod;
  onChange: (value: ChartPeriod) => void;
  disabled?: boolean;
}

export function ChartPeriodToggle({ value, onChange, disabled = false }: ChartPeriodToggleProps) {
  return <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="ช่วงกราฟ">
    {(["day", "month"] as const).map(period => <Button key={period} type="button" className="min-h-11" variant={value === period ? "default" : "ghost"} aria-pressed={value === period} disabled={disabled} onClick={() => onChange(period)}>{period === "day" ? "รายวัน" : "รายเดือน"}</Button>)}
  </div>;
}
