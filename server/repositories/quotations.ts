import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { VatTreatment } from "../../lib/quotation-calculator.ts";
import type {
  CustomerSnapshot,
  QuotationPayload,
  SellerSnapshot,
} from "../../lib/quotation-types.ts";
import type { PreparedQuotation } from "../services/quotations";

export interface QuotationCompanyProfileRow {
  address: string;
  branch_number: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string;
  email: string;
  id: number;
  logo_url: string;
  seller_name: string;
  office_type: "branch" | "head_office";
  phone: string;
  tax_id: string;
  updated_at: string;
  website: string;
}

export interface QuotationListItem {
  customerName: string;
  documentNumber: string;
  grandTotal: string;
  id: string;
  issueDate: string;
  updatedAt: string;
  validUntil: string;
}

export interface QuotationListResult {
  items: QuotationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SavedQuotation {
  documentNumber: string;
  id: string;
  publicToken: string;
}

const quotationSelect = `
  id,document_number,issue_date,valid_until,validity_days,reference,subject,
  seller_snapshot,customer_snapshot,public_token,withholding_tax_rate,
  public_notes,internal_notes,
  quotation_items(
    id,position,name,description,quantity,unit,unit_price,
    discount_amount,vat_treatment,vat_rate
  )
`;

type DatabaseQuotationItem = {
  description: unknown;
  discount_amount: unknown;
  id: unknown;
  name: unknown;
  position: unknown;
  quantity: unknown;
  unit: unknown;
  unit_price: unknown;
  vat_rate: unknown;
  vat_treatment: unknown;
};

type DatabaseQuotationRow = {
  customer_snapshot: unknown;
  id: unknown;
  internal_notes: unknown;
  issue_date: unknown;
  public_notes: unknown;
  public_token: unknown;
  quotation_items: DatabaseQuotationItem[] | null;
  reference: unknown;
  seller_snapshot: unknown;
  subject: unknown;
  valid_until: unknown;
  validity_days: unknown;
  withholding_tax_rate: unknown;
};

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function snapshotString(snapshot: Record<string, unknown>, camel: string, snake: string): string {
  return stringValue(snapshot[camel] ?? snapshot[snake]);
}

function officeType(value: unknown): "branch" | "head_office" {
  return value === "branch" ? "branch" : "head_office";
}

function vatTreatment(value: unknown): VatTreatment {
  return value === "taxable" || value === "exempt" ? value : "none";
}

export function companyProfileToSeller(row: QuotationCompanyProfileRow): SellerSnapshot {
  return {
    address: row.address,
    branchNumber: row.branch_number,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    email: row.email,
    logoUrl: row.logo_url,
    name: row.seller_name,
    officeType: row.office_type,
    phone: row.phone,
    taxId: row.tax_id,
    website: row.website,
  };
}

function sellerSnapshot(value: unknown): SellerSnapshot {
  const snapshot = objectValue(value);
  return {
    address: snapshotString(snapshot, "address", "address"),
    branchNumber: snapshotString(snapshot, "branchNumber", "branch_number"),
    contactEmail: snapshotString(snapshot, "contactEmail", "contact_email"),
    contactName: snapshotString(snapshot, "contactName", "contact_name"),
    contactPhone: snapshotString(snapshot, "contactPhone", "contact_phone"),
    email: snapshotString(snapshot, "email", "email"),
    logoUrl: snapshotString(snapshot, "logoUrl", "logo_url"),
    name: snapshotString(snapshot, "name", "seller_name"),
    officeType: officeType(snapshot.officeType ?? snapshot.office_type),
    phone: snapshotString(snapshot, "phone", "phone"),
    taxId: snapshotString(snapshot, "taxId", "tax_id"),
    website: snapshotString(snapshot, "website", "website"),
  };
}

function customerSnapshot(value: unknown): CustomerSnapshot {
  const snapshot = objectValue(value);
  return {
    address: snapshotString(snapshot, "address", "address"),
    branchNumber: snapshotString(snapshot, "branchNumber", "branch_number"),
    name: snapshotString(snapshot, "name", "customer_name"),
    officeType: officeType(snapshot.officeType ?? snapshot.office_type),
    taxId: snapshotString(snapshot, "taxId", "tax_id"),
  };
}

export function quotationRowToPayload(row: DatabaseQuotationRow): QuotationPayload {
  return {
    customer: customerSnapshot(row.customer_snapshot),
    id: stringValue(row.id),
    internalNotes: stringValue(row.internal_notes),
    issueDate: stringValue(row.issue_date),
    items: (row.quotation_items ?? [])
      .map((item) => ({
        description: stringValue(item.description),
        discountAmount: stringValue(item.discount_amount),
        id: stringValue(item.id),
        name: stringValue(item.name),
        position: Number(item.position),
        quantity: stringValue(item.quantity),
        unit: stringValue(item.unit),
        unitPrice: stringValue(item.unit_price),
        vatRate: stringValue(item.vat_rate),
        vatTreatment: vatTreatment(item.vat_treatment),
      }))
      .sort((left, right) => left.position - right.position),
    paymentMethods: [],
    publicNotes: stringValue(row.public_notes),
    reference: stringValue(row.reference),
    seller: sellerSnapshot(row.seller_snapshot),
    subject: stringValue(row.subject),
    validUntil: stringValue(row.valid_until),
    validityDays: row.validity_days == null ? "" : stringValue(row.validity_days),
    withholdingTaxRate: row.withholding_tax_rate == null ? null : stringValue(row.withholding_tax_rate),
  };
}

export async function getQuotationCompanyProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("quotation_company_profiles")
    .select("id,seller_name,address,tax_id,office_type,branch_number,phone,email,website,contact_name,contact_phone,contact_email,logo_url,updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as QuotationCompanyProfileRow | null;
}

export async function saveQuotationCompanyProfile(
  supabase: SupabaseClient,
  seller: SellerSnapshot,
) {
  const { error } = await supabase.from("quotation_company_profiles").upsert({
    address: seller.address,
    branch_number: seller.branchNumber,
    contact_email: seller.contactEmail,
    contact_name: seller.contactName,
    contact_phone: seller.contactPhone,
    email: seller.email,
    id: 1,
    logo_url: seller.logoUrl,
    seller_name: seller.name,
    office_type: seller.officeType,
    phone: seller.phone,
    tax_id: seller.taxId,
    updated_at: new Date().toISOString(),
    website: seller.website,
  });
  if (error) throw new Error(error.message);
}

export async function listQuotations(
  supabase: SupabaseClient,
  { page, pageSize = 20, search }: { page: number; pageSize?: number; search: string },
): Promise<QuotationListResult> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize) || 20));
  const { data, error } = await supabase.rpc("list_quotations", {
    p_page: safePage,
    p_page_size: safePageSize,
    p_search: search.trim(),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows.map((row) => ({
      customerName: stringValue(row.customer_name),
      documentNumber: stringValue(row.document_number),
      grandTotal: stringValue(row.grand_total ?? "0.00"),
      id: stringValue(row.id),
      issueDate: stringValue(row.issue_date),
      updatedAt: stringValue(row.updated_at),
      validUntil: stringValue(row.valid_until),
    })),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

export async function getQuotationById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ documentNumber: string; payload: QuotationPayload; publicToken: string } | null> {
  const { data, error } = await supabase
    .from("quotations")
    .select(quotationSelect)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as DatabaseQuotationRow & { document_number: unknown };
  return {
    documentNumber: stringValue(row.document_number),
    payload: quotationRowToPayload(row),
    publicToken: stringValue(row.public_token),
  };
}

export async function getPublicQuotationByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ documentNumber: string; payload: QuotationPayload } | null> {
  const { data, error } = await supabase.rpc("get_public_quotation", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as DatabaseQuotationRow & { document_number: unknown };
  return {
    documentNumber: stringValue(row.document_number),
    payload: quotationRowToPayload({ ...row, internal_notes: "" }),
  };
}

export async function saveQuotation(
  supabase: SupabaseClient,
  rpcPayload: PreparedQuotation["rpcPayload"],
): Promise<SavedQuotation> {
  const { data, error } = await supabase.rpc("save_quotation", { p_payload: rpcPayload });
  if (error) throw new Error(error.message);
  const row = (data as Array<{ document_number: string; id: string }> | null)?.[0];
  if (!row) throw new Error("Quotation save returned no row");
  const { data: saved, error: tokenError } = await supabase
    .from("quotations")
    .select("public_token")
    .eq("id", row.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (tokenError) throw new Error(tokenError.message);
  const publicToken = stringValue((saved as { public_token?: unknown } | null)?.public_token);
  if (!publicToken) throw new Error("Quotation save returned no public token");
  return { documentNumber: row.document_number, id: row.id, publicToken };
}

export async function softDeleteQuotation(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.rpc("soft_delete_quotation", { p_id: id });
  if (error) throw new Error(error.message);
  return String(data);
}
