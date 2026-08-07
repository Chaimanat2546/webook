"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { validateQuotationAssetFile } from "../../../lib/quotation-assets";
import { resizeQuotationImageToMax } from "../../../lib/quotation-image-resize";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";

interface QuotationLogoImageInputProps {
  disabled?: boolean;
  error?: string;
  field: string;
  label: string;
  onBusyChange?: (busy: boolean) => void;
  onChange: (url: string) => void;
  onRemove: () => void;
  value: string;
}

async function normalizeQuotationLogoImage(file: File): Promise<File> {
  validateQuotationAssetFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    const { height, width } = resizeQuotationImageToMax(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.height = height;
    canvas.width = width;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ไม่สามารถเตรียมโลโก้ได้");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("ไม่สามารถแปลงโลโก้ได้")),
      "image/webp",
      0.9,
    ));
    return validateQuotationAssetFile(new File([blob], "quotation-logo.webp", { type: "image/webp" }));
  } finally {
    bitmap.close();
  }
}

function isUploadResult(value: unknown): value is { url: string } {
  return typeof value === "object" && value !== null && "url" in value && typeof value.url === "string";
}

function isUploadError(value: unknown): string {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : "";
}

export function QuotationLogoImageInput({
  disabled,
  error: serverError = "",
  field,
  label,
  onBusyChange,
  onChange,
  onRemove,
  value,
}: QuotationLogoImageInputProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = field.replaceAll(".", "-");
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const message = serverError || error;
  const displayedUrl = previewUrl || value;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function select(file: File | null) {
    if (!file) return;
    setError("");
    setLoading(true);
    onBusyChange?.(true);
    try {
      const normalized = await normalizeQuotationLogoImage(file);
      setPreviewUrl(URL.createObjectURL(normalized));
      const formData = new FormData();
      formData.set("file", normalized);
      const response = await fetch("/api/admin/quotations/logo-assets", { body: formData, method: "POST" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isUploadResult(result)) {
        throw new Error(isUploadError(result) || "ไม่สามารถอัปโหลดโลโก้สำหรับใบเสนอราคาได้");
      }
      onChange(result.url);
    } catch (cause) {
      const uploadError = cause instanceof Error ? cause.message : "ไม่สามารถเตรียมโลโก้ได้";
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
    onRemove();
  }

  return <div className="grid min-w-0 gap-2 text-sm">
    <Label htmlFor={inputId}>{label}</Label>
    <input accept="image/png,image/jpeg,image/webp" aria-describedby={message ? `${hintId} ${errorId}` : hintId} aria-invalid={Boolean(message)} className="w-full min-w-0 max-w-full" data-field={field} disabled={disabled || loading} id={inputId} onChange={(event) => void select(event.target.files?.[0] ?? null)} ref={inputRef} type="file" />
    <p className="text-xs text-muted-foreground" id={hintId}>รองรับ PNG, JPEG หรือ WebP ขนาดไม่เกิน 10 MB · ระบบจะแปลงเป็น WebP</p>
    {displayedUrl ? <div className="flex flex-wrap items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob and validated asset URLs need a direct preview. */}
      <img alt={`ตัวอย่าง${label}`} className="max-h-28 max-w-full rounded-md border object-contain" src={displayedUrl} />
      <Button disabled={disabled || loading} onClick={remove} size="sm" type="button" variant="outline">ลบโลโก้</Button>
    </div> : null}
    <span aria-live="polite" className={message ? "text-destructive" : "text-muted-foreground"} id={errorId}>{loading ? "กำลังเตรียมโลโก้" : message}</span>
  </div>;
}
