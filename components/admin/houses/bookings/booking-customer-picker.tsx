"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, UserPlus, UserRound } from "lucide-react";
import { searchBookingCustomersAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { bookingCustomerName, type BookingCustomer } from "@/lib/house-bookings";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingCustomerForm } from "./booking-customer-form";
import { BookingCustomersSkeleton } from "./booking-skeletons";

interface Props { propertyId: string; customer: BookingCustomer | null; onSelect: (customer: BookingCustomer) => void; onBusy: (busy: boolean) => void }

export function BookingCustomerPicker({ propertyId, customer, onSelect, onBusy }: Props) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<BookingCustomer | null>(null);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<BookingCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    if (!open || query.trim().length === 1) return;
    const counter = sequence;
    const current = ++counter.current;
    const timer = setTimeout(async () => {
      try {
        const result = await searchBookingCustomersAction(propertyId, query.trim());
        if (current !== counter.current) return;
        if (result.ok) { setCustomers(result.data); setLoaded(true); }
        else setError(result.message);
      } catch { if (current === counter.current) setError("ค้นหาลูกค้าไม่สำเร็จ"); }
      finally { if (current === counter.current) setLoading(false); }
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); counter.current++; };
  }, [open, query, propertyId, retry]);
  function resetSearch(next: string, isOpen: boolean) {
    sequence.current++; setQuery(next); setCustomers([]); setLoaded(false); setError(""); setLoading(isOpen && next.trim().length !== 1);
  }
  function changeOpen(next: boolean) { setOpen(next); resetSearch("", next); }
  function apply(next: BookingCustomer) { onSelect(next); setPending(null); setCreateOpen(false); setEditOpen(false); onBusy(false); changeOpen(false); }
  function choose(next: BookingCustomer) {
    changeOpen(false);
    if (customer && customer.id !== next.id) { setPending(next); onBusy(true); }
    else apply(next);
  }
  return <div ref={setPortalContainer} className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />ลูกค้า</h3>
      <Button type="button" size="sm" variant="outline" onClick={() => { changeOpen(false); setCreateOpen(true); onBusy(true); }}><UserPlus aria-hidden className="size-4" />เพิ่มลูกค้าใหม่</Button>
    </div>
    <Combobox filter={null} items={customers} inputValue={open ? query : customer ? bookingCustomerName(customer) : ""}
      itemToStringLabel={bookingCustomerName} itemToStringValue={(item: BookingCustomer) => item.id}
      open={open} onOpenChange={(next, details) => {
        // Base UI updates the typed query before it opens the popup.
        if (next && details.reason === "input-change") setOpen(true);
        else changeOpen(next);
      }} onInputValueChange={(value, details) => { if (details.reason === "input-change") resetSearch(value, true); }}
      onValueChange={(next: BookingCustomer | null) => { if (next) choose(next); }}>
      <ComboboxInput className="w-full" aria-label="ลูกค้า" placeholder="ค้นหาชื่อหรือเบอร์โทร" maxLength={100} />
      <ComboboxContent container={portalContainer}>
        {loading && <BookingCustomersSkeleton />}
        {query.trim().length === 1 && <p className="p-3 text-sm text-muted-foreground">พิมพ์อย่างน้อย 2 ตัวอักษร</p>}
        {error && <div role="alert" className="space-y-2 p-3"><p className="text-sm text-destructive">{error}</p><Button size="sm" type="button" variant="outline" onClick={() => { resetSearch(query, true); setRetry(value => value + 1); }}>ลองใหม่</Button></div>}
        {!loading && !error && loaded && <ComboboxList>{(item: BookingCustomer) => <ComboboxItem key={item.id} value={item}><span className="min-w-0"><span className="block truncate font-medium">{bookingCustomerName(item)}</span><span className="block text-xs text-muted-foreground">{item.phone}</span></span></ComboboxItem>}</ComboboxList>}
        {!loading && !error && loaded && customers.length === 0 && <p className="p-3 text-sm text-muted-foreground">ไม่พบลูกค้า</p>}
      </ComboboxContent>
    </Combobox>
    {customer && <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">{bookingCustomerName(customer)}</p><p className="text-muted-foreground">{customer.phone}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { setEditOpen(true); onBusy(true); }}><Pencil aria-hidden className="size-4" />แก้ไขข้อมูลลูกค้า</Button></div>}
    {editOpen && customer && <BookingCustomerForm propertyId={propertyId} customerId={customer.id} onClose={() => { setEditOpen(false); onBusy(false); }} onSelect={next => { setEditOpen(false); choose(next); }} />}
    {createOpen && <BookingCustomerForm propertyId={propertyId} onClose={() => { setCreateOpen(false); onBusy(false); }} onSelect={next => { setCreateOpen(false); choose(next); }} />}
    <Dialog open={pending !== null} onOpenChange={next => { if (!next) { setPending(null); onBusy(false); } }}>
      <DialogContent><DialogHeader><DialogTitle>เปลี่ยนลูกค้า?</DialogTitle><DialogDescription>เลือก {pending ? bookingCustomerName(pending) : ""} แทนลูกค้าปัจจุบันในรายการจองนี้</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={() => { setPending(null); onBusy(false); }}>ยกเลิก</Button><Button type="button" onClick={() => { if (pending) apply(pending); }}>เลือกลูกค้านี้</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
