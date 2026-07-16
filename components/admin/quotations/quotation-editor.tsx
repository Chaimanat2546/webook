"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Download, Eye, GripVertical, MoreHorizontal, Printer, Save, Share2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteQuotationAction, saveQuotationAction } from "../../../app/admin/quotations/actions";
import { calculateQuotation, formatThaiBahtText, type QuotationItemInput } from "../../../lib/quotation-calculator";
import { addQuotationCalendarDays } from "../../../lib/quotation-dates";
import type { CustomerSnapshot, QuotationPayload, SellerSnapshot } from "../../../lib/quotation-types";
import { cn } from "../../../lib/utils";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { QuotationDocument } from "./quotation-document";

export interface QuotationEditorProps { documentNumber: string | null; initialPayload: QuotationPayload; printOnLoad?: boolean; }
type FieldProps = { children: React.ReactNode; error?: string; field: string; label: string };
type ItemProps = { calculation?: ReturnType<typeof calculateQuotation>; errors: Record<string, string>; index: number; item: QuotationItemInput; onRemove: () => void; onUpdate: <K extends keyof QuotationItemInput>(key: K, value: QuotationItemInput[K]) => void; totalItems: number };
type FieldSize = "fluid" | "compact" | "date" | "identifier" | "money" | "name" | "address";

const fieldSizeClassNames = {
  fluid: "w-full",
  compact: "w-full sm:max-w-28",
  date: "w-full sm:max-w-40",
  identifier: "w-full sm:max-w-56",
  money: "w-full sm:max-w-32",
  name: "w-full sm:max-w-96",
  address: "w-full sm:max-w-[36rem]",
} satisfies Record<FieldSize, string>;

const selectClassName = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

function controlClassName(size: FieldSize, className?: string) {
  return cn(fieldSizeClassNames[size], className);
}

function Field({ children, error, field, label }: FieldProps) { void field; return <label className="grid gap-1 text-sm"><span>{label}</span>{children}{error ? <span className="text-xs text-destructive">{error}</span> : null}</label>; }
function TextInput({ disabled, error, field, inputClassName, inputMode, label, onChange, size = "fluid", value }: { disabled?: boolean; error?: string; field: string; inputClassName?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; label?: string; onChange: (value: string) => void; size?: FieldSize; value: string }) { const input = <><Input aria-invalid={Boolean(error)} aria-label={label ?? field} className={controlClassName(size, inputClassName)} data-field={field} disabled={disabled} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} value={value} />{error ? <span className="text-xs text-destructive">{error}</span> : null}</>; return label ? <Field error={undefined} field={field} label={label}>{input}</Field> : input; }
function Numeric({ disabled, error, field, inputClassName, label, onChange, size = "fluid", value }: { disabled?: boolean; error?: string; field: string; inputClassName?: string; label?: string; onChange: (value: string) => void; size?: FieldSize; value: string }) { return label ? <TextInput disabled={disabled} error={error} field={field} inputClassName={inputClassName} inputMode="decimal" label={label} onChange={onChange} size={size} value={value} /> : <><Input aria-invalid={Boolean(error)} aria-label={field} className={controlClassName(size, inputClassName)} data-field={field} disabled={disabled} inputMode="decimal" onChange={(event) => onChange(event.target.value)} value={value} />{error ? <span className="text-xs text-destructive">{error}</span> : null}</>; }
function Totals({ bold, label, value }: { bold?: boolean; label: string; value: string }) { return <div className={bold ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between"}><span>{label}</span><output>{value}</output></div>; }
function positions(items: QuotationItemInput[]) { return items.map((item, index) => ({ ...item, position: index + 1 })); }
function DocumentMore({ deleteEnabled, isPending, onDelete, onPreview, onPrint, onSaveAndClose, printEnabled, showPreviewAndPrint }: { deleteEnabled: boolean; isPending: boolean; onDelete: () => void; onPreview: () => void; onPrint: () => void; onSaveAndClose: () => void; printEnabled: boolean; showPreviewAndPrint: boolean }) { return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline"><MoreHorizontal aria-hidden="true" className="size-4" />เพิ่มเติม</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{showPreviewAndPrint ? <><DropdownMenuItem onSelect={onPreview}><Eye aria-hidden="true" className="size-4" />ดูตัวอย่าง</DropdownMenuItem>{printEnabled ? <DropdownMenuItem onSelect={onPrint}><Printer aria-hidden="true" className="size-4" />พิมพ์</DropdownMenuItem> : <DropdownMenuItem disabled><Printer aria-hidden="true" className="size-4" />พิมพ์</DropdownMenuItem>}</> : null}<DropdownMenuItem disabled={isPending} onSelect={onSaveAndClose}><Save aria-hidden="true" className="size-4" />บันทึกและปิด</DropdownMenuItem><DropdownMenuItem disabled title="ยังไม่รองรับใน MVP นี้"><Share2 aria-hidden="true" className="size-4" />แชร์</DropdownMenuItem><DropdownMenuItem disabled title="ยังไม่รองรับใน MVP นี้"><Download aria-hidden="true" className="size-4" />ดาวน์โหลด</DropdownMenuItem>{deleteEnabled ? <DropdownMenuItem onSelect={onDelete} variant="destructive"><Trash2 aria-hidden="true" className="size-4" />ลบ</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>; }

function SortableQuotationItem(props: ItemProps) {
  const { index, item, onRemove } = props;
  const { handleRef, isDragging, ref } = useSortable({ group: "quotation-items", id: item.id, index });

  return <article className={cn("rounded-md border p-3 xl:grid xl:grid-cols-[2.5rem_minmax(16rem,1fr)_5rem_5rem_7.5rem_9rem_9rem_8.5rem_2.5rem] xl:items-start xl:gap-2 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-0 xl:py-2", isDragging && "opacity-60")} data-sortable-item ref={ref}>
    <header className="mb-3 flex items-center justify-between xl:contents">
      <div className="flex items-center gap-1 xl:col-start-1 xl:row-start-1">
        <Button aria-label={`ลากเพื่อจัดลำดับรายการ ${index + 1}`} ref={handleRef} size="icon-xs" type="button" variant="ghost"><GripVertical aria-hidden="true" /></Button>
        <span className="font-mono text-xs text-muted-foreground xl:sr-only">{index + 1}</span>
      </div>
      <Button aria-label={`ลบรายการ ${index + 1}`} className="xl:col-start-9 xl:row-start-1" disabled={props.totalItems === 1} onClick={onRemove} size="icon-xs" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
    </header>
    <div className="xl:col-start-2 xl:row-start-1"><ItemDetailsControls {...props} /></div>
    <div data-item-detail-grid className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:contents">
      <div className="xl:col-start-3 xl:row-start-1"><ItemQuantityControl {...props} labelled /></div>
      <div className="xl:col-start-4 xl:row-start-1"><ItemUnitControl {...props} labelled /></div>
      <div className="xl:col-start-5 xl:row-start-1"><ItemPriceControls {...props} labelled /></div>
      <div className="xl:col-start-6 xl:row-start-1"><ItemDiscountControls {...props} labelled /></div>
      <div className="xl:col-start-7 xl:row-start-1"><ItemVatControls {...props} labelled /></div>
    </div>
    <p className="mt-3 border-t pt-2 text-right font-medium xl:col-start-8 xl:row-start-1 xl:mt-0 xl:border-0 xl:pt-2"><span className="xl:sr-only">รวม </span>{props.calculation?.lines[index]?.netAmount ? `${props.calculation.lines[index]!.netAmount} บาท` : "—"}</p>
  </article>;
}

function ItemDetailsControls({ errors, index, item, onUpdate }: ItemProps) {
  const error = (field: string) => errors[`items.${index}.${field}`];
  return <div data-item-details className="grid gap-1">
    <Input aria-invalid={Boolean(error("name"))} aria-label="ชื่อรายการ" data-field={`items.${index}.name`} onChange={(event) => onUpdate("name", event.target.value)} placeholder="รายการ" value={item.name} />
    {error("name") ? <span className="text-xs text-destructive">{error("name")}</span> : null}
    <Textarea aria-invalid={Boolean(error("description"))} aria-label="รายละเอียด" data-field={`items.${index}.description`} onChange={(event) => onUpdate("description", event.target.value)} placeholder="รายละเอียด" value={item.description} />
    {error("description") ? <span className="text-xs text-destructive">{error("description")}</span> : null}
  </div>;
}

function ItemQuantityControl({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) { return <Numeric error={errors[`items.${index}.quantity`]} field={`items.${index}.quantity`} label={labelled ? "จำนวน" : undefined} onChange={(value) => onUpdate("quantity", value)} size="compact" value={item.quantity} />; }
function ItemUnitControl({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) { return <TextInput error={errors[`items.${index}.unit`]} field={`items.${index}.unit`} label={labelled ? "หน่วย" : undefined} onChange={(value) => onUpdate("unit", value)} size="compact" value={item.unit} />; }
function ItemPriceControls({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) { return <Numeric error={errors[`items.${index}.unitPrice`]} field={`items.${index}.unitPrice`} label={labelled ? "ราคา" : undefined} onChange={(value) => onUpdate("unitPrice", value)} size="money" value={item.unitPrice} />; }
function ItemDiscountControls({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) { const error = (field: string) => errors[`items.${index}.${field}`]; const select = <select aria-invalid={Boolean(error("discountType"))} aria-label={`items.${index}.discountType`} className={selectClassName} data-field={`items.${index}.discountType`} onChange={(event) => onUpdate("discountType", event.target.value === "amount" || event.target.value === "percent" ? event.target.value : null)} value={item.discountType ?? ""}><option value="">ไม่มี</option><option value="amount">บาท</option><option value="percent">%</option></select>; const typeControl = labelled ? <Field error={error("discountType")} field={`items.${index}.discountType`} label="ส่วนลด">{select}</Field> : <>{select}{error("discountType") ? <span className="text-xs text-destructive">{error("discountType")}</span> : null}</>; return <div className={labelled ? "grid grid-cols-2 gap-2" : "grid gap-1"}>{typeControl}<Numeric error={error("discountValue")} field={`items.${index}.discountValue`} label={labelled ? "มูลค่า" : undefined} onChange={(value) => onUpdate("discountValue", value)} size="money" value={item.discountValue} /></div>; }
function ItemVatControls({ errors, index, item, onUpdate, labelled }: Pick<ItemProps, "errors" | "index" | "item" | "onUpdate"> & { labelled?: boolean }) { const error = (field: string) => errors[`items.${index}.${field}`]; const select = <select aria-invalid={Boolean(error("vatTreatment"))} aria-label={`items.${index}.vatTreatment`} className={selectClassName} data-field={`items.${index}.vatTreatment`} onChange={(event) => onUpdate("vatTreatment", event.target.value as QuotationItemInput["vatTreatment"])} value={item.vatTreatment}><option value="taxable">VAT</option><option value="exempt">ยกเว้น VAT</option><option value="none">ไม่คิด VAT</option></select>; const treatmentControl = labelled ? <Field error={error("vatTreatment")} field={`items.${index}.vatTreatment`} label="VAT">{select}</Field> : <>{select}{error("vatTreatment") ? <span className="text-xs text-destructive">{error("vatTreatment")}</span> : null}</>; return <div className={labelled ? "grid grid-cols-2 gap-2" : "grid gap-1"}>{treatmentControl}<Numeric error={error("vatRate")} field={`items.${index}.vatRate`} label={labelled ? "อัตรา" : undefined} onChange={(value) => onUpdate("vatRate", value)} size="money" value={item.vatRate} /></div>; }

export function QuotationEditor({ documentNumber: initialDocumentNumber, initialPayload, printOnLoad = false }: QuotationEditorProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<QuotationPayload>(initialPayload);
  const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [lastSavedPayload, setLastSavedPayload] = useState<QuotationPayload | null>(initialDocumentNumber ? initialPayload : null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const autoPrintStarted = useRef(false);
  const canPrint = Boolean(documentNumber && lastSavedPayload && !isPending);
  const calculationResult = useMemo(() => { try { return { calculation: calculateQuotation(payload), calculationError: "" }; } catch (error) { return { calculation: null, calculationError: error instanceof Error ? error.message : "คำนวณยอดไม่ได้" }; } }, [payload]);
  const { calculation, calculationError } = calculationResult;
  const savedCalculation = useMemo(() => lastSavedPayload ? calculateQuotation(lastSavedPayload) : null, [lastSavedPayload]);
  const money = (value?: string) => value ? `${value} บาท` : "—";
  function changed(field: string) { setIsDirty(true); setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; }); }
  function updateRoot<K extends keyof QuotationPayload>(key: K, value: QuotationPayload[K]) { changed(String(key)); setPayload((current) => ({ ...current, [key]: value })); }
  function setDocumentDiscountEnabled(enabled: boolean) { changed("documentDiscountType"); setPayload((current) => ({ ...current, documentDiscountType: enabled ? (current.documentDiscountType ?? "percent") : null, documentDiscountValue: enabled ? current.documentDiscountValue : "0" })); }
  function setWithholdingEnabled(enabled: boolean) { changed("withholdingTaxRate"); setPayload((current) => ({ ...current, withholdingTaxRate: enabled ? (current.withholdingTaxRate ?? "3.00") : null })); }
  function updateSeller<K extends keyof SellerSnapshot>(key: K, value: SellerSnapshot[K]) { changed(`seller.${String(key)}`); setPayload((current) => ({ ...current, seller: { ...current.seller, [key]: value } })); }
  function updateCustomer<K extends keyof CustomerSnapshot>(key: K, value: CustomerSnapshot[K]) { changed(`customer.${String(key)}`); setPayload((current) => ({ ...current, customer: { ...current.customer, [key]: value } })); }
  function updateSellerOfficeType(officeType: SellerSnapshot["officeType"]) { changed("seller.officeType"); setPayload((current) => ({ ...current, seller: { ...current.seller, branchNumber: officeType === "branch" ? current.seller.branchNumber : "", officeType } })); }
  function updateCustomerOfficeType(officeType: CustomerSnapshot["officeType"]) { changed("customer.officeType"); setPayload((current) => ({ ...current, customer: { ...current.customer, branchNumber: officeType === "branch" ? current.customer.branchNumber : "", officeType } })); }
  function updateItem<K extends keyof QuotationItemInput>(index: number, key: K, value: QuotationItemInput[K]) { changed(`items.${index}.${String(key)}`); setPayload((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) })); }
  function addItem() { changed("items"); setPayload((current) => ({ ...current, items: positions([...current.items, { description: "", discountType: null, discountValue: "0", id: crypto.randomUUID(), name: "", position: 0, quantity: "1", unit: "", unitPrice: "0.00", vatRate: "7.00", vatTreatment: "taxable" }]) })); }
  function removeItem(index: number) { if (payload.items.length > 1) { changed("items"); setPayload((current) => ({ ...current, items: positions(current.items.filter((_, itemIndex) => itemIndex !== index)) })); } }
  function recalculateValidUntil(issueDate: string, validityDays: string, validUntil: string) { try { return addQuotationCalendarDays(issueDate, Number(validityDays)); } catch { return validUntil; } }
  function updateIssueDate(value: string) { changed("issueDate"); setPayload((current) => ({ ...current, issueDate: value, validUntil: current.validityDays ? recalculateValidUntil(value, current.validityDays, current.validUntil) : current.validUntil })); }
  function updateValidityDays(value: string) { changed("validityDays"); setPayload((current) => ({ ...current, validityDays: value, validUntil: value ? recalculateValidUntil(current.issueDate, value, current.validUntil) : current.validUntil })); }
  function focusField(field: string) { const fields = document.querySelectorAll<HTMLElement>(`[data-field="${CSS.escape(field)}"]`); (Array.from(fields).find((element) => element.offsetParent !== null) ?? fields[0])?.focus(); }
  const focusableFieldErrors = Object.entries(fieldErrors).filter(([field]) => field === "items" || field === "seller.logoUrl" || document.querySelector(`[data-field="${CSS.escape(field)}"]`)).map(([field, message]) => ({ field, message }));
  function save(close = false) { setFormError(""); startTransition(async () => { const result = await saveQuotationAction(payload); if (!result.ok) { setFieldErrors(result.fieldErrors); setFormError(result.formError); const firstField = Object.keys(result.fieldErrors)[0]; if (firstField) requestAnimationFrame(() => focusField(firstField)); return; } setLastSavedPayload(payload); setPayload((current) => ({ ...current, id: result.id })); setDocumentNumber(result.documentNumber); setFieldErrors({}); setIsDirty(false); if (close) router.push("/admin/quotations"); else if (!payload.id) router.replace(`/admin/quotations/${encodeURIComponent(result.id)}?saved=1`); else router.refresh(); }); }
  const printSaved = useCallback(() => { if (!canPrint) return; const printStyle = document.createElement("style"); printStyle.textContent = "@page { size: A4; margin: 0; }"; document.head.append(printStyle); document.documentElement.classList.add("quotation-printing"); const cleanup = () => { document.documentElement.classList.remove("quotation-printing"); printStyle.remove(); }; window.addEventListener("afterprint", cleanup, { once: true }); window.print(); window.setTimeout(cleanup, 1_000); }, [canPrint]);
  useEffect(() => { if (!printOnLoad || !canPrint || autoPrintStarted.current) return; autoPrintStarted.current = true; printSaved(); }, [canPrint, printOnLoad, printSaved]);
  useEffect(() => { if (!isDirty) return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [isDirty]);
  function closeEditor() { if (!isDirty || window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการปิดหรือไม่")) router.push("/admin/quotations"); }
  function deleteQuotation() { if (!payload.id) return; setFormError(""); startTransition(async () => { const result = await deleteQuotationAction(payload.id!); if (!result.ok) return setFormError(result.formError); setDeleteOpen(false); setIsDirty(false); toast.success(`ลบ ${documentNumber ?? "ใบเสนอราคา"} แล้ว`); router.push("/admin/quotations"); }); }
  const itemProps = (item: QuotationItemInput, index: number): ItemProps => ({ calculation: calculation ?? undefined, errors: fieldErrors, index, item, onRemove: () => removeItem(index), onUpdate: (key, value) => updateItem(index, key, value), totalItems: payload.items.length });

  return <div className="space-y-4" data-dirty={isDirty} data-quotation-editor>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-foreground/25 pb-3" data-workbench-command-bar>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{documentNumber ? "แก้ไขใบเสนอราคา" : "สร้างใบเสนอราคา"}</h1>
        <p className="font-mono text-xs text-blue-700">{documentNumber ?? "เลขที่ออกเมื่อบันทึก"}</p>
      </div>
      <div className="flex items-center gap-2" data-header-actions>
        <Button onClick={closeEditor} type="button" variant="outline"><X aria-hidden="true" className="size-4" />ปิด</Button>
        <div className="hidden items-center gap-2 md:flex">
          <Button onClick={() => setPreviewOpen(true)} type="button" variant="outline"><Eye aria-hidden="true" className="size-4" />ดูตัวอย่าง</Button>
          <Button disabled={!canPrint} onClick={printSaved} type="button" variant="outline"><Printer aria-hidden="true" className="size-4" />พิมพ์</Button>
        </div>
        <div className="hidden md:block"><DocumentMore deleteEnabled={Boolean(payload.id)} isPending={isPending} onDelete={() => setDeleteOpen(true)} onPreview={() => setPreviewOpen(true)} onPrint={printSaved} onSaveAndClose={() => save(true)} printEnabled={canPrint} showPreviewAndPrint={false} /></div>
        <div className="md:hidden"><DocumentMore deleteEnabled={Boolean(payload.id)} isPending={isPending} onDelete={() => setDeleteOpen(true)} onPreview={() => setPreviewOpen(true)} onPrint={printSaved} onSaveAndClose={() => save(true)} printEnabled={canPrint} showPreviewAndPrint /></div>
        <Button disabled={isPending} onClick={() => save()} type="button"><Save aria-hidden="true" className="size-4" />{isPending ? "กำลังบันทึก" : "บันทึก"}</Button>
      </div>
    </header>
    {formError ? <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert> : null}{focusableFieldErrors.length ? <Alert variant="destructive"><AlertDescription>{focusableFieldErrors.map(({ field, message }) => <button className="mr-2 underline" key={field} onClick={() => focusField(field)} type="button">{message}</button>)}</AlertDescription></Alert> : null}{calculationError ? <Alert variant="destructive"><AlertDescription>{calculationError}</AlertDescription></Alert> : null}
    <section className="flex flex-wrap items-center justify-between gap-3 border-b py-2" data-seller-strip><div className="flex min-w-0 items-center gap-3">{payload.seller.logoUrl && !logoUnavailable ? <img alt="โลโก้ผู้ขาย" className="max-h-12 max-w-24 object-contain" onError={() => setLogoUnavailable(true)} src={payload.seller.logoUrl} /> : <div className="grid h-10 w-16 place-items-center rounded border text-xs text-muted-foreground">โลโก้</div>}<div className="min-w-0"><p className="truncate font-medium">{payload.seller.name || "ยังไม่มีชื่อผู้ขาย"}</p><p className="truncate text-sm text-muted-foreground">{payload.seller.officeType === "branch" ? `สาขา ${payload.seller.branchNumber || "-"}` : "สำนักงานใหญ่"}{payload.seller.taxId ? ` · ${payload.seller.taxId}` : ""}</p></div></div><Button onClick={() => setSellerExpanded((open) => !open)} size="sm" type="button" variant="ghost">แก้ไขเฉพาะใบ</Button></section>
    {sellerExpanded ? <section className="grid gap-3 rounded-lg border p-4 md:grid-cols-2" data-seller-edit><TextInput error={fieldErrors["seller.name"]} field="seller.name" label="ผู้ขาย" onChange={(value) => updateSeller("name", value)} value={payload.seller.name} /><Field error={fieldErrors["seller.address"]} field="seller.address" label="ที่อยู่"><Textarea aria-invalid={Boolean(fieldErrors["seller.address"])} data-field="seller.address" onChange={(event) => updateSeller("address", event.target.value)} value={payload.seller.address} /></Field><TextInput error={fieldErrors["seller.taxId"]} field="seller.taxId" inputClassName="max-w-72" label="เลขผู้เสียภาษี" onChange={(value) => updateSeller("taxId", value)} value={payload.seller.taxId} /><Field error={fieldErrors["seller.officeType"]} field="seller.officeType" label="สำนักงานผู้ขาย"><select aria-invalid={Boolean(fieldErrors["seller.officeType"])} className={selectClassName} data-field="seller.officeType" onChange={(event) => updateSellerOfficeType(event.target.value === "branch" ? "branch" : "head_office")} value={payload.seller.officeType}><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></Field>{payload.seller.officeType === "branch" ? <TextInput error={fieldErrors["seller.branchNumber"]} field="seller.branchNumber" inputClassName="max-w-48" label="เลขสาขาผู้ขาย" onChange={(value) => updateSeller("branchNumber", value)} value={payload.seller.branchNumber} /> : null}<TextInput error={fieldErrors["seller.phone"]} field="seller.phone" inputClassName="max-w-56" label="โทรศัพท์" onChange={(value) => updateSeller("phone", value)} value={payload.seller.phone} /><TextInput error={fieldErrors["seller.email"]} field="seller.email" inputClassName="max-w-80" label="อีเมล" onChange={(value) => updateSeller("email", value)} value={payload.seller.email} /><TextInput error={fieldErrors["seller.website"]} field="seller.website" inputClassName="max-w-80" label="เว็บไซต์" onChange={(value) => updateSeller("website", value)} value={payload.seller.website} /></section> : null}
    <div data-workbench-metadata className="grid gap-6 lg:grid-cols-12">
      <section data-customer-section className="border-t border-foreground/35 pt-2 lg:col-span-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">01 ลูกค้า</h2>
          <span className="text-xs text-muted-foreground">Snapshot เฉพาะใบ</span>
        </div>
        <div data-customer-fields className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><TextInput error={fieldErrors["customer.name"]} field="customer.name" label="ชื่อลูกค้า" onChange={(value) => updateCustomer("name", value)} size="name" value={payload.customer.name} /></div><div className="sm:col-span-2"><Field error={fieldErrors["customer.address"]} field="customer.address" label="ที่อยู่"><Textarea aria-invalid={Boolean(fieldErrors["customer.address"])} className={controlClassName("address")} data-field="customer.address" onChange={(event) => updateCustomer("address", event.target.value)} value={payload.customer.address} /></Field></div><TextInput error={fieldErrors["customer.taxId"]} field="customer.taxId" label="เลขผู้เสียภาษี" onChange={(value) => updateCustomer("taxId", value)} size="identifier" value={payload.customer.taxId} /><Field error={fieldErrors["customer.officeType"]} field="customer.officeType" label="สำนักงานลูกค้า"><select aria-invalid={Boolean(fieldErrors["customer.officeType"])} className={controlClassName("identifier", selectClassName)} data-field="customer.officeType" onChange={(event) => updateCustomerOfficeType(event.target.value === "branch" ? "branch" : "head_office")} value={payload.customer.officeType}><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></Field>{payload.customer.officeType === "branch" ? <TextInput error={fieldErrors["customer.branchNumber"]} field="customer.branchNumber" label="เลขสาขาลูกค้า" onChange={(value) => updateCustomer("branchNumber", value)} size="identifier" value={payload.customer.branchNumber} /> : null}</div>
      </section>
      <section data-document-section className="border-t border-foreground/35 pt-2 lg:col-span-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">02 ข้อมูลเอกสาร</h2>
          <span className="text-xs text-muted-foreground">บาท</span>
        </div>
        <div data-document-fields className="grid gap-3 sm:grid-cols-2"><Field error={fieldErrors.issueDate} field="issueDate" label="วันที่ออก"><Input aria-invalid={Boolean(fieldErrors.issueDate)} className={controlClassName("date")} data-field="issueDate" onChange={(event) => updateIssueDate(event.target.value)} type="date" value={payload.issueDate} /></Field><TextInput error={fieldErrors.validityDays} field="validityDays" inputMode="numeric" label="จำนวนวัน" onChange={updateValidityDays} size="compact" value={payload.validityDays} /><Field error={fieldErrors.validUntil} field="validUntil" label="ใช้ได้ถึง"><Input aria-invalid={Boolean(fieldErrors.validUntil)} className={controlClassName("date")} data-field="validUntil" onChange={(event) => { changed("validUntil"); setPayload((current) => ({ ...current, validUntil: event.target.value, validityDays: "" })); }} type="date" value={payload.validUntil} /></Field><TextInput error={fieldErrors.subject} field="subject" label="เรื่อง / ชื่องาน" onChange={(value) => updateRoot("subject", value)} size="name" value={payload.subject} /><div className="sm:col-span-2"><TextInput error={fieldErrors.reference} field="reference" label="เลขอ้างอิง" onChange={(value) => updateRoot("reference", value)} size="identifier" value={payload.reference} /></div></div>
      </section>
    </div>
    <section className="space-y-3 border-t border-foreground/35 pt-2">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="text-sm font-semibold">03 รายการ</h2>
      </div>
      <div className="hidden xl:grid xl:grid-cols-[2.5rem_minmax(16rem,1fr)_5rem_5rem_7.5rem_9rem_9rem_8.5rem_2.5rem] xl:gap-2 xl:border-b xl:pb-2 xl:text-xs xl:text-muted-foreground"><span>#</span><span>รายการ / รายละเอียด</span><span>จำนวน</span><span>หน่วย</span><span>ราคาต่อหน่วย</span><span>ส่วนลด</span><span>VAT</span><span className="text-right">รวม</span></div>
      <DragDropProvider onDragEnd={(event) => { if (event.canceled) return; changed("items"); setPayload((current) => ({ ...current, items: positions(move(current.items, event) as QuotationItemInput[]) })); }}>
        <div className="grid gap-3 xl:gap-0" data-sortable-items>{payload.items.map((item, index) => <SortableQuotationItem key={item.id} {...itemProps(item, index)} />)}</div>
      </DragDropProvider>
      <Button className="text-blue-700" onClick={addItem} size="sm" type="button" variant="outline">เพิ่มรายการ</Button>
    </section>
    <div data-workbench-completion className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section data-notes-grid className="grid gap-4 lg:grid-cols-2">
        <div data-public-notes><Field error={fieldErrors.publicNotes} field="publicNotes" label="หมายเหตุบนเอกสาร"><Textarea aria-invalid={Boolean(fieldErrors.publicNotes)} data-field="publicNotes" onChange={(event) => updateRoot("publicNotes", event.target.value)} value={payload.publicNotes} /></Field></div>
        <div data-field="items" data-internal-notes tabIndex={-1}>{fieldErrors.items ? <span className="text-xs text-destructive">{fieldErrors.items}</span> : null}<Field error={fieldErrors.internalNotes} field="internalNotes" label="หมายเหตุภายใน (ไม่แสดงในเอกสาร)"><Textarea aria-invalid={Boolean(fieldErrors.internalNotes)} data-field="internalNotes" onChange={(event) => updateRoot("internalNotes", event.target.value)} value={payload.internalNotes} /></Field></div>
      </section>
      <section data-quotation-totals className="space-y-2 border-t-2 border-foreground pt-3">
        <Totals label="รวมเป็นเงิน" value={money(calculation?.netSubtotal)} />
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm"><input checked={payload.documentDiscountType !== null} className="size-4 accent-primary" onChange={(event) => setDocumentDiscountEnabled(event.target.checked)} type="checkbox" />ส่วนลด</label>
            <select aria-invalid={Boolean(fieldErrors.documentDiscountType)} aria-label="ประเภทส่วนลด" className={controlClassName("compact", selectClassName)} data-field="documentDiscountType" disabled={payload.documentDiscountType === null} onChange={(event) => updateRoot("documentDiscountType", event.target.value as "amount" | "percent")} value={payload.documentDiscountType ?? "percent"}><option value="percent">%</option><option value="amount">บาท</option></select>
            <Numeric disabled={payload.documentDiscountType === null} error={fieldErrors.documentDiscountValue} field="documentDiscountValue" onChange={(value) => updateRoot("documentDiscountValue", value)} size="compact" value={payload.documentDiscountValue} />
          </div>
          <output>{money(calculation?.documentDiscountTotal)}</output>
        </div>
        {fieldErrors.documentDiscountType ? <span className="text-xs text-destructive">{fieldErrors.documentDiscountType}</span> : null}
        <Totals label="ราคาหลังหักส่วนลด" value={money(calculation?.taxableTotal)} />
        <Totals label="VAT" value={money(calculation?.vatTotal)} />
        <Totals bold label="จำนวนเงินรวมทั้งสิ้น" value={money(calculation?.grandTotal)} />
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-t pt-2">
          <label className="flex items-center gap-2 text-sm"><input checked={payload.withholdingTaxRate !== null} className="size-4 accent-primary" onChange={(event) => setWithholdingEnabled(event.target.checked)} type="checkbox" />หักภาษี ณ ที่จ่าย<Numeric disabled={payload.withholdingTaxRate === null} error={fieldErrors.withholdingTaxRate} field="withholdingTaxRate" onChange={(value) => updateRoot("withholdingTaxRate", value)} size="compact" value={payload.withholdingTaxRate ?? "0.00"} />%</label>
          <output>{money(calculation?.withholdingTaxTotal)}</output>
        </div>
        <Totals bold label="ยอดชำระ" value={money(calculation?.amountDue)} />
        <p className="text-sm">{calculation ? formatThaiBahtText(calculation.amountDue) : "—"}</p>
      </section>
    </div>
    <Dialog onOpenChange={setPreviewOpen} open={previewOpen}><DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-auto p-0 sm:max-w-[calc(100vw-4rem)]" showCloseButton>{calculation ? <QuotationDocument calculation={calculation} documentNumber={documentNumber} payload={payload} /> : <p className="p-4">กรุณาแก้ไขข้อมูลก่อนดูตัวอย่าง</p>}</DialogContent></Dialog>
    <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}><DialogContent><DialogHeader><DialogTitle>ลบใบเสนอราคา</DialogTitle><DialogDescription>ต้องการลบ {documentNumber ?? "ใบเสนอราคานี้"} ของ {payload.customer.name || "ลูกค้ารายนี้"} ใช่หรือไม่</DialogDescription></DialogHeader>{formError ? <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert> : null}<DialogFooter><Button onClick={() => setDeleteOpen(false)} type="button" variant="outline">ยกเลิก</Button><Button disabled={isPending} onClick={deleteQuotation} type="button" variant="destructive">ลบ</Button></DialogFooter></DialogContent></Dialog>
    {lastSavedPayload && savedCalculation ? <div className="hidden" data-quotation-print><QuotationDocument calculation={savedCalculation} documentNumber={documentNumber} payload={lastSavedPayload} /></div> : null}
  </div>;
}
