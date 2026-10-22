"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsDateRange } from "../../../../lib/website-analytics";
import type { WebsiteDatasetSelection } from "../../../../lib/website-analytics-scope";
import { Button } from "../../../ui/button";
import { useWebsiteAnalyticsTransition } from "./analytics-loading";

export interface WebsiteMobileFilterPeriod {
  range: AnalyticsDateRange;
  comparison?: WebsiteDatasetSelection;
}

interface WebsiteMobileFilterDraft extends WebsiteMobileFilterPeriod {
  onRangeChange: (range: AnalyticsDateRange) => void;
  onComparisonChange: (comparison: WebsiteDatasetSelection | undefined) => void;
}

export const WebsiteMobileFilterDraftContext = createContext<WebsiteMobileFilterDraft | null>(null);

/** Only controls inside the mobile filter sheet defer their navigation. */
export function useWebsiteMobileFilterDraft() {
  return useContext(WebsiteMobileFilterDraftContext);
}

export function WebsiteMobileFilterActions({ onApply, onCancel }: { onApply: () => string | undefined; onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useWebsiteAnalyticsTransition();
  return <div className="grid shrink-0 grid-cols-2 gap-3 border-t bg-background px-4 py-3">
    <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onCancel}>ยกเลิก</Button>
    <Button type="button" className="h-11" disabled={pending} onClick={() => {
      const href = onApply();
      if (href) startTransition(() => router.replace(href, { scroll: false }));
    }}>ใช้</Button>
  </div>;
}
