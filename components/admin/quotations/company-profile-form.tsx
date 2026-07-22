"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { saveCompanyCertificationAction, saveCompanyPaymentMethodsAction, saveCompanyProfileAction } from "../../../app/admin/quotations/actions";
import { validateQuotationAssetFile } from "../../../lib/quotation-assets";
import type { CertificationSnapshot } from "../../../lib/quotation-certification";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import type { BankOption, CompanyPaymentMethod } from "../../../lib/quotation-payment-methods";
import type { SellerSnapshot } from "../../../lib/quotation-types";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { CertificationFields } from "./certification-fields";
import { PaymentMethodList } from "./payment-method-list";
import { useQuotationSettingsDirty } from "./quotation-settings-dirty";

function focusFirstSettingsError(errors: Record<string, string>) {
  const field = Object.keys(errors)[0];
  if (!field) return;
  requestAnimationFrame(() => {
    const targetField = field === "logoUrl" ? "logo" : field;
    const controls = document.querySelectorAll<HTMLElement>(`[data-field="${CSS.escape(targetField)}"], [name="${CSS.escape(targetField)}"]`);
    const control = [...controls].find((candidate) => candidate.offsetParent !== null) ?? controls[0];
    control?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  });
}

function SettingsGroup({ children, id, title }: { children: React.ReactNode; id: string; title: string }) {
  return <section className="grid gap-4 border-b pb-6 last:border-b-0 last:pb-0" data-settings-group={id}>
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </section>;
}

function SettingsActionFooter({ children, error, message }: { children: React.ReactNode; error: boolean; message: string }) {
  return <footer className="flex flex-col gap-3 border-t bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between" data-settings-action-footer>
    <p aria-live="polite" className={error ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-muted-foreground"}>{message}</p>
    {children}
  </footer>;
}

export function CompanyProfileForm({ initialSeller }: { initialSeller: SellerSnapshot }) {
  const { markDirty, markSaved } = useQuotationSettingsDirty();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [localLogoError, setLocalLogoError] = useState("");
  const [logoUrl, setLogoUrl] = useState(initialSeller.logoUrl);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [officeType, setOfficeType] = useState(initialSeller.officeType);
  const [pending, startTransition] = useTransition();
  const displayedLogoUrl = logoPreviewUrl || logoUrl;
  const serverLogoError = fieldErrors.logo || fieldErrors.logoUrl;
  const logoError = localLogoError || serverLogoError;

  useEffect(() => () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
  }, [logoPreviewUrl]);

  async function normalizeLogo(file: File): Promise<File> {
    if (file.size === 0) throw new Error("กรุณาเลือกไฟล์โลโก้");
    if (file.size > 10 * 1024 * 1024) throw new Error("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
    validateQuotationAssetFile(file);
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = resizeQuotationImageToMax(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("ไม่สามารถเตรียมโลโก้ได้");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("ไม่สามารถเตรียมโลโก้ได้")),
        "image/webp",
        0.9,
      ));
      return new File([blob], "quotation-logo.webp", { type: "image/webp" });
    } finally {
      bitmap.close();
    }
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setLocalLogoError("");
    if (!file) {
      setLogoPreviewUrl("");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      setLogoPreviewUrl("");
      setLocalLogoError("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
      return;
    }
    try {
      validateQuotationAssetFile(file);
      setLogoPreviewUrl(URL.createObjectURL(file));
      setLogoUnavailable(false);
    } catch {
      event.target.value = "";
      setLogoPreviewUrl("");
      setLocalLogoError("รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLocalLogoError("");
    setFieldErrors({});
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const file = formData.get("logo");
    try {
      if (file instanceof File && file.size > 0) {
        setIsConverting(true);
        formData.set("logo", await normalizeLogo(file));
      }
    } catch {
      const uploadError = "ไม่สามารถเตรียมโลโก้ได้";
      setLocalLogoError("ไม่สามารถเตรียมโลโก้ได้");
      toast.error(uploadError);
      return;
    } finally {
      setIsConverting(false);
    }
    startTransition(async () => {
      const result = await saveCompanyProfileAction(formData);
      if (result.ok) {
        setFieldErrors({});
        setLogoPreviewUrl("");
        setLogoUrl(result.logoUrl);
        setLogoUnavailable(false);
        setMessage("บันทึกข้อมูลผู้ขายแล้ว");
        markSaved();
        toast.success("บันทึกข้อมูลผู้ขายแล้ว");
      } else {
        const saveError = result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกข้อมูลผู้ขายได้";
        setFieldErrors(result.fieldErrors);
        setError(saveError);
        focusFirstSettingsError(result.fieldErrors);
        toast.error(saveError);
      }
    });
  }

  const disabled = pending || isConverting;
  return <form className="overflow-hidden rounded-xl border bg-card" onChangeCapture={markDirty} onSubmit={submit}>
    <div className="grid gap-6 p-4 sm:p-6">
      <SettingsGroup id="registration" title="ข้อมูลจดทะเบียน">
        <div className="grid gap-4 md:grid-cols-12">
          <Field className="md:col-span-7" error={fieldErrors.name} label="ชื่อบริษัท / ผู้ขาย" name="name" required value={initialSeller.name} />
          <Field className="md:col-span-5" digitsOnly error={fieldErrors.taxId} label="เลขประจำตัวผู้เสียภาษี" name="taxId" required value={initialSeller.taxId} />
          <fieldset className="grid gap-2 md:col-span-8">
            <legend className="text-sm">ประเภทสำนักงาน</legend>
            <RadioGroup
              aria-describedby={fieldErrors.officeType ? "officeType-error" : undefined}
              aria-invalid={Boolean(fieldErrors.officeType)}
              className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2"
              name="officeType"
              onValueChange={(value) => setOfficeType(value as SellerSnapshot["officeType"])}
              value={officeType}
            >
              {([[
                "unspecified",
                "ไม่ระบุ",
              ], ["head_office", "สำนักงานใหญ่"], ["branch", "สาขา"]] as const).map(([value, label]) => (
                <Label htmlFor={`officeType-${value}`} key={value}>
                  <RadioGroupItem
                    data-field="officeType"
                    id={`officeType-${value}`}
                    value={value}
                  />
                  <span>{label}</span>
                </Label>
              ))}
            </RadioGroup>
            {fieldErrors.officeType ? <p className="text-sm text-destructive" id="officeType-error">{fieldErrors.officeType}</p> : null}
          </fieldset>
          <Field className="md:col-span-4" disabled={officeType !== "branch"} error={fieldErrors.branchNumber} label="เลขที่สาขา" name="branchNumber" required={officeType === "branch"} value={initialSeller.branchNumber} />
        </div>
      </SettingsGroup>
      <SettingsGroup id="address" title="ที่อยู่">
        <div className="grid gap-2"><Label htmlFor="address">ที่อยู่</Label><Textarea aria-describedby={fieldErrors.address ? "address-error" : undefined} aria-invalid={Boolean(fieldErrors.address)} className="min-h-24" data-field="address" defaultValue={initialSeller.address} id="address" name="address" required />{fieldErrors.address ? <p className="text-sm text-destructive" id="address-error">{fieldErrors.address}</p> : null}</div>
      </SettingsGroup>
      <SettingsGroup id="contact" title="ช่องทางติดต่อบริษัท">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field error={fieldErrors.phone} label="เบอร์โทรศัพท์" name="phone" value={initialSeller.phone} /><Field error={fieldErrors.email} label="อีเมล" name="email" type="email" value={initialSeller.email} /><Field error={fieldErrors.website} label="เว็บไซต์" name="website" type="text" value={initialSeller.website} /></div>
        <div className="grid gap-3 border-t pt-4"><h3 className="text-sm font-medium">ผู้ติดต่อฝ่ายขาย</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field error={fieldErrors.contactName} label="ชื่อผู้ติดต่อ" name="contactName" value={initialSeller.contactName} /><Field error={fieldErrors.contactPhone} label="เบอร์โทรศัพท์ผู้ติดต่อ" name="contactPhone" value={initialSeller.contactPhone} /><Field error={fieldErrors.contactEmail} label="อีเมลผู้ติดต่อ" name="contactEmail" type="email" value={initialSeller.contactEmail} /></div></div>
      </SettingsGroup>
      <SettingsGroup id="logo" title="โลโก้ผู้ขาย">
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
          <div className="flex min-h-28 items-center justify-center rounded-lg border bg-muted/20 p-3">{displayedLogoUrl && !logoUnavailable ? <picture><img alt="โลโก้ผู้ขาย" className="max-h-28 max-w-full object-contain" onError={() => setLogoUnavailable(true)} src={displayedLogoUrl} /></picture> : <p className="text-sm text-muted-foreground">ยังไม่มีโลโก้</p>}</div>
          <div className="grid gap-2"><Label htmlFor="logo">เลือกโลโก้ใหม่</Label><Input accept="image/png,image/jpeg,image/webp" aria-describedby={logoError ? "logo-error" : undefined} aria-invalid={Boolean(logoError)} data-field="logo" disabled={disabled} id="logo" name="logo" onChange={handleLogoChange} type="file" />{logoError ? <p className="text-sm text-destructive" id="logo-error">{logoError}</p> : null}<p className="text-sm text-muted-foreground">รองรับ PNG, JPEG หรือ WebP ขนาดไม่เกิน 10 MB</p></div>
        </div>
      </SettingsGroup>
    </div>
    <SettingsActionFooter error={Boolean(error || logoError)} message={error || message}><Button className="w-full sm:w-auto" disabled={disabled} type="submit">{disabled ? "กำลังบันทึก..." : "บันทึกข้อมูลผู้ขาย"}</Button></SettingsActionFooter>
  </form>;
}

export function PaymentMethodsSettings({ banks, initialMethods }: { banks: BankOption[]; initialMethods: CompanyPaymentMethod[] }) {
  const { markDirty, markSaved } = useQuotationSettingsDirty();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState(initialMethods);
  const [message, setMessage] = useState("");
  const [uploadingFields, setUploadingFields] = useState(new Set<string>());
  const [pending, startTransition] = useTransition();

  function updateMethods(next: CompanyPaymentMethod[]) {
    markDirty();
    setMethods(next);
  }

  function updateUploadState(field: string, busy: boolean) {
    if (busy) markDirty();
    setUploadingFields((current) => {
      const next = new Set(current);
      if (busy) next.add(field); else next.delete(field);
      return next;
    });
  }

  function save() {
    if (uploadingFields.size) return;
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await saveCompanyPaymentMethodsAction(methods);
      if (result.ok) {
        setMessage("บันทึกช่องทางชำระเงินแล้ว");
        markSaved();
        toast.success("บันทึกช่องทางชำระเงินแล้ว");
      } else {
        const saveError = result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกช่องทางชำระเงินได้";
        setErrors(result.fieldErrors);
        setMessage(saveError);
        focusFirstSettingsError(result.fieldErrors);
        toast.error(saveError);
      }
    });
  }

  const disabled = pending || uploadingFields.size > 0;
  const hasError = Object.keys(errors).length > 0;
  return <div className="overflow-hidden rounded-xl border bg-card">
    <div className="grid gap-4 p-4 sm:p-6"><div><h2 className="font-semibold">ช่องทางชำระเงิน</h2><p className="text-sm text-muted-foreground">เลือกช่องทางที่ต้องการใช้เป็นค่าเริ่มต้นในใบเสนอราคาใหม่</p></div><PaymentMethodList banks={banks} errors={errors} methods={methods} mode="master" onChange={updateMethods} onUploadStateChange={updateUploadState} /></div>
    <SettingsActionFooter error={hasError} message={message}><Button className="w-full sm:w-auto" disabled={disabled} onClick={save} type="button">{disabled ? "กำลังบันทึก..." : "บันทึกช่องทางชำระเงิน"}</Button></SettingsActionFooter>
  </div>;
}

export function CertificationSettings({ initialCertification }: { initialCertification: CertificationSnapshot }) {
  const { markDirty, markSaved } = useQuotationSettingsDirty();
  const [certification, setCertification] = useState(initialCertification);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [uploadingFields, setUploadingFields] = useState(new Set<string>());
  const [pending, startTransition] = useTransition();

  const updateCertification: Dispatch<SetStateAction<CertificationSnapshot>> = (next) => {
    markDirty();
    setCertification(next);
  };

  function save() {
    if (uploadingFields.size) return;
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await saveCompanyCertificationAction(certification);
      if (result.ok) {
        setMessage("บันทึกข้อมูลรับรองแล้ว");
        markSaved();
        toast.success("บันทึกข้อมูลรับรองแล้ว");
      } else {
        const saveError = result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกข้อมูลรับรองได้";
        setErrors(result.fieldErrors);
        setMessage(saveError);
        focusFirstSettingsError(result.fieldErrors);
        toast.error(saveError);
      }
    });
  }

  function updateUploadState(field: string, busy: boolean) {
    if (busy) markDirty();
    setUploadingFields((current) => {
      const next = new Set(current);
      if (busy) next.add(field); else next.delete(field);
      return next;
    });
  }

  const disabled = pending || uploadingFields.size > 0;
  return <div className="overflow-hidden rounded-xl border bg-card">
    <div className="grid gap-4 p-4 sm:p-6"><div><h2 className="font-semibold">ข้อมูลรับรองหลัก</h2><p className="text-sm text-muted-foreground">ข้อมูลนี้จะใช้เป็นค่าเริ่มต้นสำหรับใบเสนอราคาใหม่</p></div><CertificationFields disabled={disabled} errors={errors} onChange={updateCertification} onUploadStateChange={updateUploadState} value={certification} /></div>
    <SettingsActionFooter error={Object.keys(errors).length > 0} message={message}><Button className="w-full sm:w-auto" disabled={disabled} onClick={save} type="button">{disabled ? "กำลังบันทึก..." : "บันทึกข้อมูลรับรอง"}</Button></SettingsActionFooter>
  </div>;
}

function Field({ className, digitsOnly = false, disabled = false, error, label, name, required = false, type = "text", value }: { className?: string; digitsOnly?: boolean; disabled?: boolean; error?: string; label: string; name: string; required?: boolean; type?: string; value: string }) {
  const errorId = `${name}-error`;
  return <div className={`grid gap-2 ${className ?? ""}`}><Label htmlFor={name}>{label}</Label><Input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} data-field={name} defaultValue={value} disabled={disabled} id={name} inputMode={digitsOnly ? "numeric" : undefined} maxLength={digitsOnly ? 13 : undefined} name={name} onInput={digitsOnly ? (event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 13); } : undefined} required={required} type={type} />{error ? <p className="text-sm text-destructive" id={errorId}>{error}</p> : null}</div>;
}
