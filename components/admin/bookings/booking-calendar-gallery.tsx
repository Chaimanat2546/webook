"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listBookingGalleryAction } from "@/app/admin/bookings/actions";
import { Button } from "@/components/ui/button";
import { bookingToday } from "@/lib/booking-availability";
import { parseBookingGalleryQuery, type BookingGalleryCard, type BookingGalleryQuery } from "@/lib/booking-gallery";
import { BookingGalleryCard as GalleryCard } from "./booking-gallery-card";

export interface GallerySelection {
  propertyId: string;
  bookingId?: string;
  initialDate?: string;
}

function currentBangkokGalleryQuery(): BookingGalleryQuery {
  return parseBookingGalleryQuery({ month: bookingToday().slice(0, 7) });
}

function shiftedMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function BookingCalendarGallery() {
  const [query, setQuery] = useState<BookingGalleryQuery>(() => currentBangkokGalleryQuery());
  const [cards, setCards] = useState<BookingGalleryCard[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [createPropertyId, setCreatePropertyId] = useState("");
  const [selected, setSelected] = useState<GallerySelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const today = bookingToday();

  const load = useCallback(async (isActive: () => boolean) => {
    setLoading(true);
    setError("");
    try {
      const result = await listBookingGalleryAction(query);
      if (!isActive()) return;
      if (result.ok) {
        setCards(result.data);
        if (query.zone === null) setZones([...new Set(result.data.map(card => card.zone).filter((zone): zone is string => !!zone))].sort((a, b) => a.localeCompare(b, "th")));
      } else {
        setCards([]);
        setError(result.message);
      }
    } catch {
      if (isActive()) { setCards([]); setError("โหลดปฏิทินการจองไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { void load(() => active); }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [load, retry]);

  const updateQuery = (values: Partial<Pick<BookingGalleryQuery, "month" | "zone" | "order">>) => {
    setQuery(previous => parseBookingGalleryQuery({ month: values.month ?? previous.month, zone: values.zone === undefined ? previous.zone : values.zone, order: values.order ?? previous.order }));
  };
  const choose = (selection: GallerySelection, element: HTMLElement) => { trigger.current = element; setSelected(selection); };
  const creationTarget = cards.some(card => card.propertyId === createPropertyId) ? createPropertyId : cards[0]?.propertyId;

  return <main className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">การจอง</h1><p className="text-sm text-muted-foreground">ปฏิทินการจองของบ้านทั้งหมด</p></div>
      <div className="flex items-center gap-2">
        <select aria-label="บ้านสำหรับการจองใหม่" value={creationTarget ?? ""} disabled={loading || cards.length === 0}
          onChange={event => setCreatePropertyId(event.target.value)} className="h-8 max-w-36 rounded-lg border border-input bg-background px-2 text-sm">
          {cards.map(card => <option key={card.propertyId} value={card.propertyId}>{card.title}</option>)}
        </select>
        <Button type="button" size="sm" disabled={loading || !creationTarget} onClick={event => { if (creationTarget) choose({ propertyId: creationTarget }, event.currentTarget); }}><Plus aria-hidden="true" />สร้างการจอง</Button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" aria-label="เดือนก่อนหน้า" onClick={() => updateQuery({ month: shiftedMonth(query.month, -1) })}><ChevronLeft aria-hidden="true" /></Button>
        <label className="sr-only" htmlFor="booking-gallery-month">เดือนที่แสดง</label>
        <input id="booking-gallery-month" type="month" aria-label="เดือนที่แสดง" value={query.month} onChange={event => { if (event.target.value) updateQuery({ month: event.target.value }); }} className="h-7 w-32 rounded-lg border border-input bg-background px-2 text-sm" />
        <Button type="button" variant="outline" size="icon-sm" aria-label="เดือนถัดไป" onClick={() => updateQuery({ month: shiftedMonth(query.month, 1) })}><ChevronRight aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => updateQuery({ month: bookingToday().slice(0, 7) })}>วันนี้</Button>
      </div>
      <strong className="mr-auto text-sm font-medium">{monthLabel(query.month)}</strong>
      <select aria-label="กรองตามโซน" value={query.zone ?? ""} onChange={event => updateQuery({ zone: event.target.value || null })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
        <option value="">ทุกโซน</option>{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
      </select>
      <select aria-label="เรียงลำดับบ้าน" value={query.order} onChange={event => updateQuery({ order: event.target.value === "booked" ? "booked" : "title" })} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
        <option value="title">เรียงตามชื่อ</option><option value="booked">คืนที่ติดจองมากสุด</option>
      </select>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}<Button type="button" size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button></div>}
    <div aria-busy={loading}>
      {loading ? <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">กำลังโหลดปฏิทินการจอง…</p>
        : !error && cards.length === 0 ? <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">ไม่พบบ้านใน{query.zone ? `โซน ${query.zone}` : "รายการ"}</p>
          : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {cards.map(card => <GalleryCard key={card.propertyId} card={card} month={query.month} today={today}
              onBookingSelect={(propertyId, bookingId, element) => choose({ propertyId, bookingId }, element)}
              onCreateSelect={(propertyId, initialDate, element) => choose({ propertyId, initialDate }, element)} />)}
          </div>}
    </div>
    {selected && <p role="status" className="sr-only">{selected.bookingId ? "เลือกรายการจองแล้ว" : "เลือกบ้านสำหรับสร้างการจองแล้ว"}</p>}
  </main>;
}
