"use client";

import { useState, useTransition } from "react";

import { saveCompanyProfileAction } from "../../../app/admin/quotations/actions";
import { validateQuotationAssetFile } from "../../../lib/quotation-assets";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import type { SellerSnapshot } from "../../../lib/quotation-types";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";

export function CompanyProfileForm({ initialSeller }: { initialSeller: SellerSnapshot }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function normalizeLogo(file: File): Promise<File> {
    validateQuotationAssetFile(file);
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = resizeQuotationImageToMax(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("ไม่สามารถแปลงโลโก้ได้");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("ไม่สามารถแปลงโลโก้ได้")),
        "image/webp",
        0.9,
      ));
      return new File([blob], "quotation-logo.webp", { type: "image/webp" });
    } finally {
      bitmap.close();
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const file = formData.get("logo");
    try {
      if (file instanceof File && file.size > 0) formData.set("logo", await normalizeLogo(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเตรียมโลโก้ได้");
      return;
    }
    startTransition(async () => {
      const result = await saveCompanyProfileAction(formData);
      if (result.ok) setMessage("บันทึกข้อมูลผู้ขายแล้ว");
      else setError(result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถบันทึกข้อมูลผู้ขายได้");
    });
  }

  return <form className="grid gap-4" onSubmit={submit}>
    <div className="grid gap-2"><Label htmlFor="name">ชื่อบริษัท</Label><Input defaultValue={initialSeller.name} id="name" name="name" required /></div>
    <div className="grid gap-2"><Label htmlFor="address">ที่อยู่</Label><Textarea defaultValue={initialSeller.address} id="address" name="address" required /></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label><Input defaultValue={initialSeller.taxId} id="taxId" name="taxId" required /></div>
      <div className="grid gap-2"><Label htmlFor="officeType">สาขา</Label><select defaultValue={initialSeller.officeType} id="officeType" name="officeType"><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></div>
      <div className="grid gap-2"><Label htmlFor="branchNumber">เลขสาขา</Label><Input defaultValue={initialSeller.branchNumber} id="branchNumber" name="branchNumber" /></div>
      <div className="grid gap-2"><Label htmlFor="phone">โทรศัพท์</Label><Input defaultValue={initialSeller.phone} id="phone" name="phone" /></div>
      <div className="grid gap-2"><Label htmlFor="email">อีเมล</Label><Input defaultValue={initialSeller.email} id="email" name="email" type="email" /></div>
      <div className="grid gap-2"><Label htmlFor="website">เว็บไซต์</Label><Input defaultValue={initialSeller.website} id="website" name="website" type="url" /></div>
      <div className="grid gap-2"><Label htmlFor="contactName">ผู้ติดต่อฝ่ายขาย</Label><Input defaultValue={initialSeller.contactName} id="contactName" name="contactName" /></div>
      <div className="grid gap-2"><Label htmlFor="contactPhone">โทรศัพท์ผู้ติดต่อ</Label><Input defaultValue={initialSeller.contactPhone} id="contactPhone" name="contactPhone" /></div>
      <div className="grid gap-2"><Label htmlFor="contactEmail">อีเมลผู้ติดต่อ</Label><Input defaultValue={initialSeller.contactEmail} id="contactEmail" name="contactEmail" type="email" /></div>
    </div>
    <div className="grid gap-2"><Label htmlFor="logo">โลโก้</Label><Input accept="image/png,image/jpeg,image/webp" id="logo" name="logo" type="file" /><p className="text-sm text-muted-foreground">PNG, JPEG หรือ WebP ขนาดไม่เกิน 10 MB</p></div>
    <p aria-live="polite" className={error ? "text-destructive" : "text-muted-foreground"}>{error || message}</p>
    <Button disabled={pending} type="submit">{pending ? "กำลังบันทึก" : "บันทึก"}</Button>
  </form>;
}
