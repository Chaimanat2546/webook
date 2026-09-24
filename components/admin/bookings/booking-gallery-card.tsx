"use client";

import { useRef, useState } from "react";
import { Expand, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BookingGalleryCard as GalleryCard } from "@/lib/booking-gallery";
import { BookingGalleryDays } from "./booking-gallery-days";
import "./booking-gallery-card.css";

interface Props {
  card: GalleryCard;
  month: string;
  today: string;
  onBookingSelect: (propertyId: string, bookingId: string, trigger: HTMLElement) => void;
  onCreateSelect: (propertyId: string, initialDate: string | undefined, trigger: HTMLElement) => void;
}

export function BookingGalleryCard({ card, month, today, onBookingSelect, onCreateSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement | null>(null);
  const selectedFromExpanded = useRef(false);
  return <Card size="sm" className="booking-gallery-card min-w-0 gap-2">
    <CardHeader className="min-w-0 gap-1">
      <CardTitle className="truncate" title={card.title}>{card.title}</CardTitle>
      <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">{card.zone || "ไม่ระบุโซน"}</span>
        <span className="shrink-0">ติดจอง {card.bookedNights} คืน</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      <BookingGalleryDays card={card} month={month} today={today} onBookingSelect={onBookingSelect} onCreateSelect={onCreateSelect} />
      <div className="booking-gallery-legend" aria-label="สีสถานะการจอง">
        <span><i className="booking-gallery-dot booking-gallery-dot-confirmed" />โอนแล้ว</span>
        <span><i className="booking-gallery-dot booking-gallery-dot-waiting" />รอโอน</span>
        <span><i className="booking-gallery-dot booking-gallery-dot-repair" />ปิดซ่อม</span>
        {Object.values(card.days).some(day => day.tone === "unknown") && <span><i className="booking-gallery-dot booking-gallery-dot-unknown" />สถานะไม่ทราบ (ติดจอง)</span>}
      </div>
      <Button ref={expandButton} type="button" size="sm" variant="outline" className="w-full" aria-haspopup="dialog" aria-expanded={expanded}
        aria-label={`ขยายปฏิทิน ${card.title}`} onClick={() => { selectedFromExpanded.current = false; setExpanded(true); }}>
        <Expand aria-hidden="true" />ขยายปฏิทิน
      </Button>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={event => onCreateSelect(card.propertyId, undefined, event.currentTarget)}>
        <Plus aria-hidden="true" />สร้างการจอง
      </Button>
    </CardContent>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); if (!selectedFromExpanded.current) expandButton.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{card.title}</DialogTitle>
          <DialogDescription>เลือกวันที่ติดจองเพื่อเปิดรายการ หรือเลือกวันที่ว่างเพื่อสร้างการจอง</DialogDescription>
        </DialogHeader>
        <div className="booking-gallery-expanded-scroll">
          <BookingGalleryDays card={card} month={month} today={today} expanded
            getTrigger={dayButton => expandButton.current ?? dayButton}
            onSelected={() => { selectedFromExpanded.current = true; setExpanded(false); }}
            onBookingSelect={onBookingSelect} onCreateSelect={onCreateSelect} />
        </div>
        <DialogClose asChild><Button type="button" variant="outline">ปิด</Button></DialogClose>
      </DialogContent>
    </Dialog>
  </Card>;
}
