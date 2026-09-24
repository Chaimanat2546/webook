"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adjacentBookingGalleryMonth } from "@/lib/booking-gallery-month";
import type { BookingGalleryCard as GalleryCard } from "@/lib/booking-gallery";
import { BookingGalleryDays } from "./booking-gallery-days";
import "./booking-gallery-card.css";

interface Props {
  house: GalleryCard;
  card: GalleryCard | null;
  month: string;
  today: string;
  loading: boolean;
  error: string;
  onMonthChange: (propertyId: string, month: string) => void;
  onRetry: (month: string) => void;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function BookingGalleryCard({ house, card, month, today, loading, error, onMonthChange, onRetry, onBookingSelect, onCreateSelect }: Props) {
  const previousMonth = adjacentBookingGalleryMonth(month, -1);
  const nextMonth = adjacentBookingGalleryMonth(month, 1);
  return <Card size="sm" className="booking-gallery-card min-w-0 gap-2">
    <CardHeader className="min-w-0 gap-1">
      <CardTitle className="truncate" title={house.title}>{house.title}</CardTitle>
      <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">DV {house.propertyId}{house.zone ? ` · ${house.zone}` : ""}</span>
        {card && <span className="shrink-0">ติดจอง {card.bookedNights} คืน</span>}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        <Button type="button" variant="outline" size="icon-sm" aria-label={`เดือนก่อนหน้า ${house.title}`} disabled={!previousMonth}
          onClick={() => { if (previousMonth) onMonthChange(house.propertyId, previousMonth); }}><ChevronLeft aria-hidden="true" /></Button>
        <strong className="min-w-0 flex-1 text-center text-sm font-medium" aria-live="polite">{monthLabel(month)}</strong>
        <Button type="button" variant="outline" size="icon-sm" aria-label={`เดือนถัดไป ${house.title}`} disabled={!nextMonth}
          onClick={() => { if (nextMonth) onMonthChange(house.propertyId, nextMonth); }}><ChevronRight aria-hidden="true" /></Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-2" aria-busy={loading}>
      {card ? <>
        <BookingGalleryDays card={card} month={month} today={today} onBookingSelect={onBookingSelect} onCreateSelect={onCreateSelect} />
        <div className="booking-gallery-legend" aria-label="สีสถานะการจอง">
          <span><i className="booking-gallery-dot booking-gallery-dot-confirmed" />โอนแล้ว</span>
          <span><i className="booking-gallery-dot booking-gallery-dot-waiting" />รอโอน</span>
          <span><i className="booking-gallery-dot booking-gallery-dot-repair" />ปิดซ่อม</span>
          {Object.values(card.days).some(day => day.tone === "unknown") && <span><i className="booking-gallery-dot booking-gallery-dot-unknown" />สถานะไม่ทราบ (ติดจอง)</span>}
        </div>
      </> : error ? <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
        <p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => onRetry(month)}>ลองอีกครั้ง</Button>
      </div> : <p role="status" className="rounded-lg border p-8 text-center text-sm text-muted-foreground">กำลังโหลดปฏิทิน…</p>}
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={event => onCreateSelect(house.propertyId, undefined, event.currentTarget)}>
        <Plus aria-hidden="true" />สร้างการจอง
      </Button>
    </CardContent>
  </Card>;
}
