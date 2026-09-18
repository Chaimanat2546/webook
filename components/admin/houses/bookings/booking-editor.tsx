"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOKING_STATUSES, bookingCustomerName, nightsBetween, parseBookingUpdate, type Booking, type BookingCustomer, type BookingUpdate } from "@/lib/house-bookings";
import { getHouseBookingAction, saveHouseBookingAction, searchBookingCustomersAction } from "@/app/admin/houses/[propertyId]/bookings/actions";

interface EditorProps { propertyId: string; bookingId: string; onClose: () => void; onSaved: (booking: Booking) => void }
interface FormProps { propertyId: string; booking: Booking; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void; onClose: () => void; onSaved: (booking: Booking) => void }

export function BookingEditor({ propertyId, bookingId, onClose, onSaved }: EditorProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [discardOpen, setDiscardOpen] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const dirty = useRef(false), saving = useRef(false), sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setError("");
    try {
      const result = await getHouseBookingAction(propertyId, bookingId);
      if (current !== sequence.current) return;
      if (result.ok) setBooking(result.data); else setError(result.message);
    } catch { if (current === sequence.current) setError("โหลดรายละเอียดไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [propertyId, bookingId]);
  useEffect(() => {
    const counter = sequence;
    const timer = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(timer); counter.current++; };
  }, [load]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current || saving.current) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  function close() {
    if (saving.current || discardOpen) return;
    if (dirty.current) setDiscardOpen(true); else onClose();
  }
  return <Sheet open onOpenChange={open => { if (!open) close(); }}>
    <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg" showCloseButton={false}>
      <SheetHeader className="border-b p-5">
        <div className="flex items-start justify-between gap-3"><div>
          <SheetTitle className="flex items-center gap-2"><CalendarDays aria-hidden className="size-5 shrink-0" />แก้ไขการจอง</SheetTitle>
          <SheetDescription className="break-words">{booking?.booking_code} · DV-{propertyId}</SheetDescription>
        </div><Button variant="ghost" size="sm" onClick={close} aria-label="ปิดแผงแก้ไข">ปิด</Button></div>
      </SheetHeader>
      {loading ? <p role="status" className="p-5">กำลังโหลดรายละเอียด…</p> : error ? <div className="space-y-3 p-5"><p role="alert" className="text-destructive">{error}</p><Button onClick={() => void load()}>ลองอีกครั้ง</Button></div> : booking &&
        <BookingForm propertyId={propertyId} booking={booking} onDirty={value => { dirty.current = value; }} onSaving={value => { saving.current = value; }} onClose={close}
          onSaved={value => { dirty.current = false; onSaved(value); onClose(); }} />}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()}
          onOpenAutoFocus={event => { event.preventDefault(); keepEditingRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>ทิ้งการแก้ไข?</DialogTitle>
            <DialogDescription>การเปลี่ยนแปลงนี้ยังไม่ได้บันทึก</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={keepEditingRef} type="button" variant="outline" onClick={() => setDiscardOpen(false)}>กลับไปแก้ไข</Button>
            <Button type="button" variant="destructive" onClick={() => { if (!saving.current) { dirty.current = false; onClose(); } }}>ทิ้งการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SheetContent>
  </Sheet>;
}

function BookingForm({ propertyId, booking, onDirty, onSaving, onClose, onSaved }: FormProps) {
  const [form, setForm] = useState<BookingUpdate>(() => parseInitial(booking));
  const [customer, setCustomer] = useState(booking.customer);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<BookingCustomer[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false), searchSequence = useRef(0);
  let nights = 0;
  try { nights = nightsBetween(form.check_in, form.check_out); } catch { /* Incomplete date field. */ }
  const dirty = JSON.stringify(form) !== JSON.stringify(parseInitial(booking)) || (nights > 0 && nights !== booking.quantity);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    const counter = searchSequence;
    const current = ++counter.current;
    if (!searchOpen || query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchBookingCustomersAction(propertyId, query.trim());
        if (current !== searchSequence.current) return;
        if (result.ok) setCustomers(result.data); else setSearchError(result.message);
      } catch { if (current === searchSequence.current) setSearchError("ค้นหาไม่สำเร็จ กรุณาลองค้นหาอีกครั้ง"); }
      finally { if (current === searchSequence.current) setSearching(false); }
    }, 300);
    return () => { clearTimeout(timer); counter.current++; };
  }, [propertyId, query, searchOpen]);
  function updateQuery(value: string) {
    searchSequence.current++;
    setQuery(value); setCustomers([]); setSearchError(""); setSearching(value.trim().length >= 2);
  }
  function change<K extends keyof BookingUpdate>(key: K, value: BookingUpdate[K]) { setForm(previous => ({ ...previous, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current) return;
    let input: BookingUpdate;
    try { input = parseBookingUpdate(form); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ข้อมูลไม่ถูกต้อง"); return; }
    saveLock.current = true; setSaving(true); onSaving(true); setError("");
    try {
      const result = await saveHouseBookingAction(propertyId, input);
      if (result.ok) onSaved(result.data); else setError(result.message);
    } catch { setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง หากการเชื่อมต่อขาด ให้ตรวจข้อมูลล่าสุดก่อนบันทึกซ้ำ"); }
    finally { saveLock.current = false; setSaving(false); onSaving(false); }
  }
  const datesChanged = form.check_in !== booking.check_in || form.check_out !== booking.check_out;
  const supportedStatus = BOOKING_STATUSES.some(status => status.value === form.status);
  return <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
    <fieldset disabled={saving} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />ช่วงเข้าพัก</h3>
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"><label className="min-w-0 space-y-1">เช็กอิน<Input type="date" required value={form.check_in} onChange={e => change("check_in", e.target.value)} /></label>
          <label className="min-w-0 space-y-1">เช็กเอาต์<Input type="date" required min={form.check_in} value={form.check_out} onChange={e => change("check_out", e.target.value)} /></label></div>
        {nights <= 0 && <p role="status" className="text-xs text-muted-foreground">วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน</p>}
        {datesChanged && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">เปลี่ยนวันแล้ว ยอดเงินยังเท่าเดิม โปรดตรวจสอบ</p>}
      </section>
      <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />ลูกค้า</h3>
        <div className="rounded-lg border p-3"><p className="font-medium">{bookingCustomerName(customer)}</p><p className="text-xs text-muted-foreground">{customer?.phone}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSearchOpen(value => !value)} aria-expanded={searchOpen}>เปลี่ยนลูกค้า</Button>
          {searchOpen && <div className="mt-3 space-y-2">
            <label className="block space-y-1">ค้นหาชื่อหรือเบอร์โทร<Input value={query} maxLength={100} onChange={e => updateQuery(e.target.value)} placeholder="อย่างน้อย 2 ตัวอักษร" /></label>
            {searching && <p role="status">กำลังค้นหา…</p>}
            {searchError && <p role="alert" className="text-destructive">{searchError}</p>}
            {!searching && query.trim().length >= 2 && !searchError && !customers.length && <p className="text-xs text-muted-foreground">ไม่พบลูกค้า</p>}
            <ul className="max-h-48 space-y-1 overflow-y-auto">{customers.map(item => <li key={item.id}><Button type="button" variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setCustomer(item); change("customer_id", item.id); setSearchOpen(false); }}>{bookingCustomerName(item)} · {item.phone}</Button></li>)}</ul>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomer(null); change("customer_id", null); setSearchOpen(false); }}>ยังไม่ได้ผูกลูกค้า</Button>
          </div>}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1">สถานะ<select className="h-8 w-full rounded-lg border bg-background px-2" value={form.status} onChange={e => change("status", e.target.value)}>
        {!supportedStatus && <option value={form.status} disabled>{form.status} (สถานะเดิม)</option>}{BOOKING_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select></label><label className="space-y-1">จำนวนคืน<Input readOnly aria-label="จำนวนคืน" value={nights > 0 ? nights : ""} /></label></div>
      {!supportedStatus && <p className="text-xs text-amber-800">กรุณาเลือกสถานะที่รองรับก่อนบันทึก</p>}
      <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />ยอดรวมการจอง (บาท)</h3><div className="grid grid-cols-2 gap-3">
        {([{ key: "price_max", label: "ค่าบ้านเต็มจำนวน" }, { key: "price_sell", label: "มัดจำที่ต้องชำระ" }, { key: "extra_charge", label: "ค่าใช้จ่ายเพิ่ม" }] as const).map(({ key, label }) => <label key={key} className={`space-y-1 ${key === "price_max" ? "col-span-2" : ""}`}>{label}<Input type="number" required={key !== "price_max"} min={0} max={999999999.99} step="0.01" value={form[key] === null || Number.isNaN(form[key]) ? "" : form[key]} onChange={e => change(key, key === "price_max" && e.target.value === "" ? null : e.target.valueAsNumber)} /></label>)}
        <label className="col-span-2 space-y-1">หมายเหตุ<Textarea rows={3} maxLength={10000} value={form.note ?? ""} onChange={e => change("note", e.target.value || null)} /></label>
      </div></section>
    </fieldset>
    <div className="space-y-3 border-t p-4">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-between gap-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>ยกเลิก</Button><Button type="submit" disabled={saving || !supportedStatus || nights <= 0 || !dirty}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></div></div>
  </form>;
}

function parseInitial(booking: Booking): BookingUpdate {
  const { id, updated_at, check_in, check_out, customer_id, status, quantity, price_sell, price_max, extra_charge, note } = booking;
  return { id, updated_at, check_in, check_out, customer_id, status, quantity, price_sell, price_max, extra_charge, note };
}
