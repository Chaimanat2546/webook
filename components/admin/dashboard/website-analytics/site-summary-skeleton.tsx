import { Skeleton } from "../../../ui/skeleton";
import { Card, CardContent, CardHeader } from "../../../ui/card";

const pulse = "motion-reduce:animate-none";

export function WebsiteSiteSummarySkeleton() {
  return <Card data-loading-section="analytics-loading-site-summary" role="status" aria-label="กำลังโหลดสถิติแยกเว็บไซต์">
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-2"><Skeleton className={`h-6 w-28 ${pulse}`} /><Skeleton className={`h-4 w-72 max-w-full ${pulse}`} /></div>
      <Skeleton className={`h-4 w-28 ${pulse}`} />
    </CardHeader>
    <CardContent>
      <span className="sr-only">กำลังโหลดสถิติแยกเว็บไซต์…</span>
      <div className="space-y-3 md:hidden" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-3 border-b pb-3 last:border-b-0 last:pb-0"><div className="flex items-start justify-between gap-3"><div className="space-y-2"><Skeleton className={`h-4 w-32 ${pulse}`} /><Skeleton className={`h-3 w-40 ${pulse}`} /></div><Skeleton className={`h-6 w-20 ${pulse}`} /></div><div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2"><Skeleton className={`h-8 ${pulse}`} /><Skeleton className={`h-8 ${pulse}`} /><Skeleton className={`h-8 ${pulse}`} /></div></div>)}
      </div>
      <div data-loading-site-summary-desktop className="hidden space-y-3 md:block" aria-hidden="true">
        <div className="grid grid-cols-[minmax(12rem,2fr)_minmax(7rem,1fr)_repeat(6,minmax(4rem,1fr))] gap-4 border-b pb-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} data-loading-site-summary-column className={`h-4 ${pulse}`} />)}</div>
        {Array.from({ length: 4 }, (_, row) => <div key={row} className="grid grid-cols-[minmax(12rem,2fr)_minmax(7rem,1fr)_repeat(6,minmax(4rem,1fr))] gap-4 border-b pb-3"><Skeleton data-loading-site-summary-column className={`h-8 w-3/4 ${pulse}`} />{Array.from({ length: 7 }, (_, column) => <Skeleton key={column} data-loading-site-summary-column className={`h-5 ${pulse}`} />)}</div>)}
      </div>
    </CardContent>
  </Card>;
}
