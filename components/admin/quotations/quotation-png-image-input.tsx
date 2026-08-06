"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { validateQuotationPaymentAssetFile } from "../../../lib/quotation-assets";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";

export interface QuotationPngImageInputProps {
  disabled?: boolean;
  error?: string;
  field: string;
  label: string;
  onBusyChange?: (busy: boolean) => void;
  onChange: (file: File) => Promise<void> | void;
  onRemove?: () => void;
  value?: string;
}

export async function normalizeQuotationPngImage(file: File): Promise<File> {
  validateQuotationPaymentAssetFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const size = resizeQuotationImageToMax(bitmap.width, bitmap.height);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ไม่สามารถเตรียมรูปภาพได้");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("ไม่สามารถแปลงรูปภาพได้")), "image/png");
    });
    return validateQuotationPaymentAssetFile(new File([blob], "quotation-image.png", { type: "image/png" }));
  } finally {
    bitmap.close();
  }
}

export function QuotationPngImageInput({ disabled, error: serverError = "", field, label, onBusyChange, onChange, onRemove, value = "" }: QuotationPngImageInputProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const displayedUrl = previewUrl || value;
  const message = serverError || error;
  const inputId = field.replaceAll(".", "-");
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function select(file: File | null) {
    if (!file) return;
    setError("");
    setLoading(true);
    onBusyChange?.(true);
    try {
      const normalized = await normalizeQuotationPngImage(file);
      const localPreviewUrl = URL.createObjectURL(normalized);
      setPreviewUrl(localPreviewUrl);
      await onChange(normalized);
    } catch (cause) {
      const uploadError = cause instanceof Error ? cause.message : "ไม่สามารถเตรียมรูปภาพได้";
      setPreviewUrl("");
      setError(uploadError);
      toast.error(uploadError);
    } finally {
      setLoading(false);
      onBusyChange?.(false);
    }
  }

  function remove() {
    setError("");
    setPreviewUrl("");
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  }

  return <div className="grid min-w-0 gap-2 text-sm">
    <Label htmlFor={inputId}>{label}</Label>
    <input accept="image/png,image/jpeg,image/webp" aria-describedby={message ? `${hintId} ${errorId}` : hintId} aria-invalid={Boolean(message)} className="w-full min-w-0 max-w-full" data-field={field} disabled={disabled || loading} id={inputId} onChange={(event) => select(event.target.files?.[0] ?? null)} ref={inputRef} type="file" />
    <p className="text-xs text-muted-foreground" id={hintId}>รองรับ PNG, JPEG หรือ WebP ขนาดไม่เกิน 2 MB · ระบบจะแปลงเป็น PNG</p>
    {displayedUrl ? <div className="flex flex-wrap items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob and validated asset URLs need a direct preview. */}
      <img alt={`ตัวอย่าง${label}`} className="max-h-40 max-w-full rounded-md border object-contain" src={displayedUrl} />
      {onRemove ? <Button disabled={disabled || loading} onClick={remove} size="sm" type="button" variant="outline">ลบรูป</Button> : null}
    </div> : null}
    <span aria-live="polite" className={message ? "text-destructive" : "text-muted-foreground"} id={errorId}>{loading ? "กำลังเตรียมรูปภาพ" : message}</span>
  </div>;
}
