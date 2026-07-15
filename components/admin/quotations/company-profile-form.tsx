"use client";

import { useState, useTransition } from "react";

import { saveCompanyProfileAction } from "../../../app/admin/quotations/actions";
import { validateQuotationAssetFile } from "../../../lib/quotation-assets";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import type { SellerSnapshot } from "../../../lib/quotation-types";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";

export function CompanyProfileForm({ initialSeller }: { initialSeller: SellerSnapshot }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialSeller.logoUrl);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [officeType, setOfficeType] = useState(initialSeller.officeType);
  const [pending, startTransition] = useTransition();

  async function normalizeLogo(file: File): Promise<File> {
    if (file.size === 0) throw new Error("Logo file is empty");
    if (file.size > 10 * 1024 * 1024) throw new Error("Logo file must be at most 10 MB");
    validateQuotationAssetFile(file);
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = resizeQuotationImageToMax(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to convert logo");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Unable to convert logo")),
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
      if (file instanceof File && file.size > 0) {
        setIsConverting(true);
        formData.set("logo", await normalizeLogo(file));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to prepare logo");
      return;
    } finally {
      setIsConverting(false);
    }
    startTransition(async () => {
      const result = await saveCompanyProfileAction(formData);
      if (result.ok) {
        setLogoUrl(result.logoUrl);
        setLogoUnavailable(false);
        setMessage("Seller profile saved");
      } else {
        setError(result.formError || Object.values(result.fieldErrors)[0] || "Unable to save seller profile");
      }
    });
  }

  const disabled = pending || isConverting;
  return <form className="grid gap-4" onSubmit={submit}>
    <Card><CardHeader><CardTitle>Legal identity</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Company name" name="name" required value={initialSeller.name} />
      <Field label="Tax ID" name="taxId" required value={initialSeller.taxId} />
      <div className="grid gap-2"><Label htmlFor="officeType">Office type</Label><select className="h-9 rounded-md border bg-transparent px-3 text-sm" defaultValue={officeType} id="officeType" name="officeType" onChange={(event) => setOfficeType(event.target.value === "branch" ? "branch" : "head_office")}><option value="head_office">Head office</option><option value="branch">Branch</option></select></div>
      {officeType === "branch" ? <Field label="Branch number" name="branchNumber" value={initialSeller.branchNumber} /> : <input name="branchNumber" type="hidden" value="" />}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Address</CardTitle></CardHeader><CardContent><div className="grid gap-2"><Label htmlFor="address">Address</Label><Textarea defaultValue={initialSeller.address} id="address" name="address" required /></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Company contact</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Field label="Phone" name="phone" value={initialSeller.phone} /><Field label="Email" name="email" type="email" value={initialSeller.email} /><Field label="Website" name="website" type="url" value={initialSeller.website} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Sales contact</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Field label="Contact name" name="contactName" value={initialSeller.contactName} /><Field label="Contact phone" name="contactPhone" value={initialSeller.contactPhone} /><Field label="Contact email" name="contactEmail" type="email" value={initialSeller.contactEmail} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Logo</CardTitle></CardHeader><CardContent className="grid gap-3">{logoUrl && !logoUnavailable ? <img alt="Current seller logo" className="max-h-32 max-w-48 object-contain" onError={() => setLogoUnavailable(true)} src={logoUrl} /> : <p className="text-sm text-muted-foreground">ไม่สามารถแสดงโลโก้</p>}<div className="grid gap-2"><Label htmlFor="logo">Replace logo</Label><Input accept="image/png,image/jpeg,image/webp" id="logo" name="logo" type="file" /><p className="text-sm text-muted-foreground">PNG, JPEG, or WebP; max 10 MB</p></div></CardContent></Card>
    <p aria-live="polite" className={error ? "text-destructive" : "text-muted-foreground"}>{error || message}</p>
    <Button disabled={disabled} type="submit">{disabled ? "Saving" : "Save"}</Button>
  </form>;
}

function Field({ label, name, required, type = "text", value }: { label: string; name: string; required?: boolean; type?: string; value: string }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input defaultValue={value} id={name} name={name} required={required} type={type} /></div>;
}
