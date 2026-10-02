"use client";

import type { LucideIcon } from "lucide-react";

export interface DashboardTab<T extends string> {
  icon: LucideIcon;
  label: string;
  value: T;
}

interface DashboardTabsProps<T extends string> {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: T) => void;
  tabs: readonly DashboardTab<T>[];
  value: T;
}

export function DashboardTabs<T extends string>({ ariaLabel, className = "", onValueChange, tabs, value }: DashboardTabsProps<T>) {
  return <nav aria-label={ariaLabel} className={`flex gap-1 overflow-x-auto border-b pb-px ${className}`.trim()} role="tablist">
    {tabs.map(({ icon: Icon, label, value: tabValue }) => <button aria-selected={tabValue === value} className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground aria-selected:border-primary aria-selected:text-primary" key={tabValue} onClick={() => onValueChange(tabValue)} role="tab" type="button"><Icon aria-hidden className="size-4" />{label}</button>)}
  </nav>;
}
