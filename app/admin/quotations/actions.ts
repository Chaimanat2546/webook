"use server";

import { revalidatePath } from "next/cache";

import {
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
  validateQuotationAssetFile,
  validateQuotationAssetUrl,
} from "../../../lib/quotation-assets";
import { getQuotationAssetEnv } from "../../../lib/env";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";
import {
  getQuotationCompanyProfile,
  saveQuotation,
  saveQuotationCompanyProfile,
  softDeleteQuotation,
} from "../../../server/repositories/quotations";
import {
  prepareSellerSnapshot,
  prepareQuotationPayload,
  QuotationValidationError,
} from "../../../server/services/quotations";
import {
  deleteQuotationAssetObject,
  uploadQuotationAssetObject,
} from "../../../server/storage/quotation-assets";

export type QuotationActionResult =
  | { documentNumber: string; id: string; ok: true; publicToken: string }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

export type CompanyProfileActionResult =
  | { logoUrl: string; ok: true }
  | { fieldErrors: Record<string, string>; formError: string; ok: false };

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

export async function saveQuotationAction(value: unknown): Promise<QuotationActionResult> {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return denied();

  try {
    const prepared = prepareQuotationPayload(value);
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
    const saved = await saveQuotation(supabase, prepared.rpcPayload);
    revalidatePath("/admin/quotations");
    revalidatePath(`/admin/quotations/${encodeURIComponent(saved.id)}`);
    revalidatePath(`/q/${encodeURIComponent(saved.publicToken)}`);
    return { ...saved, ok: true };
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      return { fieldErrors: error.fieldErrors, formError: "", ok: false };
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
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) {
    return { fieldErrors: {}, formError: "ไม่มีสิทธิ์จัดการข้อมูลผู้ขาย", ok: false };
  }

  let uploadedObjectKey: string | null = null;
  try {
    const existing = await getQuotationCompanyProfile(supabase);
    const value = formData.get("logo");
    const logo = value instanceof File && value.size > 0 ? validateQuotationAssetFile(value) : null;
    if (logo && logo.type !== "image/webp") throw new Error("Logo must be normalized to WebP");
    let logoUrl = existing?.logo_url ?? "";
    if (logo) {
      const env = getQuotationAssetEnv();
      uploadedObjectKey = buildQuotationAssetObjectKey();
      await uploadQuotationAssetObject({ body: await logo.arrayBuffer(), objectKey: uploadedObjectKey, ...env });
      logoUrl = buildQuotationAssetUrl(uploadedObjectKey, env.workerUrl);
    }
    const seller = prepareSellerSnapshot({
      address: formString(formData, "address"), branchNumber: formString(formData, "branchNumber"),
      contactEmail: formString(formData, "contactEmail"), contactName: formString(formData, "contactName"),
      contactPhone: formString(formData, "contactPhone"), email: formString(formData, "email"), logoUrl,
      name: formString(formData, "name"), officeType: formString(formData, "officeType"),
      phone: formString(formData, "phone"), taxId: formString(formData, "taxId"), website: formString(formData, "website"),
    });
    await saveQuotationCompanyProfile(supabase, seller);
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
