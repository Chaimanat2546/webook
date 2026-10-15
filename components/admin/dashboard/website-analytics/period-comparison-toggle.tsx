"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "../../../ui/switch";
import type { WebsiteAnalyticsQuery } from "../../../../lib/website-analytics";
import { websitePeriodHref } from "../../../../lib/website-analytics-comparison";

export function PeriodComparisonToggle({ checked, query }: { checked: boolean; query?: WebsiteAnalyticsQuery }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1" aria-busy={pending}>
    <Switch id={id} checked={checked} disabled={pending} onCheckedChange={enabled => {
      if (query) {
        startTransition(() => router.replace(websitePeriodHref(query, { granularity: "day" }, enabled), { scroll: false }));
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (enabled) params.set("analyticsCompare", "previous");
      else params.delete("analyticsCompare");
      startTransition(() => router.replace(`/admin/dashboard?${params}`, { scroll: false }));
    }} />
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center text-sm">เทียบช่วงก่อนหน้า</label>
    {pending && <span role="status" className="text-xs text-muted-foreground">กำลังโหลดกราฟ…</span>}
  </div>;
}
