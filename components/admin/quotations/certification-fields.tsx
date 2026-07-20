"use client";

import type { Dispatch, SetStateAction } from "react";

import { uploadQuotationCertificationAssetAction } from "../../../app/admin/quotations/actions";
import { updateCertificationSigner, type CertificationSnapshot } from "../../../lib/quotation-certification";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { QuotationPngImageInput } from "./quotation-png-image-input";

interface CertificationFieldsProps {
  disabled?: boolean;
  errors: Record<string, string>;
  onChange: Dispatch<SetStateAction<CertificationSnapshot>>;
  onUploadStateChange?: (field: string, busy: boolean) => void;
  value: CertificationSnapshot;
}

export function CertificationFields({ disabled, errors, onChange, onUploadStateChange, value }: CertificationFieldsProps) {
  return <div className="grid gap-4">
    <div className="grid gap-4 md:grid-cols-2">
      <fieldset className="grid min-w-0 gap-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">ผู้ออกเอกสาร</legend>
        <TextField disabled={disabled} error={errors["certification.issuer.name"]} field="certification.issuer.name" label="ชื่อผู้ออกเอกสาร" onChange={(name) => onChange((current) => updateCertificationSigner(current, "issuer", { name }))} value={value.issuer.name} />
        <TextField disabled={disabled} error={errors["certification.issuer.position"]} field="certification.issuer.position" label="ตำแหน่ง" onChange={(position) => onChange((current) => updateCertificationSigner(current, "issuer", { position }))} value={value.issuer.position} />
        <CertificationImageField disabled={disabled} error={errors["certification.issuer.signatureUrl"]} field="certification.issuer.signatureUrl" label="ลายเซ็นผู้ออกเอกสาร" onChange={(signatureUrl) => onChange((current) => updateCertificationSigner(current, "issuer", { signatureUrl }))} onUploadStateChange={onUploadStateChange} value={value.issuer.signatureUrl} />
      </fieldset>
      <fieldset className="grid min-w-0 gap-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">ผู้อนุมัติ</legend>
        <TextField disabled={disabled} error={errors["certification.approver.name"]} field="certification.approver.name" label="ชื่อผู้อนุมัติ" onChange={(name) => onChange((current) => updateCertificationSigner(current, "approver", { name }))} value={value.approver.name} />
        <TextField disabled={disabled} error={errors["certification.approver.position"]} field="certification.approver.position" label="ตำแหน่ง" onChange={(position) => onChange((current) => updateCertificationSigner(current, "approver", { position }))} value={value.approver.position} />
        <CertificationImageField disabled={disabled} error={errors["certification.approver.signatureUrl"]} field="certification.approver.signatureUrl" label="ลายเซ็นผู้อนุมัติ" onChange={(signatureUrl) => onChange((current) => updateCertificationSigner(current, "approver", { signatureUrl }))} onUploadStateChange={onUploadStateChange} value={value.approver.signatureUrl} />
      </fieldset>
    </div>
    <fieldset className="grid min-w-0 gap-4 rounded-lg border p-4">
      <legend className="px-1 font-medium">ตราประทับบริษัท</legend>
      <CertificationImageField disabled={disabled} error={errors["certification.companyStampUrl"]} field="certification.companyStampUrl" label="รูปตราประทับบริษัท" onChange={(companyStampUrl) => onChange((current) => ({ ...current, companyStampUrl }))} onUploadStateChange={onUploadStateChange} value={value.companyStampUrl} />
    </fieldset>
  </div>;
}

function TextField({ disabled, error, field, label, onChange, value }: { disabled?: boolean; error?: string; field: string; label: string; onChange: (value: string) => void; value: string }) {
  const errorId = `${field.replaceAll(".", "-")}-error`;
  return <div className="grid gap-2">
    <Label htmlFor={field}>{label}</Label>
    <Input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} data-field={field} disabled={disabled} id={field} onChange={(event) => onChange(event.target.value)} value={value} />
    {error ? <p className="text-sm text-destructive" id={errorId}>{error}</p> : null}
  </div>;
}

function CertificationImageField({ disabled, error: serverError, field, label, onChange, onUploadStateChange, value }: { disabled?: boolean; error?: string; field: string; label: string; onChange: (value: string) => void; onUploadStateChange?: (field: string, busy: boolean) => void; value: string }) {
  async function upload(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadQuotationCertificationAssetAction(formData).catch(() => null);
    if (!result) throw new Error("ไม่สามารถอัปโหลดรูปการรับรองได้");
    if (result.ok) onChange(result.url);
    else {
      const message = result.formError || Object.values(result.fieldErrors)[0] || "ไม่สามารถอัปโหลดรูปการรับรองได้";
      throw new Error(message);
    }
  }

  return <QuotationPngImageInput disabled={disabled} error={serverError} field={field} label={label} onBusyChange={(busy) => onUploadStateChange?.(field, busy)} onChange={upload} onRemove={() => onChange("")} value={value} />;
}
