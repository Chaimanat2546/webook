"use client";

import type { BookingGalleryCard } from "@/lib/booking-gallery";

interface Props {
  card: BookingGalleryCard;
  month: string;
  today: string;
  disabled?: boolean;
  readOnly?: boolean;
  selectedStart?: string;
  selectedEnd?: string;
  showCaptions?: boolean;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const toneLabel = { free: "ว่าง", confirmed: "ติดจอง", waiting: "รอโอน", repair: "ปิดซ่อม", unknown: "สถานะไม่ทราบ (ติดจอง)", holiday: "วันหยุด", external: "ไม่ว่างจาก iCal" };

export function BookingGalleryDays({ card, month, today, disabled = false, readOnly = false, selectedStart, selectedEnd, showCaptions = false, onBookingSelect, onCreateSelect }: Props) {
  const days = Object.values(card.days).sort((a, b) => a.date.localeCompare(b.date));
  return <>
    <div className="booking-gallery-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="booking-gallery-days" role="group" aria-label={`ปฏิทิน ${card.title}`}>
      {days.map(day => {
        const booked = !!day.bookingId;
        const canCreate = !booked && day.date >= today;
        const outside = !day.date.startsWith(month);
        const external = day.externalBookings?.map(item=>item.provider).join(', ');
        const conflict = !!day.externalBookings?.length && (day.tone !== 'external' || day.externalBookings.length > 1);
        const selected = !!selectedStart && !!selectedEnd && day.date >= selectedStart && day.date < selectedEnd;
        const provider = external === 'airbnb' ? 'Airbnb' : external === 'booking_com' ? 'Booking.com' : external === 'agoda' ? 'Agoda' : external;
        const caption = day.tone === 'external' ? `iCal (${provider ?? 'ภายนอก'})` : day.tone === 'confirmed' ? 'จองในระบบ' : day.tone === 'free' || day.tone === 'holiday' ? '' : toneLabel[day.tone];
        return <button key={day.date} type="button" disabled={disabled || readOnly || (!booked && !canCreate)} tabIndex={disabled || readOnly ? -1 : 0}
          data-selected={selected || undefined}
          aria-label={`${card.title} · ${day.date} · ${toneLabel[day.tone]}${selected ? ' · คืนที่เข้าพักของรายการนี้' : ''}${disabled || readOnly ? "" : booked ? " · เปิดการจอง" : canCreate ? " · สร้างการจอง" : ""}`}
          title={`${day.date} · ${toneLabel[day.tone]}${external ? ` · ${external}` : ''}${conflict ? ' · ข้อมูลทับซ้อน' : ''}`}
          onClick={event => {
            if (disabled || readOnly) return;
            if (day.bookingId) onBookingSelect(card.propertyId, day.bookingId, event.currentTarget);
            else if (canCreate) onCreateSelect(card.propertyId, day.date, event.currentTarget);
          }}
          className={`booking-gallery-day booking-gallery-day-${day.tone}${outside ? " booking-gallery-day-outside" : ""}${day.date === today ? " booking-gallery-day-today" : ""}`}
        ><span>{Number(day.date.slice(-2))}</span>{showCaptions && caption && <span className="ical-day-caption">{caption}</span>}{conflict&&<span aria-label="ข้อมูลทับซ้อน">!</span>}</button>;
      })}
    </div>
  </>;
}
