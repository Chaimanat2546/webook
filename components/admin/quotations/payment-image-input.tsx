"use client";

import { useEffect, useState } from "react";

import { validateQuotationPaymentAssetFile } from "../../../lib/quotation-assets";

export async function normalizePaymentImageToPng(file: File): Promise<File> {
  validateQuotationPaymentAssetFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ไม่สามารถเตรียมรูปภาพได้");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("ไม่สามารถแปลงรูปภาพได้")), "image/png");
    });
    return validateQuotationPaymentAssetFile(new File([blob], "quotation-payment.png", { type: "image/png" }));
  } finally {
    bitmap.close();
  }
}

export function PaymentImageInput({ disabled, error: serverError = "", field, label = "รูป QR หรือโลโก้ธนาคาร", onChange }: { disabled?: boolean; error?: string; field?: string; label?: string; onChange: (file: File) => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const message = serverError || error;
  const errorId = field ? `${field.replaceAll(".", "-")}-error` : undefined;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function select(file: File | null) {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const normalized = await normalizePaymentImageToPng(file);
      setPreviewUrl(URL.createObjectURL(normalized));
      onChange(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเตรียมรูปภาพได้");
    } finally {
      setLoading(false);
    }
  }

  return <label className="grid w-full min-w-0 max-w-full gap-2 text-sm">
    <span>{label}</span>
    <input accept="image/png,image/jpeg,image/webp" aria-describedby={message ? errorId : undefined} aria-invalid={Boolean(message)} className="w-full min-w-0 max-w-full" data-field={field} disabled={disabled || loading} onChange={(event) => select(event.target.files?.[0] ?? null)} type="file" />
    {previewUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- Blob URLs are local previews.
      <img alt="ตัวอย่างรูปช่องทางชำระเงิน" className="max-h-40 w-auto" src={previewUrl} />
    ) : null}
    <span aria-live="polite" id={errorId}>{loading ? "กำลังเตรียมรูปภาพ" : message}</span>
  </label>;
}
