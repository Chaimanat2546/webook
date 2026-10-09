"use client";

import { WebsiteAnalyticsSkeleton } from "../../../../components/admin/dashboard/website-analytics/website-analytics-skeleton";
import { useSearchParams } from "next/navigation";

export default function Loading() {
  return <WebsiteAnalyticsSkeleton variant={useSearchParams().get("view") === "houses" ? "houses" : "overview"} />;
}
