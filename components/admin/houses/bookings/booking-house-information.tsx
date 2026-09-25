"use client";

import { useEffect, useState } from "react";
import { House } from "lucide-react";
import { getBookingHouseInformationAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingHouseInformation as Information } from "@/lib/house-bookings";
import { BookingHouseInformationDetails } from "./booking-house-information-details";

type State = { propertyId: string; retry: number } & (
  { status: "ready"; data: Information } | { status: "error"; message: string }
);

export function BookingHouseInformation({ propertyId }: { propertyId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getBookingHouseInformationAction(propertyId);
        if (cancelled) return;
        setState(result.ok ? { propertyId, retry, status: "ready", data: result.data }
          : { propertyId, retry, status: "error", message: result.message });
      } catch {
        if (!cancelled) setState({ propertyId, retry, status: "error", message: "โหลดข้อมูลที่พักไม่สำเร็จ" });
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId, retry]);
  const current = state?.propertyId === propertyId && state.retry === retry ? state : null;
  return <section aria-label="ข้อมูลที่พัก" className="space-y-3 rounded-xl border bg-muted/20 p-3">
    <h3 className="flex items-center gap-2 font-semibold"><House aria-hidden className="size-4 text-muted-foreground" />ข้อมูลที่พัก</h3>
    <p className="text-xs text-muted-foreground">ข้อมูลบ้านล่าสุด สำหรับอ้างอิง ไม่รวมในยอดการจอง</p>
    {!current ? <div role="status" aria-label="กำลังโหลดข้อมูลที่พัก" aria-busy="true">
      <span className="sr-only">กำลังโหลดข้อมูลที่พัก…</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 motion-reduce:animate-none" />)}</div>
    </div> : current.status === "error" ? <div className="space-y-2">
      <p role="alert" className="text-sm text-destructive">{current.message}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button>
    </div> : <BookingHouseInformationDetails data={current.data} />}
  </section>;
}
