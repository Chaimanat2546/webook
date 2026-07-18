"use client";

import { useEffect, useState, useTransition } from "react";

import { saveCompanyPaymentMethodsAction, saveCompanyProfileAction } from "../../../app/admin/quotations/actions";
import { validateQuotationAssetFile } from "../../../lib/quotation-assets";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import type { BankOption, CompanyPaymentMethod } from "../../../lib/quotation-payment-methods";
import type { SellerSnapshot } from "../../../lib/quotation-types";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { PaymentMethodList } from "./payment-method-list";

export function CompanyProfileForm({ initialSeller }: { initialSeller: SellerSnapshot }) {
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialSeller.logoUrl);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [officeType, setOfficeType] = useState(initialSeller.officeType);
  const [pending, startTransition] = useTransition();
  const displayedLogoUrl = logoPreviewUrl || logoUrl;

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
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
    if (!file) {
      setLogoPreviewUrl("");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      setLogoPreviewUrl("");
      setError("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
      return;
    }
    try {
      validateQuotationAssetFile(file);
      setLogoPreviewUrl(URL.createObjectURL(file));
      setLogoUnavailable(false);
    } catch {
      event.target.value = "";
      setLogoPreviewUrl("");
      setError("รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const file = formData.get("logo");
    try {
      if (file instanceof File && file.size > 0) {
        setIsConverting(true);
        formData.set("logo", await normalizeLogo(file));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเตรียมโลโก้ได้");
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
      } else {
        setFieldErrors(result.fieldErrors);
        setError(result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกข้อมูลผู้ขายได้");
      }
    });
  }

  const disabled = pending || isConverting;
  return <form className="grid gap-4" onSubmit={submit}>
    <Card><CardHeader><CardTitle>ข้อมูลจดทะเบียน</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field error={fieldErrors.name} label="ชื่อบริษัท / ผู้ขาย" name="name" required value={initialSeller.name} />
      <Field error={fieldErrors.taxId} label="เลขประจำตัวผู้เสียภาษี" name="taxId" required value={initialSeller.taxId} />
      <div className="grid gap-2"><Label htmlFor="officeType">ประเภทสำนักงาน</Label><select aria-invalid={Boolean(fieldErrors.officeType)} className="h-9 rounded-md border bg-transparent px-3 text-sm" defaultValue={officeType} id="officeType" name="officeType" onChange={(event) => setOfficeType(event.target.value === "branch" ? "branch" : "head_office")}><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select>{fieldErrors.officeType ? <p className="text-sm text-destructive">{fieldErrors.officeType}</p> : null}</div>
      {officeType === "branch" ? <Field error={fieldErrors.branchNumber} label="เลขที่สาขา" name="branchNumber" required value={initialSeller.branchNumber} /> : <input name="branchNumber" type="hidden" value="" />}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>ที่อยู่</CardTitle></CardHeader><CardContent><div className="grid gap-2"><Label htmlFor="address">ที่อยู่</Label><Textarea aria-invalid={Boolean(fieldErrors.address)} defaultValue={initialSeller.address} id="address" name="address" required />{fieldErrors.address ? <p className="text-sm text-destructive">{fieldErrors.address}</p> : null}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>ช่องทางติดต่อบริษัท</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Field error={fieldErrors.phone} label="เบอร์โทรศัพท์" name="phone" value={initialSeller.phone} /><Field error={fieldErrors.email} label="อีเมล" name="email" type="email" value={initialSeller.email} /><Field error={fieldErrors.website} label="เว็บไซต์" name="website" type="url" value={initialSeller.website} /></CardContent></Card>
    <Card><CardHeader><CardTitle>ผู้ติดต่อฝ่ายขาย</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Field error={fieldErrors.contactName} label="ชื่อผู้ติดต่อ" name="contactName" value={initialSeller.contactName} /><Field error={fieldErrors.contactPhone} label="เบอร์โทรศัพท์ผู้ติดต่อ" name="contactPhone" value={initialSeller.contactPhone} /><Field error={fieldErrors.contactEmail} label="อีเมลผู้ติดต่อ" name="contactEmail" type="email" value={initialSeller.contactEmail} /></CardContent></Card>
    <Card><CardHeader><CardTitle>โลโก้ผู้ขาย</CardTitle></CardHeader><CardContent className="grid gap-3">{displayedLogoUrl && !logoUnavailable ? <img alt="โลโก้ผู้ขาย" className="max-h-32 max-w-48 object-contain" onError={() => setLogoUnavailable(true)} src={displayedLogoUrl} /> : <p className="text-sm text-muted-foreground">ไม่สามารถแสดงโลโก้</p>}<div className="grid gap-2"><Label htmlFor="logo">เลือกโลโก้ใหม่</Label><Input accept="image/png,image/jpeg,image/webp" id="logo" name="logo" onChange={handleLogoChange} disabled={disabled} type="file" /><p className="text-sm text-muted-foreground">รองรับ PNG, JPEG หรือ WebP ขนาดไม่เกิน 10 MB</p></div></CardContent></Card>
    <p aria-live="polite" className={error ? "text-destructive" : "text-muted-foreground"}>{error || message}</p>
    <Button disabled={disabled} type="submit">{disabled ? "กำลังบันทึก..." : "บันทึกข้อมูลผู้ขาย"}</Button>
  </form>;
}

export function PaymentMethodsSettings({ banks, initialMethods }: { banks: BankOption[]; initialMethods: CompanyPaymentMethod[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState(initialMethods);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function save() {
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await saveCompanyPaymentMethodsAction(methods);
      if (result.ok) setMessage("บันทึกช่องทางชำระเงินแล้ว");
      else {
        setErrors(result.fieldErrors);
        setMessage(result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกช่องทางชำระเงินได้");
      }
    });
  }
  return <Card><CardHeader><CardTitle>ช่องทางชำระเงิน</CardTitle></CardHeader><CardContent className="grid gap-4"><PaymentMethodList banks={banks} errors={errors} methods={methods} mode="master" onChange={setMethods} /><p aria-live="polite" className={Object.keys(errors).length || message === "ไม่สามารถบันทึกช่องทางชำระเงินได้" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p><Button disabled={pending} onClick={save} type="button">{pending ? "กำลังบันทึก..." : "บันทึกช่องทางชำระเงิน"}</Button></CardContent></Card>;
}

function Field({ error, label, name, required, type = "text", value }: { error?: string; label: string; name: string; required?: boolean; type?: string; value: string }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input aria-invalid={Boolean(error)} defaultValue={value} id={name} name={name} required={required} type={type} />{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>;
}
