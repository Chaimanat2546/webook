import { Skeleton } from "../../../components/ui/skeleton";
export default function LoadingHistory() {
  return <div className="space-y-5" aria-label="กำลังโหลดประวัติ"><Skeleton className="h-8 w-56"/><Skeleton className="h-24 w-full"/>{[1,2,3,4].map(row=><Skeleton key={row} className="h-20 w-full"/>)}</div>;
}
