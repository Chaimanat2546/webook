"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingGalleryCard as GalleryCard } from "@/lib/booking-gallery";
import { cn } from "@/lib/utils";
import "./booking-gallery-card.css";

interface Props {
  card: GalleryCard;
  month: string;
  today: string;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const toneLabel = { free: "ว่าง", confirmed: "โอนแล้ว", waiting: "รอโอน", repair: "ปิดซ่อม", holiday: "วันหยุด" };

export function BookingGalleryCard({ card, month, today, onBookingSelect, onCreateSelect }: Props) {
  const days = Object.values(card.days).sort((a, b) => a.date.localeCompare(b.date));
  return <Card size="sm" className="booking-gallery-card min-w-0 gap-2">
    <CardHeader className="min-w-0 gap-1">
      <CardTitle className="truncate" title={card.title}>{card.title}</CardTitle>
      <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">{card.zone || "ไม่ระบุโซน"}</span>
        <span className="shrink-0">ติดจอง {card.bookedNights} คืน</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="booking-gallery-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="booking-gallery-days" role="group" aria-label={`ปฏิทิน ${card.title}`}>
        {days.map(day => {
          const booked = !!day.bookingId;
          const canCreate = !booked && day.date >= today;
          const outside = !day.date.startsWith(month);
          return <button key={day.date} type="button" disabled={!booked && !canCreate}
            aria-label={`${card.title} · ${day.date} · ${toneLabel[day.tone]}${booked ? " · เปิดการจอง" : canCreate ? " · สร้างการจอง" : ""}`}
            title={`${day.date} · ${toneLabel[day.tone]}`}
            onClick={event => {
              if (day.bookingId) onBookingSelect(card.propertyId, day.bookingId, event.currentTarget);
              else if (canCreate) onCreateSelect(card.propertyId, day.date, event.currentTarget);
            }}
            className={cn("booking-gallery-day", "booking-gallery-day-" + day.tone, outside && "booking-gallery-day-outside", day.date === today && "booking-gallery-day-today")}
          >{Number(day.date.slice(-2))}</button>;
        })}
      </div>
      <div className="booking-gallery-legend" aria-label="สีสถานะการจอง">
        <span><i className="booking-gallery-dot booking-gallery-dot-confirmed" />โอนแล้ว</span>
        <span><i className="booking-gallery-dot booking-gallery-dot-waiting" />รอโอน</span>
        <span><i className="booking-gallery-dot booking-gallery-dot-repair" />ปิดซ่อม</span>
      </div>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={event => onCreateSelect(card.propertyId, undefined, event.currentTarget)}>
        <Plus aria-hidden="true" />สร้างการจอง
      </Button>
    </CardContent>
  </Card>;
}
