import { Skeleton } from "@/components/ui/skeleton";

export function BookingCalendarSkeleton({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label={compact ? "กำลังโหลดวันว่าง" : "กำลังโหลดการจอง"} className="flex h-full min-h-0 flex-col gap-3 bg-background">
    <span className="sr-only">{compact ? "กำลังโหลดวันว่าง…" : "กำลังโหลดการจอง…"}</span>
    <div aria-hidden="true" className="flex items-center justify-between"><Skeleton className="h-6 w-32 motion-reduce:animate-none" /><Skeleton className="h-8 w-24 motion-reduce:animate-none" /></div>
    <div aria-hidden="true" className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-lg border">
      {Array.from({ length: 42 }, (_, index) => <div key={index} className="min-h-0 min-w-0 border-b border-r p-1.5 sm:p-2"><Skeleton className="ml-auto h-3 w-3 motion-reduce:animate-none" />{index % 3 === 0 && <Skeleton className="mt-2 h-3 w-full motion-reduce:animate-none" />}</div>)}
    </div>
  </div>;
}

export function BookingEditorSkeleton() {
  return <div role="status" aria-label="กำลังโหลดรายละเอียดการจอง" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
    <span className="sr-only">กำลังโหลดรายละเอียดการจอง…</span>
    <div aria-hidden="true" className="space-y-3"><Skeleton className="h-5 w-28 motion-reduce:animate-none" /><div className="grid grid-cols-2 gap-2"><Skeleton className="h-16 motion-reduce:animate-none" /><Skeleton className="h-16 motion-reduce:animate-none" /></div><Skeleton className="h-[380px] w-full motion-reduce:animate-none" /></div>
    <div aria-hidden="true" className="space-y-3 border-t pt-4"><Skeleton className="h-5 w-20 motion-reduce:animate-none" /><Skeleton className="h-9 w-full motion-reduce:animate-none" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-12 motion-reduce:animate-none" /><Skeleton className="h-12 motion-reduce:animate-none" /></div><Skeleton className="h-20 w-full motion-reduce:animate-none" /></div>
  </div>;
}

export function BookingCustomersSkeleton() {
  return <div role="status" aria-label="กำลังโหลดลูกค้า" className="space-y-3 p-3"><span className="sr-only">กำลังโหลดลูกค้า…</span>{Array.from({ length: 5 }, (_, index) => <div key={index} aria-hidden="true" className="space-y-1.5"><Skeleton className="h-4 w-2/3 motion-reduce:animate-none" /><Skeleton className="h-3 w-1/3 motion-reduce:animate-none" /></div>)}</div>;
}
