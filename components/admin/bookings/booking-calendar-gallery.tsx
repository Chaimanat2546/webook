"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listBookingGalleryAction } from "@/app/admin/bookings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { bookingToday } from "@/lib/booking-availability";
import { bookingGalleryCardForMonth, bookingGalleryMonthsToRefresh, bookingGalleryPageNumbers, paginateBookingGallery, parseBookingGalleryQuery, type BookingGalleryCard, type BookingGalleryMonthState } from "@/lib/booking-gallery";
import { BookingGalleryCard as GalleryCard } from "./booking-gallery-card";
import { BookingGalleryEditorDialog } from "./booking-gallery-editor-dialog";

export interface GallerySelection {
  propertyId: string;
  bookingId?: string;
  initialDate?: string;
}

const loadError = "โหลดปฏิทินการจองไม่สำเร็จ กรุณาลองอีกครั้ง";

export function BookingCalendarGallery() {
  const [initialMonth] = useState(() => bookingToday().slice(0, 7));
  const [houses, setHouses] = useState<BookingGalleryCard[] | null>(null);
  const [months, setMonths] = useState<Record<string, BookingGalleryMonthState>>({});
  const [houseMonths, setHouseMonths] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [selected, setSelected] = useState<GallerySelection | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const monthStates = useRef<Record<string, BookingGalleryMonthState>>({});
  const requestSequence = useRef<Record<string, number>>({});
  const mounted = useRef(true);
  const today = bookingToday();

  const loadMonth = useCallback(async (month: string, refresh = false) => {
    const current = monthStates.current[month];
    if (!refresh && current && current.status !== "error") return;
    const request = (requestSequence.current[month] ?? 0) + 1;
    requestSequence.current[month] = request;
    const loading = { ...monthStates.current, [month]: { status: "loading" as const } };
    monthStates.current = loading;
    if (mounted.current) setMonths(loading);
    try {
      const result = await listBookingGalleryAction(parseBookingGalleryQuery({ month }));
      if (!mounted.current || request !== requestSequence.current[month]) return;
      const state: BookingGalleryMonthState = result.ok ? { status: "ready", cards: result.data } : { status: "error", message: result.message };
      const next = { ...monthStates.current, [month]: state };
      monthStates.current = next;
      setMonths(next);
      if (result.ok && month === initialMonth) setHouses(result.data);
    } catch {
      if (!mounted.current || request !== requestSequence.current[month]) return;
      const next = { ...monthStates.current, [month]: { status: "error" as const, message: loadError } };
      monthStates.current = next;
      setMonths(next);
    }
  }, [initialMonth]);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { void loadMonth(initialMonth); }, 0);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [initialMonth, loadMonth]);

  const choose = (selection: GallerySelection, element: HTMLElement) => { trigger.current = element; setSelected(selection); };
  const page = paginateBookingGallery(houses ?? [], search, requestedPage);
  const initialState = months[initialMonth];

  return <main className="space-y-5">
    <div><h1 className="text-2xl font-semibold">การจอง</h1><p className="text-sm text-muted-foreground">ปฏิทินการจองของบ้านทั้งหมด</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <Input ref={searchInput} type="search" aria-label="ค้นหาชื่อบ้านหรือรหัส DV" placeholder="ค้นหาชื่อบ้านหรือรหัส DV" value={search}
        onChange={event => { setSearch(event.target.value); setRequestedPage(1); }} className="max-w-sm" />
      {houses && <p role="status" className="text-sm text-muted-foreground">{page.total === 0 ? "ไม่พบบ้าน" : `แสดง ${(page.page - 1) * 6 + 1}–${Math.min(page.page * 6, page.total)} จาก ${page.total} บ้าน`}</p>}
    </div>
    {!houses && (initialState?.status === "error" ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
      {initialState.message}<Button type="button" size="sm" variant="outline" onClick={() => { void loadMonth(initialMonth); }}>ลองอีกครั้ง</Button>
    </div> : <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">กำลังโหลดปฏิทินการจอง…</p>)}
    {houses && page.total === 0 && <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">{search.trim() ? "ไม่พบบ้านที่ตรงกับคำค้นหา" : "ไม่พบบ้านในรายการ"}</p>}
    {houses && page.cards.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {page.cards.map(house => {
        const month = houseMonths[house.propertyId] ?? initialMonth;
        const state = bookingGalleryCardForMonth(house.propertyId, month, months);
        return <GalleryCard key={house.propertyId} house={house} card={state.card} month={month} today={today}
          loading={state.status === "loading"} error={state.status === "ready" && !state.card ? "ไม่พบข้อมูลปฏิทินของบ้านนี้" : state.message}
          onMonthChange={(propertyId, nextMonth) => { setHouseMonths(current => ({ ...current, [propertyId]: nextMonth })); void loadMonth(nextMonth); }}
          onRetry={retryMonth => { void loadMonth(retryMonth, true); }}
          onBookingSelect={(propertyId, bookingId, element) => choose({ propertyId, bookingId }, element)}
          onCreateSelect={(propertyId, initialDate, element) => choose({ propertyId, initialDate }, element)} />;
      })}
    </div>}
    {houses && page.pageCount > 1 && <Pagination>
      <PaginationContent className="flex-wrap justify-center">
        <PaginationItem><Button type="button" variant="outline" size="icon-sm" aria-label="หน้าก่อนหน้า" disabled={page.page <= 1} onClick={() => setRequestedPage(page.page - 1)}><ChevronLeft aria-hidden="true" /></Button></PaginationItem>
        {bookingGalleryPageNumbers(page.page, page.pageCount).map((number, index) => number === "ellipsis" ? <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem> : <PaginationItem key={number}>
          <Button type="button" variant={number === page.page ? "outline" : "ghost"} size="icon-sm" aria-label={`หน้า ${number}`} aria-current={number === page.page ? "page" : undefined}
            onClick={() => setRequestedPage(number)}>{number}</Button>
        </PaginationItem>)}
        <PaginationItem><Button type="button" variant="outline" size="icon-sm" aria-label="หน้าถัดไป" disabled={page.page >= page.pageCount} onClick={() => setRequestedPage(page.page + 1)}><ChevronRight aria-hidden="true" /></Button></PaginationItem>
      </PaginationContent>
    </Pagination>}
    {selected && <BookingGalleryEditorDialog key={`${selected.propertyId}:${selected.bookingId ?? "new"}:${selected.initialDate ?? ""}`}
      propertyId={selected.propertyId} bookingId={selected.bookingId} initialDate={selected.initialDate} triggerRef={trigger}
      onClose={() => { setSelected(null); requestAnimationFrame(() => { if (trigger.current?.isConnected && !(trigger.current instanceof HTMLButtonElement && trigger.current.disabled)) trigger.current.focus(); else searchInput.current?.focus(); }); }}
      onSaved={() => { for (const month of bookingGalleryMonthsToRefresh(monthStates.current)) void loadMonth(month, true); }} />}
  </main>;
}
