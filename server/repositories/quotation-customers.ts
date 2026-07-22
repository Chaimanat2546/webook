import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DbdCustomerDefaults,
  QuotationCustomerInput,
  QuotationCustomerMaster,
  QuotationCustomerType,
} from "../../lib/quotation-customer-types.ts";
import type { OfficeType } from "../../lib/quotation-types.ts";

export interface QuotationCustomerListResult {
  items: QuotationCustomerMaster[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class QuotationCustomerDuplicateError extends Error {
  readonly customer: QuotationCustomerMaster;

  constructor(customer: QuotationCustomerMaster) {
    super("quotation_customer_duplicate");
    this.name = "QuotationCustomerDuplicateError";
    this.customer = customer;
  }
}

function rowObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("quotation_customer_invalid_row");
  }
  return value as Record<string, unknown>;
}

function stringField(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== "string") throw new Error("quotation_customer_invalid_row");
  return row[key];
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  if (row[key] === null) return null;
  return stringField(row, key);
}

function customerRow(value: unknown): QuotationCustomerMaster {
  const row = rowObject(value);
  const customerType = stringField(row, "customer_type");
  const officeType = stringField(row, "office_type");
  if (!(["juristic", "individual"] as string[]).includes(customerType)) {
    throw new Error("quotation_customer_invalid_row");
  }
  if (!(["branch", "head_office", "unspecified"] as string[]).includes(officeType)) {
    throw new Error("quotation_customer_invalid_row");
  }
  if (typeof row.is_active !== "boolean") throw new Error("quotation_customer_invalid_row");
  return {
    address: stringField(row, "address"),
    branchNumber: stringField(row, "branch_number"),
    contactEmail: stringField(row, "contact_email"),
    contactName: stringField(row, "contact_name"),
    contactPhone: stringField(row, "contact_phone"),
    customerType: customerType as QuotationCustomerType,
    dbdAddress: nullableString(row, "dbd_address"),
    dbdName: nullableString(row, "dbd_name"),
    dbdStatus: nullableString(row, "dbd_status"),
    dbdVerifiedAt: nullableString(row, "dbd_verified_at"),
    id: stringField(row, "id"),
    isActive: row.is_active,
    name: stringField(row, "name"),
    officeType: officeType as OfficeType,
    taxId: stringField(row, "tax_id"),
    updatedAt: stringField(row, "updated_at"),
  };
}

function writeValues(input: QuotationCustomerInput) {
  return {
    address: input.address,
    branch_number: input.branchNumber,
    contact_email: input.contactEmail,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    customer_type: input.customerType,
    name: input.name,
    office_type: input.officeType,
    tax_id: input.taxId,
  };
}

function totalValue(value: unknown): number {
  const total = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(total) && total >= 0 ? total : 0;
}

export async function listQuotationCustomers(
  supabase: SupabaseClient,
  options: { active: boolean; page: number; pageSize: number; search: string },
): Promise<QuotationCustomerListResult> {
  const page = Math.max(1, Math.trunc(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize) || 20));
  const { data, error } = await supabase.rpc("list_quotation_customers", {
    p_active: options.active,
    p_page: page,
    p_page_size: pageSize,
    p_search: options.search.trim(),
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const total = rows.length ? totalValue(rowObject(rows[0]).total_count) : 0;
  return {
    items: rows.map(customerRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getQuotationCustomer(
  supabase: SupabaseClient,
  id: string,
): Promise<QuotationCustomerMaster | null> {
  const { data, error } = await supabase.from("quotation_customers")
    .select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? customerRow(data) : null;
}

export async function findQuotationCustomerByTaxId(
  supabase: SupabaseClient,
  taxId: string,
): Promise<QuotationCustomerMaster | null> {
  const { data, error } = await supabase.from("quotation_customers")
    .select("*").eq("tax_id", taxId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? customerRow(data) : null;
}

async function throwWriteError(
  supabase: SupabaseClient,
  taxId: string,
  error: { code?: string; message: string },
): Promise<never> {
  if (error.code === "23505") {
    const existing = await findQuotationCustomerByTaxId(supabase, taxId);
    if (existing) throw new QuotationCustomerDuplicateError(existing);
  }
  throw new Error(error.message);
}

export async function insertQuotationCustomer(
  supabase: SupabaseClient,
  input: QuotationCustomerInput,
  defaults: DbdCustomerDefaults | null,
): Promise<QuotationCustomerMaster> {
  const dbd = input.customerType === "juristic" && defaults
    ? {
        dbd_address: defaults.address,
        dbd_name: defaults.name,
        dbd_status: defaults.status,
        dbd_verified_at: defaults.verifiedAt,
      }
    : { dbd_address: null, dbd_name: null, dbd_status: null, dbd_verified_at: null };
  const { data, error } = await supabase.from("quotation_customers")
    .insert({ ...writeValues(input), ...dbd }).select("*").single();
  if (error) return throwWriteError(supabase, input.taxId, error);
  return customerRow(data);
}

export async function updateQuotationCustomer(
  supabase: SupabaseClient,
  input: QuotationCustomerInput,
): Promise<QuotationCustomerMaster> {
  if (!input.id) throw new Error("quotation_customer_id_required");
  const values = input.customerType === "individual"
    ? {
        ...writeValues(input),
        dbd_address: null,
        dbd_name: null,
        dbd_status: null,
        dbd_verified_at: null,
      }
    : writeValues(input);
  const { data, error } = await supabase.from("quotation_customers")
    .update(values).eq("id", input.id).select("*").single();
  if (error) return throwWriteError(supabase, input.taxId, error);
  return customerRow(data);
}

export async function updateQuotationCustomerDbd(
  supabase: SupabaseClient,
  id: string,
  defaults: DbdCustomerDefaults,
): Promise<QuotationCustomerMaster> {
  const { data, error } = await supabase.from("quotation_customers").update({
    dbd_address: defaults.address,
    dbd_name: defaults.name,
    dbd_status: defaults.status,
    dbd_verified_at: defaults.verifiedAt,
  }).eq("id", id).eq("customer_type", "juristic").eq("tax_id", defaults.taxId)
    .select("*").single();
  if (error) throw new Error(error.message);
  return customerRow(data);
}

export async function setQuotationCustomerActive(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
): Promise<QuotationCustomerMaster> {
  const { data, error } = await supabase.from("quotation_customers")
    .update({ is_active: isActive }).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return customerRow(data);
}
