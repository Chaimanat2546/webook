import { Skeleton } from "../../ui/skeleton";

export function HistorySkeleton() {
  return <div role="status" aria-label="กำลังโหลดประวัติ" aria-live="polite" className="space-y-3 pt-5">
    <span className="sr-only">กำลังโหลดประวัติ</span>
    <Skeleton className="mb-4 h-4 w-32" />
    {[1,2,3,4].map(row => <div key={row} aria-hidden className="flex gap-4 rounded-3xl border bg-card p-4"><div className="space-y-3"><Skeleton className="h-4 w-10" /><Skeleton className="size-8 rounded-full" /></div><div className="flex-1 space-y-3"><Skeleton className="h-5 w-3/5" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>)}
  </div>;
}
