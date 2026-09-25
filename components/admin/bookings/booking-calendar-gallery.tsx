"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listBookingGalleryCalendarsAction, listBookingGalleryHousesAction } from "@/app/admin/bookings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { bookingToday } from "@/lib/booking-availability";
import { GalleryPairCache, groupGalleryPairsByMonth, type GalleryVisiblePair } from "@/lib/booking-gallery-cache";
import { bookingGalleryPageNumbers, type GalleryHousePage, type GallerySearchMode } from "@/lib/booking-gallery";
import { BookingGalleryCard as GalleryCard } from "./booking-gallery-card";
import { BookingGallerySkeleton } from "./booking-gallery-skeleton";

const BookingGalleryEditorDialog = dynamic(() => import("./booking-gallery-editor-dialog").then(module => module.BookingGalleryEditorDialog), {
  loading: () => <p role="status" className="rounded-lg border bg-card p-4 text-sm">กำลังเปิดการจอง…</p>,
});

export interface GallerySelection { propertyId: string; bookingId?: string; initialDate?: string }
type PageState =
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; data: GalleryHousePage }
  | { status: "error"; key: string; message: string };

const loadError = "โหลดปฏิทินการจองไม่สำเร็จ กรุณาลองอีกครั้ง";
const pageError = "โหลดรายการบ้านไม่สำเร็จ กรุณาลองอีกครั้ง";

export function BookingCalendarGallery() {
  const [initialMonth] = useState(() => bookingToday().slice(0, 7));
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<GallerySearchMode>("dv");
  const [committedSearch, setCommittedSearch] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageState, setPageState] = useState<PageState>({ status: "loading", key: "dv::1" });
  const [pageRetry, setPageRetry] = useState(0);
  const [houseMonths, setHouseMonths] = useState<Record<string, string>>({});
  const [cacheStates, setCacheStates] = useState(() => ({} as ReturnType<GalleryPairCache["snapshot"]>));
  const [selected, setSelected] = useState<GallerySelection | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  const [cache] = useState(() => new GalleryPairCache());
  const today = bookingToday();
  const publishCache = useCallback(() => setCacheStates(cache.snapshot(Date.now())), [cache]);

  useEffect(() => {
    const timer = setTimeout(() => setCommittedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (search.trim() !== committedSearch) return;
    const key = `${searchMode}:${committedSearch}:${requestedPage}`;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPageState({ status: "loading", key });
      try {
        const result = await listBookingGalleryHousesAction({ search: committedSearch, page: requestedPage, searchMode });
        if (cancelled) return;
        if (!result.ok) { setPageState({ status: "error", key, message: result.message }); return; }
        if (requestedPage > result.data.pageCount) { setRequestedPage(result.data.pageCount); return; }
        setPageState({ status: "ready", key, data: result.data });
      } catch {
        if (!cancelled) setPageState({ status: "error", key, message: pageError });
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, committedSearch, requestedPage, searchMode, pageRetry]);

  const loadPairs = useCallback(async (pairs: GalleryVisiblePair[], force = false) => {
    const groups = force
      ? [...new Map(pairs.map(pair => [pair.month, pairs.filter(candidate => candidate.month === pair.month).map(candidate => candidate.propertyId)]))].map(([month, propertyIds]) => ({ month, propertyIds }))
      : groupGalleryPairsByMonth(cache, pairs, Date.now());
    for (const group of groups) {
      const tokens = group.propertyIds.map(propertyId => ({ propertyId, token: cache.start(propertyId, group.month, Date.now(), force) }))
        .filter((item): item is { propertyId: string; token: number } => item.token !== null);
      if (tokens.length === 0) continue;
      if (mounted.current) publishCache();
      void (async () => {
        try {
          const result = await listBookingGalleryCalendarsAction({ month: group.month, propertyIds: tokens.map(item => item.propertyId) });
          if (!mounted.current) return;
          if (!result.ok) {
            for (const item of tokens) cache.reject(item.propertyId, group.month, item.token, result.message);
          } else {
            const cards = new Map(result.data.map(card => [card.propertyId, card]));
            for (const item of tokens) {
              const card = cards.get(item.propertyId);
              if (card) cache.resolve(item.propertyId, group.month, item.token, card, Date.now());
              else cache.reject(item.propertyId, group.month, item.token, "ไม่พบข้อมูลปฏิทินของบ้านนี้");
            }
          }
        } catch {
          if (!mounted.current) return;
          for (const item of tokens) cache.reject(item.propertyId, group.month, item.token, loadError);
        }
        if (mounted.current) publishCache();
      })();
    }
  }, [cache, publishCache]);

  const currentKey = `${searchMode}:${committedSearch}:${requestedPage}`;
  const page = search.trim() === committedSearch && pageState.key === currentKey && pageState.status === "ready" ? pageState.data : null;
  const houses = page?.houses;

  useEffect(() => {
    if (!houses?.length) return;
    const pairs = houses.map(house => ({ propertyId: house.property_id, month: houseMonths[house.property_id] ?? initialMonth }));
    const timer = setTimeout(() => { void loadPairs(pairs); }, 0);
    return () => clearTimeout(timer);
  }, [houses, houseMonths, initialMonth, loadPairs, cacheStates]);

  useEffect(() => {
    const nextExpiry = cache.nextExpiry(Date.now());
    if (nextExpiry === null) return;
    const timer = setTimeout(publishCache, Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [cache, cacheStates, publishCache]);

  const choose = (selection: GallerySelection, element: HTMLElement) => { trigger.current = element; setSelected(selection); };

  return <main className="space-y-5">
    <div><h1 className="text-2xl font-semibold">การจอง</h1><p className="text-sm text-muted-foreground">ปฏิทินการจองของบ้านทั้งหมด</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <RadioGroup aria-label="ค้นหาจาก" value={searchMode} className="flex flex-wrap gap-4"
        onValueChange={value => { if (value === "dv" || value === "title") { setSearchMode(value); setRequestedPage(1); } }}>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><RadioGroupItem value="dv" />DV ID</label>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><RadioGroupItem value="title" />ชื่อบ้าน</label>
      </RadioGroup>
      <Input ref={searchInput} type="search" aria-label={searchMode === "dv" ? "ค้นหา DV ID" : "ค้นหาชื่อบ้าน"} placeholder={searchMode === "dv" ? "ระบุ DV ID เช่น 123 หรือ DV 123" : "พิมพ์ชื่อบ้าน"} value={search}
        onChange={event => { setSearch(event.target.value); setRequestedPage(1); }} className="max-w-sm" />
      {page && <p role="status" className="text-sm text-muted-foreground">{page.total === 0 ? "ไม่พบบ้าน" : `แสดง ${(page.page - 1) * 6 + 1}–${Math.min(page.page * 6, page.total)} จาก ${page.total} บ้าน`}</p>}
    </div>
    {!page && (pageState.status === "error" && pageState.key === currentKey ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
      {pageState.message}<Button type="button" size="sm" variant="outline" onClick={() => setPageRetry(value => value + 1)}>ลองอีกครั้ง</Button>
    </div> : <BookingGallerySkeleton />)}
    {page && page.total === 0 && <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">{search.trim() ? "ไม่พบบ้านที่ตรงกับคำค้นหา" : "ไม่พบบ้านในรายการ"}</p>}
    {houses && houses.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {houses.map(house => {
        const month = houseMonths[house.property_id] ?? initialMonth;
        const state = cacheStates[`${house.property_id}:${month}`];
        return <GalleryCard key={house.property_id} house={house} card={state?.status === "ready" ? state.card : null} month={month} today={today}
          loading={!state || state.status === "loading"} error={state?.status === "error" ? state.message : ""}
          onMonthChange={(propertyId, nextMonth) => setHouseMonths(current => ({ ...current, [propertyId]: nextMonth }))}
          onRetry={retryMonth => { void loadPairs([{ propertyId: house.property_id, month: retryMonth }], true); }}
          onBookingSelect={(propertyId, bookingId, element) => choose({ propertyId, bookingId }, element)}
          onCreateSelect={(propertyId, initialDate, element) => choose({ propertyId, initialDate }, element)} />;
      })}
    </div>}
    {page && page.pageCount > 1 && <Pagination>
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
      onSaved={() => {
        cache.invalidateHouse(selected.propertyId);
        publishCache();
        const visible = houses?.find(house => house.property_id === selected.propertyId);
        if (visible) void loadPairs([{ propertyId: selected.propertyId, month: houseMonths[selected.propertyId] ?? initialMonth }]);
      }} />}
  </main>;
}
