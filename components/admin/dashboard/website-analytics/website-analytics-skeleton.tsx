import { Skeleton } from "../../../ui/skeleton";

const pulse = "motion-reduce:animate-none";

function MetricSkeleton() {
  return <div className="min-w-0 space-y-2 px-1 md:px-5">
    <Skeleton className={`h-4 w-20 ${pulse}`} />
    <Skeleton className={`h-9 w-24 ${pulse}`} />
    <Skeleton className={`hidden h-3 w-full md:block ${pulse}`} />
  </div>;
}

function RankingSkeleton() {
  return <section data-loading-section="analytics-loading-ranking" className="rounded-xl border bg-card p-4 md:p-6">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className={`h-6 w-52 ${pulse}`} />
      <Skeleton className={`h-5 w-20 ${pulse}`} />
    </div>
    <div className="mt-5 hidden space-y-3 md:block" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-[minmax(12rem,2fr)_repeat(3,minmax(4rem,1fr))] items-center gap-4 border-t pt-3">
        <Skeleton className={`h-5 w-3/4 ${pulse}`} />
        <Skeleton className={`h-5 ${pulse}`} />
        <Skeleton className={`h-5 ${pulse}`} />
        <Skeleton className={`h-5 ${pulse}`} />
      </div>)}
    </div>
    <div className="mt-5 space-y-3 md:hidden" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-3 rounded-lg border p-3"><Skeleton className={`h-5 w-2/3 ${pulse}`} /><div className="grid grid-cols-3 gap-2"><Skeleton className={`h-4 ${pulse}`} /><Skeleton className={`h-4 ${pulse}`} /><Skeleton className={`h-4 ${pulse}`} /></div></div>)}
    </div>
  </section>;
}

function HouseListSkeleton() {
  return <section data-loading-section="analytics-loading-house-list" className="space-y-3" aria-hidden="true">
    <div className="hidden overflow-hidden rounded-xl border md:block">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid grid-cols-[2fr_repeat(3,minmax(4rem,1fr))] gap-4 border-b p-4 last:border-b-0"><Skeleton className={`h-5 w-3/4 ${pulse}`} /><Skeleton className={`h-5 ${pulse}`} /><Skeleton className={`h-5 ${pulse}`} /><Skeleton className={`h-5 ${pulse}`} /></div>)}
    </div>
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-3 rounded-xl border bg-card p-3"><Skeleton className={`h-5 w-2/3 ${pulse}`} /><Skeleton className={`h-3 w-20 ${pulse}`} /><div className="grid grid-cols-3 gap-3"><Skeleton className={`h-4 ${pulse}`} /><Skeleton className={`h-4 ${pulse}`} /><Skeleton className={`h-4 ${pulse}`} /></div></div>)}
    </div>
  </section>;
}

interface WebsiteAnalyticsSkeletonProps {
  variant?: "houses" | "overview";
}

function OverviewAnalyticsSkeleton() {
  return <>
    <header data-loading-section="analytics-loading-header" className="space-y-3">
      <Skeleton className={`h-9 w-36 ${pulse}`} />
      <div className="space-y-2"><Skeleton className={`h-7 w-64 ${pulse}`} /><Skeleton className={`h-4 w-80 max-w-full ${pulse}`} /></div>
    </header>
    <div data-loading-section="analytics-loading-filters" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <Skeleton className={`h-11 w-full sm:w-40 ${pulse}`} />
      <Skeleton className={`h-11 w-full sm:w-72 ${pulse}`} />
    </div>
    <div data-loading-section="analytics-loading-summary" className="rounded-xl border bg-card p-4 md:p-6">
      <div className="grid grid-cols-3 divide-x gap-2 md:gap-5"><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 md:flex md:gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className={`h-8 w-full md:w-28 ${pulse}`} />)}</div>
    </div>
    <section data-loading-section="analytics-loading-chart" className="rounded-xl border bg-card p-4 md:p-6">
      <div className="space-y-2"><Skeleton className={`h-6 w-40 ${pulse}`} /><Skeleton className={`h-4 w-64 max-w-full ${pulse}`} /></div>
      <Skeleton className={`mt-5 h-56 w-full ${pulse}`} />
    </section>
    <RankingSkeleton />
  </>;
}

function HouseListAnalyticsSkeleton() {
  return <>
    <header data-loading-section="analytics-loading-house-header" className="space-y-3">
      <Skeleton className={`h-9 w-40 ${pulse}`} />
      <div className="space-y-2"><Skeleton className={`h-7 w-48 ${pulse}`} /><Skeleton className={`h-4 w-80 max-w-full ${pulse}`} /></div>
    </header>
    <div className="rounded-xl border p-3 md:p-4">
      <Skeleton data-loading-section="analytics-loading-house-search" className={`h-11 w-full ${pulse}`} />
      <div data-loading-section="analytics-loading-house-filters" className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap"><Skeleton className={`h-9 w-full md:w-40 ${pulse}`} /><Skeleton className={`h-9 w-full md:w-48 ${pulse}`} /></div>
    </div>
    <HouseListSkeleton />
    <div data-loading-section="analytics-loading-pagination" className="flex justify-center gap-2" aria-hidden="true"><Skeleton className={`h-10 w-20 ${pulse}`} /><Skeleton className={`h-10 w-20 ${pulse}`} /></div>
  </>;
}

function WebsiteAnalyticsSkeletonContent({ variant }: Required<WebsiteAnalyticsSkeletonProps>) {
  return <div role="status" aria-label="กำลังโหลดสถิติเข้าเว็บไซต์" className="website-analytics-theme mx-auto min-w-0 max-w-7xl space-y-3 md:space-y-6">
    <span className="sr-only">กำลังโหลดสถิติเข้าเว็บไซต์…</span>
    {variant === "houses" ? <HouseListAnalyticsSkeleton /> : <OverviewAnalyticsSkeleton />}
  </div>;
}

export function WebsiteAnalyticsSkeleton({ variant = "overview" }: WebsiteAnalyticsSkeletonProps) {
  return <WebsiteAnalyticsSkeletonContent variant={variant} />;
}
