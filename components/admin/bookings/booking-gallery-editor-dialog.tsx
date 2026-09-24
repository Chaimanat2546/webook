"use client";

import type { RefObject } from "react";
import { BookingEditor } from "@/components/admin/houses/bookings/booking-editor";
import type { Booking } from "@/lib/house-bookings";

interface Props {
  propertyId: string;
  bookingId?: string;
  initialDate?: string;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: (booking: Booking) => void;
}

export function BookingGalleryEditorDialog(props: Props) {
  return <BookingEditor {...props} presentation="dialog" />;
}
