import { Skeleton } from "../../components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล…</p>
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
