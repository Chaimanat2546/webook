"use server";

import { revalidatePath } from "next/cache";

import {
  QUOTATION_SNAPSHOT_IMAGE_MAX_BYTES,
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
  buildQuotationCertificationAssetObjectKey,
  buildQuotationCertificationAssetUrl,
  buildQuotationPaymentAssetObjectKey,
  buildQuotationPaymentAssetUrl,
  validateQuotationAssetFile,
  validateQuotationAssetUrl,
  validateQuotationCertificationAssetUrl,
  validateQuotationPaymentAssetUrl,
} from "../../../lib/quotation-assets";
import type { QuotationPayload } from "../../../lib/quotation-types";
import { isQuotationDocumentDisplay } from "../../../lib/quotation-document-display";
import { isQuotationTemplate } from "../../../lib/quotation-template";
import { isQuotationLayoutConfig } from "../../../lib/quotation-layout";
import { getQuotationAssetEnv } from "../../../lib/env";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";
import {
  getQuotationCompanyProfile,
  listQuotationItemNames,
  saveCompanyPaymentMethods,
  saveQuotation,
  saveQuotationCompanyCertification,
  saveQuotationCompanyProfile,
  saveQuotationDocumentDisplayDefaults,
  saveQuotationTemplateDefault,
  publishQuotationDocumentTemplateLayout,
  rotateQuotationPublicToken,
  softDeleteQuotation,
} from "../../../server/repositories/quotations";
import { QuotationPaymentAssetOriginNotConfiguredError } from "../../../server/repositories/quotation-errors";
import {
  prepareSellerSnapshot,
  prepareCertificationSnapshot,
  prepareQuotationPayload,
  QuotationValidationError,
} from "../../../server/services/quotations";
import { prepareCompanyPaymentMethods } from "../../../server/services/quotation-payment-methods";
import {
  deleteQuotationAssetObject,
  uploadQuotationAssetObject,
} from "../../../server/storage/quotation-assets";
import { getQuotationAssetRuntimeEnv } from "../../../server/storage/quotation-asset-env";
import { validateQuotationUploadedImage } from "../../../server/services/quotation-image-validation";

export type QuotationActionResult =
  | { documentNumber: string; id: string; ok: true; payload: QuotationPayload; publicToken: string }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

export type CompanyProfileActionResult =
  | { logoUrl: string; ok: true }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

export type CompanyPaymentMethodsActionResult =
  | { ok: true }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

export type QuotationPaymentAssetActionResult =
  | { ok: true; url: string }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

export async function saveQuotationDocumentDisplayDefaultsAction(
  value: unknown,
): Promise<{ ok: true } | { formError: string; ok: false }> {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!isQuotationDocumentDisplay(value)) {
    return { formError: "รูปแบบเอกสารไม่ถูกต้อง", ok: false };
  }
  try {
    await saveQuotationDocumentDisplayDefaults(supabase, value, user.id);
    return { ok: true };
  } catch {
    return { formError: "ไม่สามารถบันทึกค่าเริ่มต้นรูปแบบเอกสารได้", ok: false };
  }
}

export async function saveQuotationTemplateDefaultAction(
  value: unknown,
): Promise<{ ok: true } | { formError: string; ok: false }> {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!isQuotationTemplate(value)) {
    return { formError: "เทมเพลตใบเสนอราคาไม่ถูกต้อง", ok: false };
  }
  try {
    await saveQuotationTemplateDefault(supabase, value, user.id);
    return { ok: true };
  } catch {
    return { formError: "ไม่สามารถบันทึกเทมเพลตเริ่มต้นได้", ok: false };
  }
}

export async function publishQuotationDocumentTemplateLayoutAction(
  template: unknown,
  expectedRevisionNumber: unknown,
  config: unknown,
): Promise<{ ok: true; revisionNumber: number } | { formError: string; ok: false }> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  const expectedRevision = typeof expectedRevisionNumber === "number"
    ? expectedRevisionNumber
    : 0;
  if (!isQuotationTemplate(template)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1
    || !isQuotationLayoutConfig(config, template)) {
    return { formError: "เลเอาท์เอกสารไม่ถูกต้อง", ok: false };
  }
  try {
    const published = await publishQuotationDocumentTemplateLayout(
      supabase,
      template,
      expectedRevision,
      config,
    );
    revalidatePath("/admin/quotations");
    revalidatePath("/admin/quotations/new");
    revalidatePath("/admin/quotations/settings/company");
    return { ok: true, revisionNumber: published.revisionNumber };
  } catch (error) {
    const message = error instanceof Error && /conflict/i.test(error.message)
      ? "มีเลเอาท์เวอร์ชันใหม่แล้ว กรุณาโหลดข้อมูลล่าสุด"
      : "ไม่สามารถเผยแพร่เลเอาท์ได้";
    return { formError: message, ok: false };
  }
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function denied(): QuotationActionResult {
  return {
    fieldErrors: {},
    formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา",
    ok: false,
  };
}

function paymentAssetErrors(paymentMethods: QuotationPayload["paymentMethods"]): Record<string, string> {
  const workerUrl = getQuotationAssetEnv().workerUrl;
  const errors: Record<string, string> = {};
  for (const [index, method] of paymentMethods.entries()) {
    for (const [key, url] of [["customBankLogoUrl", method.customBankLogoUrl], ["qrImageUrl", method.qrImageUrl]] as const) {
      if (!url) continue;
      try {
        validateQuotationPaymentAssetUrl(url, workerUrl);
      } catch {
        errors[`paymentMethods.${index}.${key}`] = "รูปช่องทางชำระเงินต้องมาจากพื้นที่จัดเก็บของระบบ";
      }
    }
  }
  return errors;
}

function certificationAssetErrors(certification: QuotationPayload["certification"]): Record<string, string> {
  const workerUrl = getQuotationAssetEnv().workerUrl;
  const errors: Record<string, string> = {};
  for (const [key, url] of [
    ["certification.issuer.signatureUrl", certification.issuer.signatureUrl],
    ["certification.approver.signatureUrl", certification.approver.signatureUrl],
    ["certification.companyStampUrl", certification.companyStampUrl],
  ] as const) {
    if (!url) continue;
    try {
      validateQuotationCertificationAssetUrl(url, workerUrl);
    } catch {
      errors[key] = "รูปการรับรองต้องมาจากพื้นที่จัดเก็บของระบบ";
    }
  }
  return errors;
}

function missingPaymentAssetOrigin(): { fieldErrors: Record<string, string>; formError: string; ok: false } {
  return {
    fieldErrors: {},
    formError: "ยังไม่ได้ตั้งค่า origin สำหรับรูปแบบชำระเงิน กรุณาตั้งค่าให้ตรงกับ ADVERTISEMENT_IMAGE_WORKER_URL",
    ok: false,
  };
}

export async function saveQuotationAction(value: unknown): Promise<QuotationActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return denied();

  try {
    const itemNames = await listQuotationItemNames(supabase);
    const prepared = prepareQuotationPayload(value, itemNames);
    if (prepared.payload.seller.logoUrl) {
      try {
        validateQuotationAssetUrl(prepared.payload.seller.logoUrl, getQuotationAssetEnv().workerUrl);
      } catch {
        return {
          fieldErrors: { "seller.logoUrl": "โลโก้ผู้ขายต้องมาจากพื้นที่จัดเก็บของระบบ" },
          formError: "",
          ok: false,
        };
      }
    }
    const paymentErrors = paymentAssetErrors(prepared.payload.paymentMethods);
    if (Object.keys(paymentErrors).length) return { fieldErrors: paymentErrors, formError: "", ok: false };
    const certificationErrors = certificationAssetErrors(prepared.payload.certification);
    if (Object.keys(certificationErrors).length) return { fieldErrors: certificationErrors, formError: "", ok: false };
    const saved = await saveQuotation(supabase, prepared.rpcPayload);
    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${encodeURIComponent(saved.id)}`);
    revalidatePath(`/q/${encodeURIComponent(saved.publicToken)}`);
    return { ...saved, ok: true, payload: prepared.payload };
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: error.fieldErrors, formError: "", ok: false };
    }
    if (error instanceof QuotationPaymentAssetOriginNotConfiguredError) {
      return missingPaymentAssetOrigin();
    }
    console.error(
      "Failed to save quotation",
      error instanceof Error ? error.message : "Unknown error",
    );
    return {
      fieldErrors: {},
      formError: "ไม่สามารถบันทึกใบเสนอราคาได้ กรุณาลองอีกครั้ง",
      ok: false,
    };
  }
}

function quotationImageUploadError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("2 MB") || message.startsWith("รูปภาพ") || message.startsWith("ไฟล์รูป")) return message;

  // Storage errors contain only the HTTP status and the Media Worker's short public response.
  // Returning that context lets the user retry a transient failure and lets support identify a
  // configuration mismatch without exposing the storage secret or URL.
  if (message.startsWith("Failed to upload quotation asset (")) {
    return `ระบบจัดเก็บรูปภาพตอบกลับผิดพลาด: ${message.replace("Failed to upload quotation asset ", "")}`;
  }
  if (message.startsWith("Missing advertisement image environment variables")) {
    return "ระบบจัดเก็บรูปภาพยังไม่ได้ตั้งค่า กรุณาลองใหม่อีกครั้ง";
  }
  return fallback;
}

/**
 * Cloudflare's Server Action multipart implementation can create a File from a
 * different realm than the worker global.  Do not rely on `instanceof File` at
 * this trust boundary; validate the file's bytes, MIME type, and size below.
 */
function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" && Number.isFinite(value.size) &&
    typeof value.type === "string";
}

/**
 * The browser has already normalized these optional document images to PNG.
 * Trust the server-side PNG signature validation rather than multipart MIME,
 * which is not preserved consistently by every Worker runtime.
 */
function validateNormalizedQuotationPng(file: File): File {
  if (file.size === 0) throw new Error("ไฟล์รูปว่างเปล่า");
  if (file.size > QUOTATION_SNAPSHOT_IMAGE_MAX_BYTES) throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 2 MB");
  return file;
}

export async function rotateQuotationPublicTokenAction(
  id: string,
): Promise<{ ok: true; publicToken: string } | { formError: string; ok: false }> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { formError: "รหัสใบเสนอราคาไม่ถูกต้อง", ok: false };
  }
  try {
    const result = await rotateQuotationPublicToken(supabase, id);
    revalidatePath(`/admin/quotations/${encodeURIComponent(id)}`);
    revalidatePath(`/q/${encodeURIComponent(result.publicToken)}`);
    return { ok: true, publicToken: result.publicToken };
  } catch (error) {
    console.error("Failed to rotate quotation public link", error instanceof Error ? error.message : "Unknown error");
    return { formError: "ไม่สามารถรีเซ็ตลิงก์สาธารณะได้ กรุณาลองอีกครั้ง", ok: false };
  }
}

export async function deleteQuotationAction(
  id: string,
): Promise<{ formError: string; ok: false } | { id: string; ok: true }> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { formError: "รหัสใบเสนอราคาไม่ถูกต้อง", ok: false };
  }

  try {
    await softDeleteQuotation(supabase, id);
    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${encodeURIComponent(id)}`);
    return { id, ok: true };
  } catch (error) {
    console.error(
      "Failed to delete quotation",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { formError: "ไม่สามารถลบใบเสนอราคาได้ กรุณาลองอีกครั้ง", ok: false };
  }
}

export async function saveCompanyProfileAction(
  formData: FormData,
): Promise<CompanyProfileActionResult> {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการข้อมูลผู้ขาย", ok: false };
  }

  let uploadedObjectKey: string | null = null;
  try {
    const existing = await getQuotationCompanyProfile(supabase, user.id);
    const value = formData.get("logo");
    const logo = isUploadedFile(value) && value.size > 0 ? validateQuotationAssetFile(value) : null;
    if (logo && logo.type !== "image/webp") throw new Error("Logo must be normalized to WebP");
    let logoUrl = existing?.logo_url ?? "";
    if (logo) {
      const env = await getQuotationAssetRuntimeEnv();
      uploadedObjectKey = buildQuotationAssetObjectKey();
      const body = await validateQuotationUploadedImage(logo, "webp");
      await uploadQuotationAssetObject({ body, contentType: "image/webp", objectKey: uploadedObjectKey, ...env });
      logoUrl = buildQuotationAssetUrl(uploadedObjectKey, env.workerUrl);
    }
    const seller = prepareSellerSnapshot({
      address: formString(formData, "address"), branchNumber: formString(formData, "branchNumber"),
      contactEmail: formString(formData, "contactEmail"), contactName: formString(formData, "contactName"),
      contactPhone: formString(formData, "contactPhone"), email: formString(formData, "email"), logoUrl,
      name: formString(formData, "name"), officeType: formString(formData, "officeType"),
      phone: formString(formData, "phone"), taxId: formString(formData, "taxId"), website: formString(formData, "website"),
    });
    await saveQuotationCompanyProfile(supabase, seller, user.id);
    revalidatePath("/admin/quotations/settings/company");
    return { logoUrl: seller.logoUrl, ok: true };
  } catch (error) {
    if (uploadedObjectKey) {
      // Cleanup newly uploaded quotation logo when the profile row was not saved.
      const env = getQuotationAssetEnv();
      await deleteQuotationAssetObject({ objectKey: uploadedObjectKey, ...env }).catch(() => undefined);
    }
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: Object.fromEntries(Object.entries(error.fieldErrors).map(([key, message]) => [key.replace(/^seller\./, ""), message])), formError: "", ok: false };
    }
    console.error("Failed to save quotation company profile", error instanceof Error ? error.message : "Unknown error");
    return { fieldErrors: {}, formError: "ไม่สามารถบันทึกข้อมูลผู้ขายได้ กรุณาลองอีกครั้ง", ok: false };
  }
}

export async function uploadQuotationPaymentAssetAction(
  formData: FormData,
): Promise<QuotationPaymentAssetActionResult> {
  const { adminUser } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  try {
    const file = formData.get("file");
    if (!isUploadedFile(file)) throw new Error("กรุณาเลือกรูปช่องทางชำระเงิน");
    const normalized = validateNormalizedQuotationPng(file);
    const body = await validateQuotationUploadedImage(normalized, "png");
    const env = await getQuotationAssetRuntimeEnv();
    const objectKey = buildQuotationPaymentAssetObjectKey();
    await uploadQuotationAssetObject({
      body,
      contentType: "image/png",
      objectKey,
      ...env,
    });
    return { ok: true, url: buildQuotationPaymentAssetUrl(objectKey, env.workerUrl) };
  } catch (error) {
    console.error("Failed to upload quotation payment asset", error instanceof Error ? error.message : "Unknown error");
    return { fieldErrors: {}, formError: quotationImageUploadError(error, "ไม่สามารถอัปโหลดรูปช่องทางชำระเงินได้"), ok: false };
  }
}

export async function uploadQuotationCertificationAssetAction(
  formData: FormData,
): Promise<QuotationPaymentAssetActionResult> {
  const { adminUser } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  try {
    const file = formData.get("file");
    if (!isUploadedFile(file)) throw new Error("กรุณาเลือกรูปการรับรอง");
    const normalized = validateNormalizedQuotationPng(file);
    const body = await validateQuotationUploadedImage(normalized, "png");
    const env = await getQuotationAssetRuntimeEnv();
    const objectKey = buildQuotationCertificationAssetObjectKey();
    await uploadQuotationAssetObject({
      body,
      contentType: "image/png",
      objectKey,
      ...env,
    });
    return { ok: true, url: buildQuotationCertificationAssetUrl(objectKey, env.workerUrl) };
  } catch (error) {
    console.error("Failed to upload quotation certification asset", error instanceof Error ? error.message : "Unknown error");
    return {
      fieldErrors: {},
      formError: quotationImageUploadError(error, "ไม่สามารถอัปโหลดรูปการรับรองได้"),
      ok: false,
    };
  }
}

export async function saveCompanyPaymentMethodsAction(
  value: unknown,
): Promise<CompanyPaymentMethodsActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  try {
    const methods = prepareCompanyPaymentMethods(value);
    const fieldErrors = paymentAssetErrors(methods);
    if (Object.keys(fieldErrors).length) return { fieldErrors, formError: "", ok: false };
    await saveCompanyPaymentMethods(supabase, methods);
    revalidatePath("/admin/quotations/settings/company");
    return { ok: true };
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: error.fieldErrors, formError: "", ok: false };
    }
    if (error instanceof QuotationPaymentAssetOriginNotConfiguredError) {
      return missingPaymentAssetOrigin();
    }
    console.error("Failed to save company payment methods", error instanceof Error ? error.message : "Unknown error");
    return { fieldErrors: {}, formError: "ไม่สามารถบันทึกช่องทางชำระเงินได้", ok: false };
  }
}

export async function saveCompanyCertificationAction(
  value: unknown,
): Promise<CompanyPaymentMethodsActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการข้อมูลรับรอง", ok: false };
  }
  try {
    const certification = prepareCertificationSnapshot(value);
    const fieldErrors = certificationAssetErrors(certification);
    if (Object.keys(fieldErrors).length) return { fieldErrors, formError: "", ok: false };
    await saveQuotationCompanyCertification(supabase, certification);
    revalidatePath("/admin/quotations/settings/company");
    return { ok: true };
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: error.fieldErrors, formError: "", ok: false };
    }
    console.error("Failed to save company certification", error instanceof Error ? error.message : "Unknown error");
    return { fieldErrors: {}, formError: "ไม่สามารถบันทึกข้อมูลรับรองได้ กรุณาลองอีกครั้ง", ok: false };
  }
}
