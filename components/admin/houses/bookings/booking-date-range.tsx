"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import thLocale from "@fullcalendar/react/locales/th";
import { nightsBetween } from "@/lib/house-bookings";
import "./booking-date-range.css";
import { Button } from "@/components/ui/button";
import { BookingCalendarSkeleton } from "./booking-skeletons";
import { listHouseBookingsAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { bookingConflict, bookingToday, occupiedNight, type OccupiedBooking } from "@/lib/booking-availability";

interface Props {
  propertyId: string; excludeId?: string; start: string; end: string; revision: number;
  originalStart?: string; originalEnd?: string; originalStatus?: string;
  onChange: (start: string, end: string) => void;
  onValid: (valid: boolean) => void;
}
function nextDay(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function displayDate(day: string) {
  return day ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)) : "เลือกวัน";
}
export function BookingDateRange({ propertyId, excludeId, start, end, revision, originalStart, originalEnd, originalStatus, onChange, onValid }: Props) {
  const [today, setToday] = useState(() => bookingToday());
  useEffect(() => {
    const timer = setInterval(() => setToday(bookingToday()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const unchangedStay = !!excludeId && originalStatus !== "cancelled" && start === originalStart && end === originalEnd;
  const past = !!start && start < today && !unchangedStay;
  const [view, setView] = useState<{ start: string; end: string } | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; rows: OccupiedBooking[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const from = view ? [view.start, start].filter(Boolean).sort()[0] : "";
  const until = view ? [view.end, end || (start && nextDay(start, 1))].filter(Boolean).sort().at(-1)! : "";
  const key = `${propertyId}:${from}:${until}:${revision}:${retry}`;
  const ready = loaded?.key === key;
  const error = failure?.key === key ? failure.message : "";
  const loading = !ready && !error;
  const rows = ready ? loaded.rows : [];
  const conflict = start && end ? bookingConflict(rows, start, end, excludeId) : undefined;
  useEffect(() => {
    onValid(!!ready && !!start && end > start && !conflict && !past);
  }, [ready, start, end, conflict, past, onValid]);
  useEffect(() => {
    if (!from || !until) return;
    let active = true;
    async function load() {
      const rows: OccupiedBooking[] = [];
      try {
        for (let cursor = from; cursor < until;) {
          const limit = nextDay(cursor, 62);
          const end = limit < until ? limit : until;
          const result = await listHouseBookingsAction(propertyId, cursor, end);
          if (!active) return;
          if (!result.ok) throw new Error(result.message);
          rows.push(...result.data);
          cursor = end;
        }
        if (active) { setFailure(null); setLoaded({ key, rows }); }
      } catch (cause) { if (active) setFailure({ key, message: cause instanceof Error ? cause.message : "โหลดวันว่างไม่สำเร็จ" }); }
    }
    void load();
    return () => { active = false; };
  }, [from, until, key, propertyId]);
  const pickingEnd = !!start && !end;
  return <div className="booking-range space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={`rounded-xl border p-3 text-left ${!pickingEnd ? "border-blue-600 bg-blue-50 text-blue-950" : ""}`} onClick={() => onChange("", "")}><span className="block text-xs">1 · เช็กอิน</span><strong>{displayDate(start)}</strong></button>
      <button type="button" disabled={!start} className={`rounded-xl border p-3 text-left ${pickingEnd ? "border-blue-600 bg-blue-50 text-blue-950" : ""}`} onClick={() => onChange(start, "")}><span className="block text-xs">2 · เช็กเอาต์</span><strong>{displayDate(end)}</strong></button>
    </div>
    <p className="text-sm font-medium" role="status">{loading ? "กำลังโหลดวันว่าง…" : error ? "ยังตรวจสอบวันว่างไม่ได้" : pickingEnd ? "เลือกวันเช็กเอาต์" : start && end ? `${displayDate(start)} – ${displayDate(end)} · ${nightsBetween(start, end)} คืน` : "เลือกวันเช็กอิน"}</p>
    <div className="flex flex-wrap gap-3 text-xs"><span className="text-red-700">● โอนแล้ว</span><span className="text-green-700">● รอโอน</span><span className="text-gray-600">● ปิดซ่อม</span><span className="text-blue-700">● ช่วงที่เลือก</span></div>
    {error && <div role="alert" className="text-sm text-destructive">{error}<Button type="button" variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button></div>}
    {past && <p role="alert" className="text-sm text-destructive">เลือกวันเข้าพักตั้งแต่วันนี้เป็นต้นไป</p>}
    {ready && conflict && <p role="alert" className="text-sm text-destructive">ช่วงนี้ติดจอง {conflict.check_in} ถึง {conflict.check_out} กรุณาเลือกช่วงใหม่</p>}
    <div className="relative h-[380px]" aria-busy={loading}>
    <div className={loading ? "invisible" : undefined} inert={loading}>
    <FullCalendar plugins={[dayGridPlugin, classicThemePlugin]} initialView="dayGridMonth" initialDate={start || undefined} locale={thLocale} firstDay={1}
      height={380} fixedWeekCount={false} headerToolbar={{ start: "title", end: "prev,next" }} toolbarTitleClass="booking-range-title" toolbarClass="booking-range-toolbar"
      datesSet={info => setView({ start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) })}
      dayCellClass="booking-range-cell"
      dayCellTopClass="booking-range-top"
      dayCellTopInnerClass="booking-range-day-content"
      dayCellDidMount={info => {
        // FullCalendar hides decorative day numbers; these are interactive date buttons.
        info.el.querySelector(".booking-range-day-content")?.removeAttribute("aria-hidden");
      }}
      dayCellTopContent={info => {
        const day = `${info.date.getFullYear()}-${String(info.date.getMonth() + 1).padStart(2, "0")}-${String(info.date.getDate()).padStart(2, "0")}`;
        const occupied = occupiedNight(rows, day, excludeId);
        const canEnd = pickingEnd && day > start && !bookingConflict(rows, start, day, excludeId);
        const blocked = day < today || !ready || (!!occupied && !canEnd);
        const selected = day === start || day === end || (!!end && day > start && day < end);
        const label = occupied ? occupied.status === "repair" ? "ปิดซ่อม" : occupied.status === "waiting" ? "รอโอน" : "โอนแล้ว" : "ว่าง";
        const caption = day === start ? "เข้า" : day === end ? "ออก" : occupied && canEnd ? "ออกได้" : occupied ? label : "";
        const reason = day < today ? "วันที่ผ่านมาแล้ว" : !ready ? "กำลังโหลดวันว่าง" : blocked ? `${displayDate(day)} ${label} เลือกเข้าพักไม่ได้` : pickingEnd && !canEnd ? "เลือกวันเช็กอิน" : canEnd ? "เลือกวันเช็กเอาต์" : "เลือกวันเช็กอิน";
        return <button type="button" disabled={blocked} title={reason} aria-label={`${day} ${label} ${reason}`} aria-pressed={selected}
          data-past={day < today || undefined}
          data-range={day === start ? "start" : day === end ? "end" : selected ? "middle" : undefined}
          data-status={occupied ? occupied.status === "repair" ? "repair" : occupied.status === "waiting" ? "waiting" : "confirmed" : "free"}
          className="booking-range-day"
          onClick={() => { if (canEnd) onChange(start, day); else onChange(day, ""); }}>
          <span className="text-base font-semibold">{info.dayNumberText}</span><span className="min-h-3 text-[10px] leading-3">{caption}</span>
        </button>;

      }} />
    </div>
    {loading && <div className="absolute inset-0"><BookingCalendarSkeleton compact /></div>}
    </div>
    <p className="text-xs text-muted-foreground">“ออกได้” คือเช็กเอาต์ก่อนรายการถัดไป</p>
  </div>;
}

