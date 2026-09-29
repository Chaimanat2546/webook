"use client";

import { useEffect, useState } from "react";
import { House } from "lucide-react";
import { getBookingCreationDefaultsAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingHouseInformation as Information } from "@/lib/house-bookings";
import { BookingHouseInformationDetails } from "./booking-house-information-details";

type State = { propertyId: string; retry: number } & (
  { status: "ready"; data: Information } | { status: "error"; message: string }
);

interface Props {
  propertyId: string;
  loadDefaults: boolean;
  values: Information;
  onChange: (values: Information) => void;
}

export function BookingHouseInformation({ propertyId, loadDefaults, values, onChange }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!loadDefaults) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getBookingCreationDefaultsAction(propertyId);
        if (cancelled) return;
        setState(result.ok ? { propertyId, retry, status: "ready", data: result.data }
          : { propertyId, retry, status: "error", message: result.message });
      } catch {
        if (!cancelled) setState({ propertyId, retry, status: "error", message: "โหลดข้อมูลที่พักไม่สำเร็จ" });
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId, loadDefaults, retry]);
  const current = loadDefaults
    ? state?.propertyId === propertyId && state.retry === retry ? state : null
    : { propertyId, retry, status: "ready" as const, data: values };
  return <section aria-label="ข้อมูลที่พัก" className="space-y-3 border-t pt-4">
    <h3 className="flex items-center gap-2 font-semibold"><House aria-hidden className="size-4 text-muted-foreground" />ข้อมูลที่พัก</h3>
    {!current ? <div role="status" aria-label="กำลังโหลดข้อมูลที่พัก" aria-busy="true">
      <span className="sr-only">กำลังโหลดข้อมูลที่พัก…</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 motion-reduce:animate-none" />)}</div>
    </div> : current.status === "error" ? <div className="space-y-2">
      <p role="alert" className="text-sm text-destructive">{current.message}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button>
    </div> : <BookingHouseInformationDetails data={current.data} values={values} onChange={onChange} />}
  </section>;
}
