import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CalendarPlaceholder() {
  return <div aria-hidden="true" className="space-y-2">
    <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-5 motion-reduce:animate-none" />)}
    </div>
    <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 42 }, (_, index) => <Skeleton key={index} className="h-10 motion-reduce:animate-none" />)}
    </div>
    <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
  </div>;
}

export function BookingGalleryDatesSkeleton() {
  return <div role="status" aria-label="กำลังโหลดปฏิทิน" aria-busy="true">
    <span className="sr-only">กำลังโหลดปฏิทิน…</span>
    <CalendarPlaceholder />
  </div>;
}

export function BookingGallerySkeleton() {
  return <div role="status" aria-label="กำลังโหลดรายการบ้าน" aria-busy="true">
    <span className="sr-only">กำลังโหลดรายการบ้าน…</span>
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => <Card key={index} size="sm" className="min-w-0 gap-2">
        <CardHeader className="gap-1">
          <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
          <Skeleton className="h-5 w-36 motion-reduce:animate-none" />
          <Skeleton className="mt-1 h-8 w-full motion-reduce:animate-none" />
        </CardHeader>
        <CardContent className="space-y-2">
          <CalendarPlaceholder />
          <Skeleton className="h-8 w-full motion-reduce:animate-none" />
        </CardContent>
      </Card>)}
    </div>
  </div>;
}
