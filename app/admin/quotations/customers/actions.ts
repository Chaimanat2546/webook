"use server";

import { revalidatePath } from "next/cache";

import type {
  CustomerMutationResult,
  DbdLookupActionResult,
  QuotationCustomerMaster,
} from "../../../../lib/quotation-customer-types.ts";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin.ts";
import {
  findQuotationCustomerByTaxId,
  getQuotationCustomer,
  insertQuotationCustomer,
  listQuotationCustomers,
  QuotationCustomerDuplicateError,
  setQuotationCustomerActive,
  updateQuotationCustomer,
  updateQuotationCustomerDbd,
} from "../../../../server/repositories/quotation-customers.ts";
import { lookupDbdJuristicPerson } from "../../../../server/services/dbd-juristic-person.ts";
import { prepareQuotationCustomerInput } from "../../../../server/services/quotation-customers.ts";
import { QuotationValidationError } from "../../../../server/services/quotations.ts";

const TAX_ID = /^[0-9]{13}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireQuotationAccess() {
  const context = await requireAdmin();
  if (!canUseQuotation(context.adminUser)) throw new Error("quotation_access_denied");
  return context;
}

function failed(formError: string, fieldErrors: Record<string, string> = {}): CustomerMutationResult {
  return { fieldErrors, formError, ok: false };
}

function duplicate(customer: QuotationCustomerMaster): CustomerMutationResult {
  return {
    existingCustomer: customer,
    fieldErrors: { taxId: "เลขประจำตัวผู้เสียภาษีนี้มีอยู่แล้ว" },
    formError: customer.isActive
      ? "พบลูกค้านี้ใน Master แล้ว กรุณาตรวจสอบรายการเดิม"
      : "พบลูกค้านี้ใน Master ที่ปิดใช้งาน กรุณาตรวจสอบและเปิดใช้งานรายการเดิม",
    ok: false,
  };
}

function logFailure(operation: string, error: unknown): void {
  console.error(operation, error instanceof Error ? error.message : "unknown_error");
}

export async function lookupQuotationCustomerDbdAction(
  taxId: string,
): Promise<DbdLookupActionResult> {
  await requireQuotationAccess();
  const normalized = taxId.trim();
  if (!TAX_ID.test(normalized)) {
    return { formError: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก", ok: false, reason: "not_found" };
  }
  const result = await lookupDbdJuristicPerson(normalized);
  if (result.ok) return result;
  return {
    formError: result.reason === "not_found"
      ? "ไม่พบข้อมูลนิติบุคคลใน DBD"
      : "ไม่สามารถเชื่อมต่อ DBD ได้ กรุณาลองอีกครั้ง",
    ok: false,
    reason: result.reason,
  };
}

export async function saveQuotationCustomerAction(value: unknown): Promise<CustomerMutationResult> {
  const { supabase } = await requireQuotationAccess();
  try {
    const prepared = prepareQuotationCustomerInput(value);
    const existing = await findQuotationCustomerByTaxId(supabase, prepared.taxId);

    if (prepared.id) {
      const stored = await getQuotationCustomer(supabase, prepared.id);
      if (!stored) return failed("ไม่พบข้อมูลลูกค้า");
      if (prepared.taxId !== stored.taxId || prepared.customerType !== stored.customerType) {
        return failed("", {
          customerType: "ไม่สามารถเปลี่ยนประเภทลูกค้าหลังสร้าง Master แล้ว",
          taxId: "ไม่สามารถเปลี่ยนเลขประจำตัวผู้เสียภาษีหลังสร้าง Master แล้ว",
        });
      }
      const customer = await updateQuotationCustomer(supabase, prepared);
      revalidatePath("/admin/quotations/customers");
      return { customer, ok: true };
    }
    if (existing) return duplicate(existing);

    let defaults = null;
    if (prepared.customerType === "juristic" && !prepared.saveUnverified) {
      const lookup = await lookupDbdJuristicPerson(prepared.taxId);
      if (!lookup.ok) {
        return {
          fieldErrors: {},
          formError: lookup.reason === "not_found"
            ? "ไม่พบข้อมูลนิติบุคคลใน DBD"
            : "ไม่สามารถเชื่อมต่อ DBD ได้",
          ok: false,
          requiresUnverifiedConfirmation: true,
        };
      }
      defaults = lookup.defaults;
    }
    const customer = await insertQuotationCustomer(supabase, prepared, defaults);
    revalidatePath("/admin/quotations/customers");
    return { customer, ok: true };
  } catch (error) {
    if (error instanceof QuotationValidationError) return failed("", error.fieldErrors);
    if (error instanceof QuotationCustomerDuplicateError) return duplicate(error.customer);
    logFailure("quotation_customer_save_failed", error);
    return failed("ไม่สามารถบันทึกลูกค้าได้ กรุณาลองอีกครั้ง");
  }
}

export async function refreshQuotationCustomerDbdAction(id: string): Promise<CustomerMutationResult> {
  const { supabase } = await requireQuotationAccess();
  if (!UUID.test(id)) return failed("รหัสลูกค้าไม่ถูกต้อง");
  try {
    const stored = await getQuotationCustomer(supabase, id);
    if (!stored) return failed("ไม่พบข้อมูลลูกค้า");
    if (stored.customerType !== "juristic") return failed("ลูกค้าบุคคลธรรมดาไม่ใช้ข้อมูล DBD");
    const lookup = await lookupDbdJuristicPerson(stored.taxId);
    if (!lookup.ok) {
      return failed(lookup.reason === "not_found"
        ? "ไม่พบข้อมูลนิติบุคคลใน DBD"
        : "ไม่สามารถเชื่อมต่อ DBD ได้ กรุณาลองอีกครั้ง");
    }
    const customer = await updateQuotationCustomerDbd(supabase, id, lookup.defaults);
    revalidatePath("/admin/quotations/customers");
    return { customer, ok: true };
  } catch (error) {
    logFailure("quotation_customer_dbd_refresh_failed", error);
    return failed("ไม่สามารถอัปเดตข้อมูล DBD ได้ กรุณาลองอีกครั้ง");
  }
}

export async function setQuotationCustomerActiveAction(
  id: string,
  isActive: boolean,
): Promise<CustomerMutationResult> {
  const { supabase } = await requireQuotationAccess();
  if (!UUID.test(id) || typeof isActive !== "boolean") return failed("ข้อมูลลูกค้าไม่ถูกต้อง");
  try {
    const customer = await setQuotationCustomerActive(supabase, id, isActive);
    revalidatePath("/admin/quotations/customers");
    return { customer, ok: true };
  } catch (error) {
    logFailure("quotation_customer_active_failed", error);
    return failed("ไม่สามารถเปลี่ยนสถานะลูกค้าได้ กรุณาลองอีกครั้ง");
  }
}

export async function searchActiveQuotationCustomersAction(
  search: string,
): Promise<QuotationCustomerMaster[]> {
  const { supabase } = await requireQuotationAccess();
  try {
    return (await listQuotationCustomers(supabase, {
      active: true,
      page: 1,
      pageSize: 50,
      search: typeof search === "string" ? search : "",
    })).items;
  } catch (error) {
    logFailure("quotation_customer_search_failed", error);
    return [];
  }
}
