import { Skeleton } from "../../../components/ui/skeleton";

export default function DashboardLoading() {
  return <div role="status" aria-label="กำลังโหลด Dashboard" className="space-y-6"><Skeleton className="h-10 w-56" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(key => <Skeleton key={key} className="h-32" />)}</div>
    <Skeleton className="h-80 w-full" />
  </div>;
}
