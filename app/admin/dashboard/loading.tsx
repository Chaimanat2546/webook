import { Skeleton } from "../../../components/ui/skeleton";

export default function DashboardLoading() {
  return <div role="status" aria-label="กำลังโหลด Dashboard" className="space-y-6"><Skeleton className="h-10 w-56" />
    <Skeleton className="h-44 w-full" />
    <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map(key => <Skeleton key={key} className="h-64" />)}</div>
    <Skeleton className="h-64 w-full" />
  </div>;
}
