"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import FullCalendar, { type DatesSetInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import thLocale from "@fullcalendar/react/locales/th";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "./booking-calendar.css";
import { Button } from "@/components/ui/button";
import { bookingEvent, type Booking } from "@/lib/house-bookings";
import { listHouseBookingsAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { BookingEditor } from "./booking-editor";

export function HouseBookingCalendar({ propertyId }: { propertyId: string }) {
  return <BookingCalendarWorkspace key={propertyId} propertyId={propertyId} />;
}

function BookingCalendarWorkspace({ propertyId }: { propertyId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const range = useRef<{ start: string; end: string } | null>(null);
  const request = useRef(0);
  const trigger = useRef<HTMLElement | null>(null);
  const bangkokParts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const bangkokToday = ["year", "month", "day"].map(type => bangkokParts.find(part => part.type === type)?.value).join("-");
  useEffect(() => () => { request.current++; }, []);
  const load = useCallback(async (start: string, end: string) => {
    const sequence = ++request.current;
    setLoading(true); setError(""); setBookings([]);
    try {
      const result = await listHouseBookingsAction(propertyId, start, end);
      if (sequence !== request.current) return;
      if (result.ok) setBookings(result.data);
      else setError(result.message);
    } catch { if (sequence === request.current) setError("โหลดการจองไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { if (sequence === request.current) setLoading(false); }
  }, [propertyId]);
  const datesSet = useCallback((info: DatesSetInfo) => {
    const next = { start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) };
    range.current = next;
    void load(next.start, next.end);
  }, [load]);
  function refresh() { if (range.current) void load(range.current.start, range.current.end); }
  return <div className="house-booking-calendar flex h-full min-h-0 flex-col gap-2">
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="สีสถานะการจอง">
      <span><i className="mr-1 inline-block size-2 rounded-full bg-red-600" />จองแล้ว</span>
      <span><i className="mr-1 inline-block size-2 rounded-full bg-green-700" />รอยืนยัน</span>
      <span><i className="mr-1 inline-block size-2 rounded-full bg-gray-500" />ยกเลิก</span>
    </div>
    {error && <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{error}<Button variant="outline" onClick={refresh}>ลองอีกครั้ง</Button></div>}
    <div className="min-h-0 flex-1" aria-busy={loading}>
      <FullCalendar key={propertyId} plugins={[dayGridPlugin, classicThemePlugin]} initialView="dayGridMonth" locale={thLocale} now={bangkokToday} initialDate={bangkokToday}
        firstDay={1} height="100%" headerToolbar={{ start: "title", end: "prev,today,next" }}
        toolbarClass="house-booking-toolbar" toolbarTitleClass="house-booking-month"
        events={bookings.map(bookingEvent)} datesSet={datesSet}
        editable={false} eventInteractive dayMaxEvents={1} displayEventTime={false}
        eventClick={info => { trigger.current = info.el; setSelected(info.event.id); }} />
    </div>
    <p role="status" className="sr-only">{loading ? "กำลังโหลดการจอง…" : !error && bookings.length === 0 ? "ไม่มีการจองในช่วงนี้" : "แถบครอบคลุมคืนที่เข้าพัก · วันเช็กเอาต์เริ่มรับการจองถัดไปได้"}</p>
    {selected && <BookingEditor key={selected} propertyId={propertyId} bookingId={selected}
      onClose={() => { setSelected(null); requestAnimationFrame(() => trigger.current?.focus()); }}
      onSaved={() => { toast.success("บันทึกการจองแล้ว"); refresh(); }} />}
  </div>;
}
