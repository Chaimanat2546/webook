"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { analyticsDatePresets, trailingDateRange } from "../../../lib/analytics-date-presets";
import type { AnalyticsDateRange } from "../../../lib/website-analytics";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface RangeShortcutsProps {
  today: string;
  availableFrom?: string;
  selected?: AnalyticsDateRange;
  onSelect: (range: DateRange) => void;
  onCustom: () => void;
}

function TrailingDays({ today, yesterday, onSelect, onCustom }: Pick<RangeShortcutsProps, "today" | "onSelect" | "onCustom"> & { yesterday: boolean }) {
  const [days, setDays] = useState("30");
  const range = /^\d+$/.test(days) ? trailingDateRange(today, Number(days), yesterday) : undefined;
  const label = yesterday ? "วันจนถึงเมื่อวาน" : "วันจนถึงวันนี้";
  return <div className="flex items-center gap-1">
    <Input onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); if (range) onSelect({ from: new Date(`${range.from}T00:00:00`), to: new Date(`${range.to}T00:00:00`) }); } }} aria-label={`จำนวน${label}`} className="w-16 shrink-0" type="number" min={1} step={1} required value={days} onChange={event => {
      const value = event.target.value;
      setDays(value);
      const next = /^\d+$/.test(value) ? trailingDateRange(today, Number(value), yesterday) : undefined;
      if (next) onSelect({ from: new Date(`${next.from}T00:00:00`), to: new Date(`${next.to}T00:00:00`) });
      else onCustom();
    }} />
    <Button type="button" onClick={() => { if (range) onSelect({ from: new Date(`${range.from}T00:00:00`), to: new Date(`${range.to}T00:00:00`) }); }} variant="ghost" size="sm" disabled={!range} className="h-10 justify-start px-2 text-xs">{label}</Button>
  </div>;
}

export function RangeShortcuts({ today, availableFrom, selected, onSelect, onCustom }: RangeShortcutsProps) {
  const presets = analyticsDatePresets(today, availableFrom);
  const active = selected ? presets.find(preset => preset.range?.from === selected.from && preset.range.to === selected.to)?.id : undefined;
  return <div className="w-full space-y-2 p-2 sm:w-60">
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-1" aria-label="ช่วงวันที่สำเร็จรูป">
      <Button type="button" variant={!active ? "secondary" : "ghost"} aria-pressed={!active} className="h-auto min-h-10 justify-start whitespace-normal text-left text-xs" onClick={onCustom}>กำหนดเอง</Button>
      {presets.map(preset => <Button key={preset.id} type="button" variant={active === preset.id ? "secondary" : "ghost"} aria-pressed={active === preset.id} disabled={!preset.range} title={!preset.range ? "ยังไม่ทราบวันเริ่มเก็บข้อมูล" : undefined} className="h-auto min-h-10 justify-start whitespace-normal text-left text-xs" onClick={() => {
        if (preset.range) onSelect({ from: new Date(`${preset.range.from}T00:00:00`), to: new Date(`${preset.range.to}T00:00:00`) });
      }}>{preset.label}</Button>)}
    </div>
    <div className="space-y-1 border-t pt-2">
      <TrailingDays today={today} yesterday={false} onSelect={onSelect} onCustom={onCustom} />
      <TrailingDays today={today} yesterday onSelect={onSelect} onCustom={onCustom} />
      {!availableFrom && <p className="px-2 text-xs text-muted-foreground">“ตั้งแต่ต้น” ใช้ได้เมื่อทราบวันเริ่มเก็บข้อมูล</p>}
    </div>
  </div>;
}
