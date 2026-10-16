"use client";

import { useState } from "react";
import { ThaiDateRangePicker, type ThaiDateRangePickerProps } from "../../ui/thai-date-range-picker";
import { RangeShortcuts } from "./range-shortcuts";

interface ReportDateRange { from: string; to: string }
export interface ReportDateRangePickerProps extends Pick<ThaiDateRangePickerProps, "renderSelection" | "canConfirm" | "onOpenChange" | "valueSuffix"> {
  month: string;
  range?: ReportDateRange;
  today?: string;
  availableFrom?: string;
  pastOnly?: boolean;
  loading?: boolean;
  className?: string;
  label?: string;
  confirmSelection?: boolean;
  portalContainer?: HTMLElement | null;
  showShortcuts?: boolean;
  compactShortcuts?: boolean;
  onChange: (range: ReportDateRange) => void;
}
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localDate = (value: string) => new Date(`${value}T00:00:00`);

export function ReportDateRangePicker({ month, range, today, availableFrom, pastOnly = false, loading, className, label = "ช่วงวันที่รายงาน", confirmSelection = true, portalContainer, showShortcuts = true, compactShortcuts = false, onChange, ...popupProps }: ReportDateRangePickerProps) {
  const [clockToday] = useState(() => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10));
  const currentDay = today ?? clockToday;
  const [year, number] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  const selected = range ?? { from: `${month}-01`, to: pastOnly && monthEnd > currentDay ? currentDay : monthEnd };
  return <ThaiDateRangePicker {...popupProps} confirmSelection={confirmSelection} autoApply={!confirmSelection} portalContainer={portalContainer} loading={loading} className={className} label={label}
    value={{ from: localDate(selected.from), to: localDate(selected.to) }}
    disabled={[{ before: localDate("1900-01-01") }, { after: localDate(pastOnly ? currentDay : "2199-12-31") }]}
    renderShortcuts={showShortcuts ? (select, custom, draft) => <RangeShortcuts compact={compactShortcuts} today={currentDay} availableFrom={availableFrom} selected={draft?.from && draft.to ? { from: dateKey(draft.from), to: dateKey(draft.to) } : undefined} onSelect={select} onCustom={custom} /> : undefined}
    onChange={draft => { if (draft?.from && draft.to) onChange({ from: dateKey(draft.from), to: dateKey(draft.to) }); }} />;
}
