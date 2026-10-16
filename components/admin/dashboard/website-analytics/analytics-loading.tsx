"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";
import { Skeleton } from "../../../ui/skeleton";

type AnalyticsTransition = [boolean, TransitionStartFunction];
const AnalyticsLoadingContext = createContext<AnalyticsTransition | null>(null);

export function WebsiteAnalyticsLoadingProvider({ children }: { children: ReactNode }) {
  const transition = useTransition();
  return <AnalyticsLoadingContext.Provider value={transition}>{children}</AnalyticsLoadingContext.Provider>;
}

export function useWebsiteAnalyticsTransition(): AnalyticsTransition {
  const local = useTransition();
  return useContext(AnalyticsLoadingContext) ?? local;
}

export function useWebsiteAnalyticsPending(): boolean {
  return useContext(AnalyticsLoadingContext)?.[0] ?? false;
}

/** Preserve dimensions and chart state while making stale data inaccessible. */
export function WebsiteChartLoading({ children }: { children: ReactNode }) {
  const pending = useWebsiteAnalyticsPending();
  return <div className="relative min-w-0" aria-busy={pending || undefined}>
    <div className={pending ? "pointer-events-none opacity-0" : undefined} aria-hidden={pending || undefined} inert={pending || undefined}>{children}</div>
    {pending && <div data-loading-website-chart role="status" aria-label="กำลังโหลดกราฟเว็บไซต์" className="absolute inset-0 flex flex-col gap-3">
      <span className="sr-only">กำลังโหลดกราฟเว็บไซต์…</span>
      <Skeleton aria-hidden="true" className="h-4 w-40 max-w-full shrink-0 motion-reduce:animate-none" />
      <Skeleton aria-hidden="true" className="min-h-0 w-full flex-1 motion-reduce:animate-none" />
    </div>}
  </div>;
}
