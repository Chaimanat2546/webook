import { NextResponse } from "next/server";

import { canUseQuotation, requireAdmin } from "../../../../../server/auth/admin";
import { uploadQuotationLogoImage } from "../../../../../server/services/quotation-logo-assets";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" && Number.isFinite(value.size) &&
    typeof value.type === "string";
}

function imageUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("10 MB") || message.startsWith("รูปภาพ") || message.startsWith("ไฟล์โลโก้")) {
    return message;
  }
  if (message.startsWith("Failed to upload quotation asset (")) {
    return `ระบบจัดเก็บรูปภาพตอบกลับผิดพลาด: ${message.replace("Failed to upload quotation asset ", "")}`;
  }
  return "ไม่สามารถอัปโหลดโลโก้สำหรับใบเสนอราคาได้";
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "คำขออัปโหลดไม่ถูกต้อง" }, { status: 403 });
  }

  const { adminUser } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์จัดการใบเสนอราคา" }, { status: 403 });
  }

  try {
    const value = (await request.formData()).get("file");
    if (!isUploadedFile(value)) throw new Error("กรุณาเลือกไฟล์โลโก้");
    const url = await uploadQuotationLogoImage(value);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to upload quotation logo asset", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: imageUploadError(error) }, { status: 400 });
  }
}
