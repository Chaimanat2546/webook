import { Skeleton } from "../../../../components/ui/skeleton";
export default function Loading() {
  return <div aria-label="กำลังโหลดสถิติเข้าเว็บไซต์" role="status" className="space-y-5"><p>กำลังโหลดสถิติเข้าเว็บไซต์...</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72" /></div>;
}
