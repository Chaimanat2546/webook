"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { uploadQuotationPaymentAssetAction } from "../../../app/admin/quotations/actions";
import { emptyPaymentMethod, normalizePaymentPositions, type BankOption, type QuotationPaymentMethod } from "../../../lib/quotation-payment-methods";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { PaymentImageInput } from "./payment-image-input";

export interface PaymentMethodListProps<T extends QuotationPaymentMethod> {
  banks: BankOption[];
  errors: Record<string, string>;
  methods: T[];
  mode: "master" | "quotation";
  onChange: (methods: T[]) => void;
}

const paymentTypes = [["bank_transfer", "โอนเงินผ่านธนาคาร"], ["promptpay", "PromptPay"], ["qr_payment", "QR Payment"], ["cash", "เงินสด"], ["other", "อื่น ๆ"]] as const;

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return <label className="grid min-w-0 gap-1.5 text-sm"><span>{label}</span>{children}{error ? <span className="text-xs text-destructive">{error}</span> : null}</label>;
}

function SortablePaymentMethod<T extends QuotationPaymentMethod>({ banks, errors, index, method, mode, onPatch, onRemove }: { banks: BankOption[]; errors: Record<string, string>; index: number; method: T; mode: "master" | "quotation"; onPatch: (patch: Partial<T>) => void; onRemove: () => void }) {
  const { handleRef, isDragging, ref } = useSortable({ group: "payment-methods", id: method.id, index });
  const [uploadError, setUploadError] = useState("");
  const [uploading, startUpload] = useTransition();
  const error = (name: string) => errors[`paymentMethods.${index}.${name}`];
  const other = method.bankCode === "OTHER" || (!method.bankId && method.type === "bank_transfer");
  const update = <K extends keyof T>(name: K, value: T[K]) => onPatch({ [name]: value } as unknown as Partial<T>);
  const upload = (name: "customBankLogoUrl" | "qrImageUrl", file: File) => startUpload(async () => {
    setUploadError("");
    const data = new FormData();
    data.set("file", file);
    const result = await uploadQuotationPaymentAssetAction(data);
    if (result.ok) update(name, result.url as T[typeof name]);
    else setUploadError(result.formError || Object.values(result.fieldErrors)[0] || "Unable to upload payment image");
  });
  const qrUpload = method.qrMode === "upload" || method.type === "qr_payment";

  function selectBank(value: string) {
    const bank = banks.find((option) => option.id === value);
    if (!bank || bank.code === "OTHER") return onPatch({ bankCode: "OTHER", bankId: null, bankLogoUrl: "", bankName: "", customBankLogoUrl: "", customBankName: "" } as Partial<T>);
    onPatch({ bankCode: bank.code, bankId: bank.id, bankLogoUrl: bank.logoUrl, bankName: bank.name, customBankLogoUrl: "", customBankName: "" } as Partial<T>);
  }

  return <article className={cn("min-w-0 border-b py-4 last:border-b-0", isDragging && "opacity-60")} data-payment-method ref={ref}>
    <header className="mb-3 flex items-center gap-2"><Button aria-label={`ลากเพื่อจัดลำดับช่องทางชำระเงิน ${index + 1}`} ref={handleRef} size="icon-xs" type="button" variant="ghost"><GripVertical aria-hidden="true" /></Button><Field label="ประเภท"><select className="h-8 w-full rounded-md border bg-transparent px-2 text-sm" onChange={(event) => update("type", event.target.value as T["type"])} value={method.type}>{paymentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{mode === "master" ? <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><Switch checked={"isDefault" in method && method.isDefault === true} onCheckedChange={(checked) => onPatch({ isDefault: checked } as unknown as Partial<T>)} size="sm" />เลือกอัตโนมัติในใบใหม่</label> : null}<Button aria-label={`ลบช่องทางชำระเงิน ${index + 1}`} className="ml-auto" onClick={onRemove} size="icon-xs" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></header>
    {method.type === "bank_transfer" ? <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field error={error("bankId")} label="ธนาคาร"><select className="h-8 w-full rounded-md border bg-transparent px-2 text-sm" onChange={(event) => selectBank(event.target.value)} value={other ? "OTHER" : method.bankId ?? "OTHER"}>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></Field><Field error={error("accountName")} label="ชื่อบัญชี"><Input className="h-8" onChange={(event) => update("accountName", event.target.value as T["accountName"])} value={method.accountName} /></Field><Field error={error("accountNumber")} label="เลขที่บัญชี"><Input className="h-8" inputMode="numeric" onChange={(event) => update("accountNumber", event.target.value as T["accountNumber"])} value={method.accountNumber} /></Field><Field label="QR โอนเงิน"><select className="h-8 w-full rounded-md border bg-transparent px-2 text-sm" onChange={(event) => update("qrMode", event.target.value as T["qrMode"])} value={method.qrMode}><option value="none">ไม่ใช้</option><option value="upload">อัปโหลด QR</option></select></Field>{other ? <><Field error={error("customBankName")} label="ชื่อธนาคารอื่น"><Input className="h-8" onChange={(event) => update("customBankName", event.target.value as T["customBankName"])} value={method.customBankName} /></Field><PaymentImageInput disabled={uploading} onChange={(file) => upload("customBankLogoUrl", file)} /></> : null}</div> : null}
    {method.type === "promptpay" ? <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field error={error("accountName")} label="ชื่อบัญชี"><Input className="h-8" onChange={(event) => update("accountName", event.target.value as T["accountName"])} value={method.accountName} /></Field><Field error={error("promptPayId")} label="หมายเลข PromptPay"><Input className="h-8" inputMode="numeric" onChange={(event) => update("promptPayId", event.target.value as T["promptPayId"])} value={method.promptPayId} /></Field><Field error={error("qrMode")} label="QR PromptPay"><select className="h-8 w-full rounded-md border bg-transparent px-2 text-sm" onChange={(event) => update("qrMode", event.target.value as T["qrMode"])} value={method.qrMode}><option value="auto_promptpay">สร้างอัตโนมัติ</option><option value="upload">อัปโหลด QR</option></select></Field></div> : null}
    {method.type === "qr_payment" ? <Field error={error("providerName")} label="ผู้ให้บริการ"><Input className="h-8" onChange={(event) => update("providerName", event.target.value as T["providerName"])} value={method.providerName} /></Field> : null}
    {method.type === "other" ? <Field error={error("providerName")} label="ชื่อช่องทาง"><Input className="h-8" onChange={(event) => update("providerName", event.target.value as T["providerName"])} value={method.providerName} /></Field> : null}
    {qrUpload ? <div className="mt-3"><PaymentImageInput disabled={uploading} onChange={(file) => upload("qrImageUrl", file)} />{error("qrImageUrl") ? <p className="text-xs text-destructive">{error("qrImageUrl")}</p> : null}</div> : null}
    <Field label="หมายเหตุ"><Textarea className="mt-3 min-h-16" onChange={(event) => update("instructions", event.target.value as T["instructions"])} value={method.instructions} /></Field>{uploadError ? <p aria-live="polite" className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
  </article>;
}

export function PaymentMethodList<T extends QuotationPaymentMethod>({ banks, errors, methods, mode, onChange }: PaymentMethodListProps<T>) {
  const update = (index: number, patch: Partial<T>) => onChange(normalizePaymentPositions(methods.map((method, current) => current === index ? { ...method, ...patch } : method)));
  const add = () => onChange(normalizePaymentPositions([...methods, { ...emptyPaymentMethod(), ...(mode === "master" ? { isDefault: false } : {}) } as T]));
  return <section aria-label="ช่องทางชำระเงิน" className="min-w-0"><DragDropProvider onDragEnd={(event) => { if (!event.canceled) onChange(normalizePaymentPositions(move(methods, event) as T[])); }}><div className="divide-y border-y">{methods.map((method, index) => <SortablePaymentMethod banks={banks} errors={errors} index={index} key={method.id} method={method} mode={mode} onPatch={(patch) => update(index, patch)} onRemove={() => onChange(normalizePaymentPositions(methods.filter((_, current) => current !== index)))} />)}</div></DragDropProvider><Button className="mt-3" onClick={add} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />เพิ่มช่องทางชำระเงิน</Button></section>;
}
