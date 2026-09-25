"use client";

import type { BookingGalleryCard } from "@/lib/booking-gallery";

interface Props {
  card: BookingGalleryCard;
  month: string;
  today: string;
  disabled?: boolean;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const toneLabel = { free: "ว่าง", confirmed: "โอนแล้ว", waiting: "รอโอน", repair: "ปิดซ่อม", unknown: "สถานะไม่ทราบ (ติดจอง)", holiday: "วันหยุด" };

export function BookingGalleryDays({ card, month, today, disabled = false, onBookingSelect, onCreateSelect }: Props) {
  const days = Object.values(card.days).sort((a, b) => a.date.localeCompare(b.date));
  return <>
    <div className="booking-gallery-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="booking-gallery-days" role="group" aria-label={`ปฏิทิน ${card.title}`}>
      {days.map(day => {
        const booked = !!day.bookingId;
        const canCreate = !booked && day.date >= today;
        const outside = !day.date.startsWith(month);
        return <button key={day.date} type="button" disabled={disabled || (!booked && !canCreate)} tabIndex={disabled ? -1 : 0}
          aria-label={`${card.title} · ${day.date} · ${toneLabel[day.tone]}${disabled ? "" : booked ? " · เปิดการจอง" : canCreate ? " · สร้างการจอง" : ""}`}
          title={`${day.date} · ${toneLabel[day.tone]}`}
          onClick={event => {
            if (disabled) return;
            if (day.bookingId) onBookingSelect(card.propertyId, day.bookingId, event.currentTarget);
            else if (canCreate) onCreateSelect(card.propertyId, day.date, event.currentTarget);
          }}
          className={`booking-gallery-day booking-gallery-day-${day.tone}${outside ? " booking-gallery-day-outside" : ""}${day.date === today ? " booking-gallery-day-today" : ""}`}
        >{Number(day.date.slice(-2))}</button>;
      })}
    </div>
  </>;
}
