"use client";

import { Button } from "../../../ui/button";
import type { WebsiteOption } from "./filters";

interface WebsiteChartLegendProps {
  sites: WebsiteOption[];
  availableSites: string[];
  hiddenSites: string[];
  onToggleSite: (key: string) => void;
  colorKeys?: string[];
  comparison?: boolean;
  label?: string;
}

/** Original chart-legend layout, shared by daily and comparison charts. */
export function WebsiteChartLegend({ sites, availableSites, hiddenSites, onToggleSite, colorKeys = sites.map(site => site.key), comparison = false, label = "เว็บไซต์ในกราฟรายวัน" }: WebsiteChartLegendProps) {
  const visibleCount = availableSites.filter(key => !hiddenSites.includes(key)).length;
  return <div role="group" aria-label={label} className="mb-3 flex flex-wrap gap-x-2 gap-y-1">
    {sites.map(site => {
      const index = Math.max(0, colorKeys.indexOf(site.key)), hasData = availableSites.includes(site.key), visible = !hiddenSites.includes(site.key);
      return <Button key={site.key} type="button" variant="ghost" className="min-w-0 max-w-full justify-start gap-2 px-2 text-left text-xs" title={site.displayName} aria-pressed={hasData && visible} disabled={!hasData || (visible && visibleCount === 1)} onClick={() => onToggleSite(site.key)}>
        <svg aria-hidden="true" className="h-3 w-6 shrink-0" viewBox="0 0 24 12"><line x1="1" y1="6" x2="23" y2="6" stroke={`var(--chart-${index % 5 + 1})`} strokeWidth="2" strokeDasharray={comparison ? "6 4" : undefined} /></svg>
        <span className={`min-w-0 truncate ${hasData && !visible ? "line-through opacity-50" : ""}`}>{site.displayName}{!hasData && " (ไม่มีข้อมูล)"}</span>
      </Button>;
    })}
  </div>;
}
