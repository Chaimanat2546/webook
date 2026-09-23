"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Building2, Contact, MapPin, NotebookPen, Pencil, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { createBookingCustomerAction, getBookingCustomerAction, lookupBookingCustomerDbdAction, updateBookingCustomerAction } from "@/app/admin/houses/[propertyId]/bookings/actions";
import { CUSTOMER_FIELDS, parseBookingCustomer, type BookingCustomerDetail, type BookingCustomerInput } from "@/lib/booking-customers";
import { bookingCustomerName, type BookingCustomer } from "@/lib/house-bookings";
import type { DbdCustomerDefaults } from "@/lib/quotation-customer-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { BookingCustomerSummary } from "./booking-customer-summary";
import { ThaiContactAddressFields } from "./thai-contact-address-fields";
import { formatThaiBirthDate, parseThaiBirthDate } from "@/lib/thai-birth-date";
import { bookingToday } from "@/lib/booking-availability";
import { validateCustomerSection, type CustomerErrors } from "@/lib/booking-customer-validation";

interface Props { propertyId: string; customerId?: string; onClose: () => void; onSelect: (customer: BookingCustomer) => void }
const titleOptions = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง", "Mr.", "Mrs.", "Ms."];
const groups = [
  { key: "general", label: "ข้อมูลทั่วไป", icon: UserRound },
  { key: "tax", label: "ข้อมูลภาษี", icon: Building2 },
  { key: "contact", label: "การติดต่อ", icon: Contact },
  { key: "address", label: "ที่อยู่", icon: MapPin },
  { key: "extra", label: "ข้อมูลเพิ่มเติม", icon: NotebookPen },
] as const;

export function BookingCustomerForm(props: Props) {
  const [customer, setCustomer] = useState<BookingCustomerDetail | null>(null);
  const [loading, setLoading] = useState(!!props.customerId);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!props.customerId) return;
    let active = true;
    void (async () => {
      try {
        const result = await getBookingCustomerAction(props.propertyId, props.customerId!);
        if (!active) return;
        if (result.ok) setCustomer(result.data); else setError(result.message);
      } catch { if (active) setError("โหลดข้อมูลลูกค้าไม่สำเร็จ"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [props.customerId, props.propertyId, retry]);
  if (!loading && !error) return <CustomerFields {...props} customer={customer} />;
  return <Dialog open onOpenChange={open => { if (!open) props.onClose(); }}><DialogContent showCloseButton={false}>
    <DialogHeader><DialogTitle>แก้ไขข้อมูลลูกค้า</DialogTitle><DialogDescription>ข้อมูลลูกค้าสำหรับการจอง</DialogDescription></DialogHeader>
    {loading ? <div role="status" aria-label="กำลังโหลดข้อมูลลูกค้า" className="space-y-3"><span className="sr-only">กำลังโหลดข้อมูลลูกค้า…</span>{[0,1,2,3].map(key => <Skeleton key={key} className="h-12 w-full motion-reduce:animate-none" />)}</div> : <div role="alert" className="space-y-3"><p>{error}</p><Button onClick={() => { setError(""); setLoading(true); setRetry(value => value + 1); }}>ลองใหม่</Button></div>}
    <DialogFooter><Button variant="outline" onClick={props.onClose}>ปิด</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function CustomerFields({ propertyId, customer, onClose, onSelect }: Props & { customer: BookingCustomerDetail | null }) {
  const [initial] = useState<BookingCustomerInput>(() => customer ? { ...customer } : {
    first_name: "", last_name: null, phone: "", customer_type: "individual", nationality: null, country: null, preferred_language: "th", tax_head_office: true, tax_branch_code: "00000", vip_status: false,
  });
  const [value, setValue] = useState(initial);
  const [birthDateText, setBirthDateText] = useState(() => formatThaiBirthDate(initial.date_of_birth));
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [review, setReview] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const juristic = value.customer_type === "juristic";
  function go(next: number) {
    const nextErrors = validateCustomerSection(value, groups[step].key, birthDateText);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStep(next); setReached(previous => Math.max(previous, next)); scrollRef.current?.scrollTo({ top: 0 });
  }
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState<"save" | "dbd" | null>(null);
  const [dbd, setDbd] = useState<DbdCustomerDefaults | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [existing, setExisting] = useState<BookingCustomer[]>([]);
  const lock = useRef(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const dirty = JSON.stringify(initial) !== JSON.stringify(value) || birthDateText !== formatThaiBirthDate(initial.date_of_birth);
  function update<K extends keyof BookingCustomerInput>(key: K, next: BookingCustomerInput[K]) {
    setValue(previous => ({ ...previous, [key]: next })); setExisting([]);
    setErrors(previous => ({ ...previous, [key]: undefined }));
    if (key === "tax_id" || key === "customer_type") setDbd(null);
  }
  function close() { if (lock.current) return; if (dirty) setDiscardOpen(true); else onClose(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation();
    if (lock.current) return;
    if (!review && step < groups.length - 1) { go(step + 1); return; }
    for (const [index, group] of groups.entries()) {
      const nextErrors = validateCustomerSection(value, group.key, birthDateText);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors); setReview(false); setStep(index);
        scrollRef.current?.scrollTo({ top: 0 }); return;
      }
    }
    setErrors({});
    const dateOfBirth = parseThaiBirthDate(birthDateText, bookingToday());
    if (!review) {
      setValue(current => ({ ...current, date_of_birth: dateOfBirth }));
      setReview(true); scrollRef.current?.scrollTo({ top: 0 }); return;
    }
    let input;
    try { input = parseBookingCustomer({ ...value, date_of_birth: dateOfBirth }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง"); setReview(false); return; }
    lock.current = true; setSaving(true); setOperation("save"); setExisting([]);
    try {
      const result = customer ? await updateBookingCustomerAction(propertyId, customer.id, customer.updated_at, input) : await createBookingCustomerAction(propertyId, input);
      if (!result.ok) { toast.error(result.message); return; }
      if (result.data.kind === "existing") { setExisting(result.data.customers); return; }
      toast.success(customer ? "บันทึกข้อมูลลูกค้าแล้ว" : "เพิ่มลูกค้าแล้ว"); onSelect(result.data.customer);
    } catch { toast.error("บันทึกข้อมูลลูกค้าไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { lock.current = false; setSaving(false); setOperation(null); }
  }
  async function lookup() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setOperation("dbd"); setDbd(null);
    try {
      const result = await lookupBookingCustomerDbdAction(propertyId, value.tax_id?.trim() ?? "");
      if (result.ok) {
        setDbd(result.data);
        if (!customer) setValue(current => ({ ...current, tax_company_name: result.data.name, tax_address: result.data.address }));
        toast.success(customer ? "รีเฟรชข้อมูล DBD แล้ว" : "ตรวจสอบข้อมูล DBD แล้ว");
      }
      else toast.error(result.message);
    } catch { toast.error("ค้นหา DBD ไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { lock.current = false; setSaving(false); setOperation(null); }
  }
  return <>
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (lock.current || discardOpen) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 border-b p-5"><DialogTitle className="flex items-center gap-2">{customer ? <Pencil aria-hidden className="size-5" /> : <UserPlus aria-hidden className="size-5" />}{customer ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}</DialogTitle><DialogDescription>{customer ? "การแก้ไขมีผลกับข้อมูลลูกค้าคนนี้ในรายการจองของบ้านนี้" : "กรอกข้อมูลตามหมวด แล้วตรวจสอบก่อนยืนยันบันทึก"}</DialogDescription></DialogHeader>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!review && <nav aria-label="ขั้นตอนข้อมูลลูกค้า" className="grid shrink-0 grid-cols-5 border-b border-border/60 px-4 py-2">
            {groups.map((group, index) => <button key={group.key} type="button" disabled={saving || index > reached} aria-current={step === index ? "step" : undefined} onClick={() => go(index)} className="relative flex min-h-11 min-w-0 flex-col items-center gap-1 px-1 text-[11px] sm:text-xs disabled:cursor-not-allowed">
              {index < groups.length - 1 && <span aria-hidden className={`absolute left-1/2 top-3 h-px w-full ${index < step ? "bg-muted-foreground/35" : "bg-border/60"}`} />}
              <span className={`relative flex size-6 items-center justify-center rounded-full border bg-background ${index === step ? "border-muted-foreground/50 text-foreground" : "border-border/60 text-muted-foreground"}`}><group.icon aria-hidden className="size-3" /></span>
              <span className={index === step ? "font-medium text-foreground" : "text-muted-foreground"}>{group.label}</span>
            </button>)}
          </nav>}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">{review ? <BookingCustomerSummary value={value} /> : <fieldset disabled={saving} className="min-w-0 space-y-3">
            {groups.filter((_, index) => index === step).map(group => <section key={group.key}>
              <h3 className="text-lg font-semibold"><span className="inline-flex items-center gap-2"><group.icon aria-hidden className="size-4" />{group.label}</span></h3>
              <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 [&_[data-slot=input]]:bg-background [&_label]:text-sm [&_label]:font-medium [&_textarea]:bg-background">
                {group.key === "general" && <>
                  <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:col-span-2">ประเภทลูกค้า<select className="block h-8 w-fit max-w-full rounded-md border bg-background py-1 pl-2 pr-7 text-sm" value={value.customer_type ?? ""} onChange={event => update("customer_type", event.target.value || null)}><option value="">ไม่ระบุ</option><option value="individual">บุคคลธรรมดา</option><option value="juristic">นิติบุคคล</option></select></label>
                  <div className={`grid min-w-0 gap-3 sm:col-span-2 ${juristic ? "sm:grid-cols-2" : "sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]"}`}>
                    {!juristic && <label className="min-w-0 space-y-1">คำนำหน้า<select className="block h-8 w-full rounded-md border bg-background py-1 pl-2 pr-7 text-sm" value={value.title ?? ""} onChange={event => update("title", event.target.value || null)}><option value="">ไม่ระบุ</option>{value.title && !titleOptions.includes(value.title) && <option value={value.title}>{value.title}</option>}{titleOptions.map(title => <option key={title} value={title}>{title}</option>)}</select></label>}
                    <label className="min-w-0 space-y-1">{juristic ? "ชื่อผู้ติดต่อ" : "ชื่อ"}<Input maxLength={100} autoComplete="given-name" value={value.first_name} onChange={event => update("first_name", event.target.value)} aria-invalid={!!errors.first_name} aria-describedby={errors.first_name ? "first_name-error" : undefined} /><span id="first_name-error" role={errors.first_name ? "alert" : undefined} className="block text-xs text-destructive">{errors.first_name}</span></label>
                    <label className="min-w-0 space-y-1">นามสกุล<Input maxLength={100} autoComplete="family-name" value={value.last_name ?? ""} onChange={event => update("last_name", event.target.value || null)} aria-invalid={!!errors.last_name} aria-describedby={errors.last_name ? "last_name-error" : undefined} /><span id="last_name-error" role={errors.last_name ? "alert" : undefined} className="block text-xs text-destructive">{errors.last_name}</span></label>
                  </div>
                </>}
                {group.key === "address" && juristic && <div className="sm:col-span-2"><Button type="button" variant="outline" disabled={!value.tax_address?.trim()} onClick={() => setValue(current => ({ ...current, address: current.tax_address, sub_district: null, district: null, province: null, postal_code: null, country: "Thailand" }))}>ใช้ที่อยู่เดียวกับข้อมูลภาษี</Button></div>}
                {group.key === "address" && <ThaiContactAddressFields errors={errors} disabled={saving} propertyId={propertyId} value={{ address: value.address ?? null, country: value.country ?? null, postal_code: value.postal_code ?? null, province: value.province ?? null, district: value.district ?? null, sub_district: value.sub_district ?? null }} onChange={patch => { setValue(current => ({ ...current, ...patch })); setErrors(current => { const next = { ...current }; for (const key of Object.keys(patch) as (keyof typeof patch)[]) delete next[key]; return next; }); setExisting([]); }} />}
                {group.key === "contact" && <label className="space-y-1">เบอร์โทร<Input type="tel" inputMode="numeric" maxLength={40} autoComplete="tel" value={value.phone} onChange={event => update("phone", event.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} /><span id="phone-error" role={errors.phone ? "alert" : undefined} className="block text-xs text-destructive">{errors.phone}</span></label>}
                {group.key === "tax" && <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:col-span-2">สำนักงาน<select className="block h-8 w-fit max-w-full rounded-md border bg-background py-1 pl-2 pr-7 text-sm" value={value.tax_head_office == null ? "" : value.tax_head_office ? "head" : "branch"} onChange={event => update("tax_head_office", event.target.value === "" ? null : event.target.value === "head")}><option value="">ไม่ระบุ</option><option value="head">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></label>}
                {CUSTOMER_FIELDS.filter(field => field.group === group.key && field.key !== "title" && field.key !== "address" && field.key !== "country" && field.key !== "postal_code" && field.key !== "province" && field.key !== "district" && field.key !== "sub_district" && !(juristic && field.group === "general")).map(field => <label key={field.key} className={`space-y-1 ${(field.key === "tax_id" || ("type" in field && field.type === "textarea")) ? "sm:col-span-2" : ""}`}>{field.label}{field.key === "tax_id" ? <div className="flex flex-col gap-2 sm:flex-row"><Input inputMode="numeric" maxLength={13} value={value.tax_id ?? ""} onChange={event => update("tax_id", event.target.value || null)} />{value.customer_type === "juristic" && <Button type="button" variant="outline" onClick={() => void lookup()}>{operation === "dbd" ? "กำลังตรวจสอบ DBD…" : customer ? "รีเฟรชจาก DBD" : "ตรวจสอบ DBD"}</Button>}</div> : field.key === "preferred_language" ? <select className="block h-8 w-fit max-w-full rounded-md border bg-background py-1 pl-2 pr-7 text-sm" value={value.preferred_language ?? ""} onChange={event => update("preferred_language", event.target.value || null)}><option value="" disabled>เลือกภาษา</option>{value.preferred_language && !["th", "en"].includes(value.preferred_language) && <option value={value.preferred_language} disabled>{value.preferred_language} (ค่าเดิม)</option>}<option value="th">ภาษาไทย</option><option value="en">อังกฤษ</option></select> : "type" in field && field.type === "textarea" ? <Textarea rows={3} maxLength={field.max} value={value[field.key] ?? ""} onChange={event => update(field.key, event.target.value || null)} /> : field.key === "date_of_birth" ? <><Input type="text" inputMode="text" maxLength={10} placeholder="วว/ดด/ปปปป (พ.ศ.)" aria-label="วันเกิด (พ.ศ.)" aria-invalid={!!errors.date_of_birth} aria-describedby={errors.date_of_birth ? "birth-date-error" : "birth-date-hint"} value={birthDateText} onChange={event => { setBirthDateText(event.target.value); setErrors(previous => ({ ...previous, date_of_birth: undefined })); setExisting([]); }} /><span id="birth-date-hint" className="block text-xs text-muted-foreground">วัน/เดือน/ปี พ.ศ. เช่น 23/09/2535</span>{errors.date_of_birth && <span id="birth-date-error" role="alert" className="block text-xs text-destructive">{errors.date_of_birth}</span>}</> : field.key === "secondary_phone" ? <Input type="tel" inputMode="numeric" maxLength={field.max} value={value[field.key] ?? ""} onChange={event => update(field.key, event.target.value || null)} /> : <Input aria-invalid={!!errors[field.key]} type={"type" in field ? field.type : "text"} maxLength={field.max} value={value[field.key] ?? ""} onChange={event => update(field.key, event.target.value || null)} />}{field.key !== "date_of_birth" && errors[field.key] && <span role="alert" className="block text-xs text-destructive">{errors[field.key]}</span>}</label>)}
                {group.key === "tax" && value.customer_type === "juristic" && <div className="space-y-3 sm:col-span-2">
                  {operation === "dbd" && <div role="status" aria-label="กำลังตรวจสอบ DBD" className="space-y-2"><Skeleton className="h-4 w-2/3 motion-reduce:animate-none" /><Skeleton className="h-12 w-full motion-reduce:animate-none" /><span className="sr-only">กำลังตรวจสอบ DBD…</span></div>}
                  {dbd && <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                    <p className="font-medium">ข้อมูลจาก DBD</p><p>{dbd.name}</p><p>{dbd.address}</p>
                    <p>สถานะ: {dbd.status} · ตรวจสอบล่าสุด {new Date(dbd.verifiedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</p>
                    {dbd.status !== "ยังดำเนินกิจการอยู่" && <p className="text-amber-700">โปรดตรวจสอบสถานะนิติบุคคลก่อนนำข้อมูลไปใช้</p>}
                    <Button type="button" size="sm" variant="outline" disabled={value.tax_id?.trim() !== dbd.taxId} onClick={() => setValue(current => ({ ...current, tax_company_name: dbd.name, tax_address: dbd.address }))}>รีเซ็ตเป็นข้อมูล DBD</Button>
                  </div>}
                </div>}
                {group.key === "extra" && <label className="space-y-1">สถานะ VIP<select className="block h-8 w-fit max-w-full rounded-md border bg-background py-1 pl-2 pr-7 text-sm" value={value.vip_status == null ? "" : value.vip_status ? "yes" : "no"} onChange={event => update("vip_status", event.target.value === "" ? null : event.target.value === "yes")}><option value="">ไม่ระบุ</option><option value="no">ทั่วไป</option><option value="yes">VIP</option></select></label>}
              </div>
            </section>)}
          </fieldset>}</div>
          {existing.length > 0 && <div className="max-h-40 space-y-2 overflow-y-auto border-t p-3"><p role="status" className="text-sm">มีลูกค้าบ้านนี้ใช้เบอร์นี้แล้ว เลือกข้อมูลเดิมได้เลย</p>{existing.map(item => <Button key={item.id} className="h-auto w-full justify-start whitespace-normal text-left" type="button" variant="outline" onClick={() => onSelect(item)}>{bookingCustomerName(item)} · {item.phone}</Button>)}</div>}
          <DialogFooter className="m-0 shrink-0 flex-row flex-wrap items-center justify-between border-t p-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={close}>ยกเลิก</Button>
            <div className="flex flex-wrap gap-2">
              {review ? <Button type="button" variant="outline" disabled={saving} onClick={() => { setReview(false); scrollRef.current?.scrollTo({ top: 0 }); }}>กลับไปแก้ไข</Button> : step > 0 && <Button type="button" variant="outline" disabled={saving} onClick={() => go(step - 1)}><ArrowLeft aria-hidden className="size-4" />ย้อนกลับ</Button>}
              {!review && step < groups.length - 1 ? <Button key="next" type="button" disabled={saving} onClick={() => go(step + 1)}>ถัดไป<ArrowRight aria-hidden className="size-4" /></Button> : <Button key={review ? "confirm" : "review"} type="submit" disabled={saving || (!!customer && !dirty)}>{operation === "save" ? "กำลังบันทึก…" : review ? <><Check aria-hidden className="size-4" />ยืนยันบันทึก</> : customer ? "บันทึกข้อมูลลูกค้า" : "บันทึกและเลือก"}</Button>}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => { event.preventDefault(); keepEditingRef.current?.focus(); }}>
        <DialogHeader><DialogTitle>ทิ้งข้อมูลลูกค้า?</DialogTitle><DialogDescription>การแก้ไขข้อมูลลูกค้ายังไม่ได้บันทึก</DialogDescription></DialogHeader>
        <DialogFooter><Button ref={keepEditingRef} type="button" variant="outline" onClick={() => setDiscardOpen(false)}>กลับไปแก้ไข</Button><Button type="button" variant="destructive" onClick={onClose}>ทิ้งข้อมูล</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
