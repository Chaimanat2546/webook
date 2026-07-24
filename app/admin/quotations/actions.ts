"use server";

import { revalidatePath } from "next/cache";

import {
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
  buildQuotationCertificationAssetObjectKey,
  buildQuotationCertificationAssetUrl,
  buildQuotationPaymentAssetObjectKey,
  buildQuotationPaymentAssetUrl,
  validateQuotationAssetFile,
  validateQuotationAssetUrl,
  validateQuotationCertificationAssetFile,
  validateQuotationCertificationAssetUrl,
  validateQuotationPaymentAssetFile,
  validateQuotationPaymentAssetUrl,
} from "../../../lib/quotation-assets";
import type { QuotationPayload } from "../../../lib/quotation-types";
import { isQuotationDocumentDisplay } from "../../../lib/quotation-document-display";
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
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { formError: "ไม่มีสิทธิ์จัดการใบเสนอราคา", ok: false };
  }
  if (!isQuotationDocumentDisplay(value)) {
    return { formError: "รูปแบบเอกสารไม่ถูกต้อง", ok: false };
  }
  try {
    await saveQuotationDocumentDisplayDefaults(supabase, value);
    return { ok: true };
  } catch {
    return { formError: "ไม่สามารถบันทึกค่าเริ่มต้นรูปแบบเอกสารได้", ok: false };
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
    const logo = value instanceof File && value.size > 0 ? validateQuotationAssetFile(value) : null;
    if (logo && logo.type !== "image/webp") throw new Error("Logo must be normalized to WebP");
    let logoUrl = existing?.logo_url ?? "";
    if (logo) {
      const env = getQuotationAssetEnv();
      uploadedObjectKey = buildQuotationAssetObjectKey();
      await uploadQuotationAssetObject({ body: await logo.arrayBuffer(), contentType: "image/webp", objectKey: uploadedObjectKey, ...env });
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
    if (!(file instanceof File)) throw new Error("กรุณาเลือกรูปช่องทางชำระเงิน");
    validateQuotationPaymentAssetFile(file);
    if (file.type !== "image/png") throw new Error("Payment image must be normalized to PNG");
    const env = getQuotationAssetEnv();
    const objectKey = buildQuotationPaymentAssetObjectKey();
    await uploadQuotationAssetObject({
      body: await file.arrayBuffer(),
      contentType: "image/png",
      objectKey,
      ...env,
    });
    return { ok: true, url: buildQuotationPaymentAssetUrl(objectKey, env.workerUrl) };
  } catch (error) {
    console.error("Failed to upload quotation payment asset", error instanceof Error ? error.message : "Unknown error");
    return { fieldErrors: {}, formError: error instanceof Error && error.message.includes("2 MB") ? error.message : "ไม่สามารถอัปโหลดรูปช่องทางชำระเงินได้", ok: false };
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
    if (!(file instanceof File)) throw new Error("กรุณาเลือกรูปการรับรอง");
    validateQuotationCertificationAssetFile(file);
    if (file.type !== "image/png") throw new Error("Certification image must be normalized to PNG");
    const env = getQuotationAssetEnv();
    const objectKey = buildQuotationCertificationAssetObjectKey();
    await uploadQuotationAssetObject({
      body: await file.arrayBuffer(),
      contentType: "image/png",
      objectKey,
      ...env,
    });
    return { ok: true, url: buildQuotationCertificationAssetUrl(objectKey, env.workerUrl) };
  } catch (error) {
    console.error("Failed to upload quotation certification asset", error instanceof Error ? error.message : "Unknown error");
    return {
      fieldErrors: {},
      formError: error instanceof Error && error.message.includes("2 MB")
        ? error.message
        : "ไม่สามารถอัปโหลดรูปการรับรองได้",
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
