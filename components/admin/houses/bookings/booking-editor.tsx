"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BookingDateRange } from "./booking-date-range";
import { BookingCustomerPicker } from "./booking-customer-picker";
import { BookingEditorSkeleton } from "./booking-skeletons";
import { CalendarDays, Trash2, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOKING_STATUSES, nightsBetween, parseBookingCreate, parseBookingUpdate, type Booking, type BookingUpdate } from "@/lib/house-bookings";
import { cancelHouseBookingAction, createHouseBookingAction, getHouseBookingAction, saveHouseBookingAction } from "@/app/admin/houses/[propertyId]/bookings/actions";

interface EditorProps { propertyId: string; bookingId?: string; initialDate?: string; onClose: () => void; onSaved: (booking: Booking) => void }
interface FormProps { propertyId: string; booking: Booking | null; initialDate: string; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void; onClose: () => void; onSaved: (booking: Booking) => void }

export function BookingEditor({ propertyId, bookingId, initialDate = "", onClose, onSaved }: EditorProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelHasUnsaved, setCancelHasUnsaved] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const cancelBackRef = useRef<HTMLButtonElement>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const dirty = useRef(false), saving = useRef(false), sequence = useRef(0);
  const load = useCallback(async () => {
    if (!bookingId) { setLoading(false); return; }
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
    if (saving.current || discardOpen || cancelOpen) return;
    if (dirty.current) setDiscardOpen(true); else onClose();
  }
  async function cancelBooking() {
    if (!booking || saving.current) return;
    saving.current = true; setEditorBusy(true);
    try {
      const result = await cancelHouseBookingAction(propertyId, booking.id, booking.updated_at);
      if (result.ok) { dirty.current = false; onSaved(result.data); onClose(); }
      else toast.error(result.message);
    } catch { toast.error("ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { saving.current = false; setEditorBusy(false); }
  }
  return <Sheet open onOpenChange={open => { if (!open) close(); }}>
    <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg" showCloseButton={false}>
      <SheetHeader className="border-b p-5">
        <div className="flex items-start justify-between gap-3"><div>
          <SheetTitle className="flex items-center gap-2"><CalendarDays aria-hidden className="size-5 shrink-0" />{bookingId ? "แก้ไขการจอง" : "สร้างการจอง"}</SheetTitle>
          <SheetDescription className="break-words">{booking ? `${booking.booking_code} · ` : ""}DV-{propertyId}</SheetDescription>
        </div><div className="flex shrink-0 items-center gap-1">{booking && booking.status !== "cancelled" && <Button variant="ghost" size="icon" className="text-destructive" disabled={editorBusy} aria-label="ยกเลิกการจอง" title="ยกเลิกการจอง" onClick={() => { if (!saving.current) { setCancelHasUnsaved(dirty.current); setCancelOpen(true); } }}><Trash2 aria-hidden className="size-4" /></Button>}<Button variant="ghost" size="sm" onClick={close} aria-label="ปิดแผงแก้ไข">ปิด</Button></div></div>
      </SheetHeader>
      {loading ? <BookingEditorSkeleton /> : error ? <div className="space-y-3 p-5"><p role="alert" className="text-destructive">{error}</p><Button onClick={() => void load()}>ลองอีกครั้ง</Button></div> :
        <BookingForm propertyId={propertyId} booking={booking} initialDate={initialDate} onDirty={value => { dirty.current = value; }} onSaving={value => { saving.current = value; setEditorBusy(value); }} onClose={close}
          onSaved={value => { dirty.current = false; onSaved(value); onClose(); }} />}
      <Dialog open={cancelOpen} onOpenChange={open => { if (!saving.current) setCancelOpen(open); }}>
        <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()}
          onEscapeKeyDown={event => { if (saving.current) event.preventDefault(); }}
          onOpenAutoFocus={event => { event.preventDefault(); cancelBackRef.current?.focus(); }}>
          <DialogHeader><DialogTitle>ยกเลิกการจองนี้?</DialogTitle>
            <DialogDescription>รายการจะหายจากปฏิทิน และช่วงวันนี้จะเปิดให้จองใหม่{cancelHasUnsaved ? " การแก้ไขที่ยังไม่บันทึกจะถูกทิ้ง" : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button ref={cancelBackRef} type="button" variant="outline" disabled={editorBusy} onClick={() => setCancelOpen(false)}>กลับไปแก้ไข</Button>
            <Button type="button" variant="destructive" disabled={editorBusy} onClick={() => void cancelBooking()}>{editorBusy ? "กำลังยกเลิก…" : "ยกเลิกการจอง"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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

function BookingForm({ propertyId, booking, initialDate, onDirty, onSaving, onClose, onSaved }: FormProps) {
  const [datesValid, setDatesValid] = useState(false);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [requestId] = useState(() => crypto.randomUUID());
  const [initial] = useState(() => booking ? parseInitial(booking) : newDraft(initialDate));
  const [form, setForm] = useState(initial);
  const [customer, setCustomer] = useState(booking?.customer ?? null);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  let nights = 0;
  try { nights = nightsBetween(form.check_in, form.check_out); } catch { /* Incomplete date field. */ }
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || (!!booking && nights > 0 && nights !== booking.quantity);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  function change<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) { setForm(previous => ({ ...previous, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current || customerBusy || (!datesValid && form.status !== "cancelled")) return;
    let input;
    try { input = booking ? parseBookingUpdate({ ...form, id: booking.id, updated_at: booking.updated_at }) : parseBookingCreate({ ...form, request_id: requestId }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ข้อมูลไม่ถูกต้อง"); return; }
    saveLock.current = true; setSaving(true); onSaving(true); setError("");
    try {
      const result = await (booking ? saveHouseBookingAction(propertyId, input) : createHouseBookingAction(propertyId, input));
      if (result.ok) onSaved(result.data); else { setDatesValid(false); toast.error(result.message); setAvailabilityRevision(value => value + 1); }
    } catch { setDatesValid(false); toast.error("บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกซ้ำ"); setAvailabilityRevision(value => value + 1); }
    finally { saveLock.current = false; setSaving(false); onSaving(false); }
  }
  const datesChanged = !!booking && (form.check_in !== booking.check_in || form.check_out !== booking.check_out);
  const supportedStatus = BOOKING_STATUSES.some(status => status.value === form.status);
  return <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
    <fieldset disabled={saving} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />ช่วงเข้าพัก</h3>
        <BookingDateRange propertyId={propertyId} excludeId={booking?.id} originalStart={booking?.check_in} originalEnd={booking?.check_out} originalStatus={booking?.status} start={form.check_in} end={form.check_out} revision={availabilityRevision}
          onValid={setDatesValid} onChange={(check_in, check_out) => { setDatesValid(false); setForm(previous => ({ ...previous, check_in, check_out })); }} />
        {datesChanged && form.status !== "repair" && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">เปลี่ยนวันแล้ว ยอดเงินยังเท่าเดิม โปรดตรวจสอบ</p>}
      </section>
      {form.status !== "repair" && <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />ลูกค้า</h3>
        <BookingCustomerPicker propertyId={propertyId} customer={customer} onBusy={busy => { setCustomerBusy(busy); onSaving(busy); }} onSelect={next => { setCustomer(next); change("customer_id", next.id); }} />
      </section>}
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1">สถานะ<select className="h-8 w-full rounded-lg border bg-background px-2" value={form.status} onChange={e => change("status", e.target.value)}>
      {!supportedStatus && <option value={form.status} disabled>{form.status} (สถานะเดิม)</option>}{BOOKING_STATUSES.filter(status => status.value !== "cancelled").map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select></label><label className="space-y-1">จำนวนคืน<Input readOnly aria-label="จำนวนคืน" value={nights > 0 ? nights : ""} /></label></div>
      {booking && booking.status !== "repair" && form.status === "repair" && <p className="text-xs text-amber-800">เมื่อบันทึกเป็นปิดซ่อม จะล้างลูกค้าและยอดเงินของรายการนี้</p>}
      {!supportedStatus && <p className="text-xs text-amber-800">กรุณาเลือกสถานะที่รองรับก่อนบันทึก</p>}
      <section className="space-y-3 border-t pt-4">{form.status !== "repair" && <h3 className="flex items-center gap-2 font-semibold"><Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />ยอดรวมการจอง (บาท)</h3>}<div className="grid grid-cols-2 gap-3">
        {form.status !== "repair" && ([{ key: "price_max", label: "ค่าบ้านเต็มจำนวน" }, { key: "price_sell", label: "มัดจำที่ต้องชำระ" }, { key: "extra_charge", label: "ค่าใช้จ่ายเพิ่ม" }] as const).map(({ key, label }) => <label key={key} className={`space-y-1 ${key === "price_max" ? "col-span-2" : ""}`}>{label}<Input type="number" required={!booking || key !== "price_max"} min={0} max={999999999.99} step="0.01" value={form[key] === null || Number.isNaN(form[key]) ? "" : form[key]} onChange={e => change(key, key === "price_max" && e.target.value === "" ? null : e.target.valueAsNumber)} /></label>)}
        <label className="col-span-2 space-y-1">หมายเหตุ<Textarea rows={3} maxLength={10000} value={form.note ?? ""} onChange={e => change("note", e.target.value || null)} /></label>
      </div></section>
    </fieldset>
    <div className="space-y-3 border-t p-4">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-between gap-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>ยกเลิก</Button><Button type="submit" disabled={saving || (!datesValid && form.status !== "cancelled") || !supportedStatus || nights <= 0 || !dirty || (form.status !== "repair" && form.status !== "cancelled" && (!booking || booking.status === "repair") && !form.customer_id)}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></div></div>
  </form>;
}

type BookingDraft = Omit<BookingUpdate, "id" | "updated_at">;

function newDraft(date: string): BookingDraft {
  return { check_in: date, check_out: "", customer_id: null, status: "waiting", quantity: 0, price_sell: 0, price_max: null, extra_charge: 0, note: null };
}

function parseInitial(booking: Booking): BookingDraft {
  const { check_in, check_out, customer_id, status, quantity, price_sell, price_max, extra_charge, note } = booking;
  return { check_in, check_out, customer_id, status, quantity, price_sell, price_max, extra_charge, note };
}
