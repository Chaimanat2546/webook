"use client";

import type { BookingGalleryCard } from "@/lib/booking-gallery";

interface Props {
  card: BookingGalleryCard;
  month: string;
  today: string;
  expanded?: boolean;
  getTrigger?: (dayButton: HTMLElement) => HTMLElement;
  onSelected?: () => void;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const toneLabel = { free: "ว่าง", confirmed: "โอนแล้ว", waiting: "รอโอน", repair: "ปิดซ่อม", holiday: "วันหยุด" };

export function BookingGalleryDays({ card, month, today, expanded = false, getTrigger, onSelected, onBookingSelect, onCreateSelect }: Props) {
  const days = Object.values(card.days).sort((a, b) => a.date.localeCompare(b.date));
  return <>
    <div className={`booking-gallery-weekdays${expanded ? " booking-gallery-weekdays-expanded" : ""}`} aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className={`booking-gallery-days${expanded ? " booking-gallery-days-expanded" : ""}`} role="group" aria-label={`ปฏิทิน ${card.title}`}>
      {days.map(day => {
        const booked = !!day.bookingId;
        const canCreate = !booked && day.date >= today;
        const outside = !day.date.startsWith(month);
        return <button key={day.date} type="button" disabled={!booked && !canCreate} tabIndex={expanded ? 0 : -1}
          aria-label={`${card.title} · ${day.date} · ${toneLabel[day.tone]}${booked ? " · เปิดการจอง" : canCreate ? " · สร้างการจอง" : ""}`}
          title={`${day.date} · ${toneLabel[day.tone]}`}
          onClick={event => {
            const trigger = getTrigger?.(event.currentTarget) ?? event.currentTarget;
            if (day.bookingId) onBookingSelect(card.propertyId, day.bookingId, trigger);
            else if (canCreate) onCreateSelect(card.propertyId, day.date, trigger);
            onSelected?.();
          }}
          className={`booking-gallery-day booking-gallery-day-${day.tone}${outside ? " booking-gallery-day-outside" : ""}${day.date === today ? " booking-gallery-day-today" : ""}`}
        >{Number(day.date.slice(-2))}</button>;
      })}
    </div>
  </>;
}
