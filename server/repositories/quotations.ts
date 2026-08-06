import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { VatTreatment } from "../../lib/quotation-calculator.ts";
import {
  certificationSnapshotToJson,
  type CertificationSnapshot,
} from "../../lib/quotation-certification.ts";
import type {
  BankOption,
  CompanyPaymentMethod,
  PaymentAccountType,
  PaymentMethodType,
  PaymentQrMode,
} from "../../lib/quotation-payment-methods.ts";
import type {
  CustomerSnapshot,
  OfficeType,
  QuotationPayload,
  SellerSnapshot,
} from "../../lib/quotation-types.ts";
import {
  normalizeQuotationTemplate,
  type QuotationTemplate,
} from "../../lib/quotation-template.ts";
import {
  normalizeQuotationLayout,
  QUOTATION_LAYOUT_SCHEMA_VERSION,
  type QuotationLayoutSnapshot,
} from "../../lib/quotation-layout.ts";
import type { PreparedQuotation } from "../services/quotations";
import {
  normalizeQuotationDocumentDisplay,
  type QuotationDocumentDisplay,
} from "../../lib/quotation-document-display.ts";
import { quotationPersistenceError } from "./quotation-errors";

export interface QuotationCompanyProfileRow {
  address: string;
  approver_name: string | null;
  approver_position: string | null;
  approver_signature_url: string | null;
  branch_number: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string;
  document_template_default: unknown;
  document_display_defaults: unknown;
  company_stamp_url: string | null;
  email: string;
  id: string;
  issuer_name: string | null;
  issuer_position: string | null;
  issuer_signature_url: string | null;
  logo_url: string;
  seller_name: string;
  office_type: OfficeType;
  phone: string;
  tax_id: string;
  updated_at: string;
  user_id: string;
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
  certification_snapshot,document_display_snapshot,document_template_snapshot,
  document_template_source_id,document_template_revision_snapshot,
  document_layout_schema_version_snapshot,document_layout_snapshot,
  public_notes,internal_notes,
  quotation_items(
    id,position,name,description,quantity,unit,unit_price,
    discount_amount,vat_treatment,vat_rate
  ),
  quotation_payment_methods(
    id,type,bank_code,bank_name,bank_logo_url,custom_bank_name,
    custom_bank_logo_url,account_number,account_name,account_type,promptpay_id,
    provider_name,instructions,qr_mode,qr_image_url,position
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

type DatabaseQuotationPaymentMethod = {
  account_name: unknown;
  account_number: unknown;
  account_type: unknown;
  bank_code: unknown;
  bank_logo_url: unknown;
  bank_name: unknown;
  custom_bank_logo_url: unknown;
  custom_bank_name: unknown;
  id: unknown;
  instructions: unknown;
  position: unknown;
  promptpay_id: unknown;
  provider_name: unknown;
  qr_image_url: unknown;
  qr_mode: unknown;
  type: unknown;
};

type DatabaseQuotationRow = {
  certification_snapshot: unknown;
  document_display_snapshot: unknown;
  document_layout_schema_version_snapshot: unknown;
  document_layout_snapshot: unknown;
  document_template_revision_snapshot: unknown;
  document_template_snapshot: unknown;
  document_template_source_id: unknown;
  customer_snapshot: unknown;
  id: unknown;
  internal_notes: unknown;
  issue_date: unknown;
  public_notes: unknown;
  public_token: unknown;
  quotation_items: DatabaseQuotationItem[] | null;
  quotation_payment_methods: DatabaseQuotationPaymentMethod[] | null;
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

function officeType(value: unknown): OfficeType {
  if (value === "branch" || value === "unspecified") return value;
  return "head_office";
}

function vatTreatment(value: unknown): VatTreatment {
  return value === "taxable" || value === "exempt" ? value : "none";
}

function paymentMethodType(value: unknown): PaymentMethodType {
  return value === "promptpay" || value === "qr_payment" || value === "cash" || value === "other"
    ? value
    : "bank_transfer";
}

function paymentQrMode(value: unknown): PaymentQrMode {
  return value === "upload" || value === "auto_promptpay" ? value : "none";
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

export function companyProfileToCertification(
  row: QuotationCompanyProfileRow,
): CertificationSnapshot {
  return {
    approver: {
      name: stringValue(row.approver_name),
      position: stringValue(row.approver_position),
      signatureUrl: stringValue(row.approver_signature_url),
    },
    companyStampUrl: stringValue(row.company_stamp_url),
    issuer: {
      name: stringValue(row.issuer_name),
      position: stringValue(row.issuer_position),
      signatureUrl: stringValue(row.issuer_signature_url),
    },
  };
}

export interface QuotationDocumentTemplateSnapshot {
  config: QuotationLayoutSnapshot["config"];
  revisionNumber: number;
  schemaVersion: number;
  sourceId: string;
  template: QuotationTemplate;
}

export interface QuotationDocumentTemplateRevision {
  config: QuotationLayoutSnapshot["config"];
  createdAt: string;
  revisionNumber: number;
  schemaVersion: number;
}

export function companyProfileToTemplate(
  row: QuotationCompanyProfileRow,
): QuotationTemplate {
  return normalizeQuotationTemplate(row.document_template_default);
}

export async function listQuotationDocumentTemplateSnapshots(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<QuotationTemplate, QuotationDocumentTemplateSnapshot>> {
  const { data: templates, error: templatesError } = await supabase
    .from("quotation_document_templates")
    .select("id,template_key,current_revision_number")
    .eq("user_id", userId);
  if (templatesError) throw new Error(templatesError.message);
  const ids = (templates ?? []).map((template) => stringValue(template.id)).filter(Boolean);
  const { data: revisions, error: revisionsError } = ids.length
    ? await supabase
      .from("quotation_document_template_revisions")
      .select("template_id,revision_number,layout_schema_version,layout_config")
      .in("template_id", ids)
    : { data: [], error: null };
  if (revisionsError) throw new Error(revisionsError.message);

  const snapshots = {} as Record<QuotationTemplate, QuotationDocumentTemplateSnapshot>;
  for (const template of templates ?? []) {
    const key = normalizeQuotationTemplate(template.template_key);
    const currentRevision = Number(template.current_revision_number);
    const revision = (revisions ?? []).find((item) => stringValue(item.template_id) === stringValue(template.id)
      && Number(item.revision_number) === currentRevision);
    if (!revision) throw new Error("Current quotation layout revision not found");
    snapshots[key] = {
      config: normalizeQuotationLayout(revision.layout_config, key),
      revisionNumber: currentRevision,
      schemaVersion: Number(revision.layout_schema_version),
      sourceId: stringValue(template.id),
      template: key,
    };
  }
  for (const template of ["current", "hospitality", "corporate"] as const) {
    if (!snapshots[template]) throw new Error("Quotation layout template not provisioned");
  }
  return snapshots;
}

export async function listQuotationDocumentTemplateRevisions(
  supabase: SupabaseClient,
  sourceId: string,
  template: QuotationTemplate,
): Promise<QuotationDocumentTemplateRevision[]> {
  const { data, error } = await supabase
    .from("quotation_document_template_revisions")
    .select("revision_number,layout_schema_version,layout_config,created_at")
    .eq("template_id", sourceId)
    .order("revision_number", { ascending: false })
    .limit(2);
  if (error) throw new Error(error.message);
  return (data ?? []).map((revision) => ({
    config: normalizeQuotationLayout(revision.layout_config, template),
    createdAt: stringValue(revision.created_at),
    revisionNumber: Number(revision.revision_number),
    schemaVersion: Number(revision.layout_schema_version),
  }));
}

export async function publishQuotationDocumentTemplateLayout(
  supabase: SupabaseClient,
  template: QuotationTemplate,
  expectedRevisionNumber: number,
  config: QuotationLayoutSnapshot["config"],
): Promise<QuotationDocumentTemplateSnapshot> {
  const { data, error } = await supabase.rpc("publish_quotation_document_template_layout", {
    p_expected_revision_number: expectedRevisionNumber,
    p_layout_config: config,
    p_template_key: template,
  });
  if (error) throw quotationPersistenceError(error);
  const row = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!row) throw new Error("Quotation layout publication returned no revision");
  const revisionNumber = Number(row.revision_number);
  const sourceId = stringValue(row.template_id);
  if (!sourceId || !Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error("Quotation layout publication returned invalid revision");
  }
  return {
    config: normalizeQuotationLayout(row.layout_config, template),
    revisionNumber,
    schemaVersion: QUOTATION_LAYOUT_SCHEMA_VERSION,
    sourceId,
    template,
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

function certificationSnapshot(value: unknown): CertificationSnapshot {
  const snapshot = objectValue(value);
  const signer = (key: "approver" | "issuer") => {
    const row = objectValue(snapshot[key]);
    return {
      name: stringValue(row.name),
      position: stringValue(row.position),
      signatureUrl: stringValue(row.signature_url),
    };
  };
  return {
    approver: signer("approver"),
    companyStampUrl: stringValue(snapshot.company_stamp_url),
    issuer: signer("issuer"),
  };
}

function layoutSnapshot(row: DatabaseQuotationRow, template: QuotationTemplate): QuotationLayoutSnapshot {
  const revisionNumber = Number(row.document_template_revision_snapshot);
  const schemaVersion = Number(row.document_layout_schema_version_snapshot);
  return {
    config: normalizeQuotationLayout(row.document_layout_snapshot, template),
    revisionNumber: Number.isSafeInteger(revisionNumber) && revisionNumber > 0 ? revisionNumber : 1,
    schemaVersion: Number.isSafeInteger(schemaVersion) && schemaVersion > 0 ? schemaVersion : 1,
    sourceId: stringValue(row.document_template_source_id),
  };
}

export function quotationRowToPayload(row: DatabaseQuotationRow): QuotationPayload {
  const template = normalizeQuotationTemplate(row.document_template_snapshot);
  return {
    certification: certificationSnapshot(row.certification_snapshot),
    documentDisplay: normalizeQuotationDocumentDisplay(row.document_display_snapshot),
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
    paymentMethods: (row.quotation_payment_methods ?? [])
      .map((method) => ({
        accountName: stringValue(method.account_name),
        accountNumber: stringValue(method.account_number),
        accountType: stringValue(method.account_type) as PaymentAccountType,
        bankCode: stringValue(method.bank_code),
        bankId: null,
        bankLogoUrl: stringValue(method.bank_logo_url),
        bankName: stringValue(method.bank_name),
        customBankLogoUrl: stringValue(method.custom_bank_logo_url),
        customBankName: stringValue(method.custom_bank_name),
        id: stringValue(method.id),
        instructions: stringValue(method.instructions),
        position: Number(method.position),
        promptPayId: stringValue(method.promptpay_id),
        providerName: stringValue(method.provider_name),
        qrImageUrl: stringValue(method.qr_image_url),
        qrMode: paymentQrMode(method.qr_mode),
        type: paymentMethodType(method.type),
      }))
      .sort((left, right) => left.position - right.position),
    publicNotes: stringValue(row.public_notes),
    reference: stringValue(row.reference),
    layout: layoutSnapshot(row, template),
    seller: sellerSnapshot(row.seller_snapshot),
    subject: stringValue(row.subject),
    template,
    validUntil: stringValue(row.valid_until),
    validityDays: row.validity_days == null ? "" : stringValue(row.validity_days),
    withholdingTaxRate: row.withholding_tax_rate == null ? null : stringValue(row.withholding_tax_rate),
  };
}

export async function getQuotationCompanyProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("quotation_company_profiles")
    .select("id,user_id,seller_name,address,tax_id,office_type,branch_number,phone,email,website,contact_name,contact_phone,contact_email,logo_url,issuer_name,issuer_position,issuer_signature_url,approver_name,approver_position,approver_signature_url,company_stamp_url,document_display_defaults,document_template_default,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as QuotationCompanyProfileRow | null;
}

export function companyProfileToDocumentDisplay(
  row: QuotationCompanyProfileRow,
): QuotationDocumentDisplay {
  return normalizeQuotationDocumentDisplay(row.document_display_defaults);
}

export async function saveQuotationDocumentDisplayDefaults(
  supabase: SupabaseClient,
  value: QuotationDocumentDisplay,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("quotation_company_profiles")
    .update({ document_display_defaults: value, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function saveQuotationTemplateDefault(
  supabase: SupabaseClient,
  value: QuotationTemplate,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("quotation_company_profiles")
    .update({ document_template_default: value, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function saveQuotationCompanyProfile(
  supabase: SupabaseClient,
  seller: SellerSnapshot,
  userId: string,
) {
  const { error } = await supabase.from("quotation_company_profiles").upsert({
    address: seller.address,
    branch_number: seller.branchNumber,
    contact_email: seller.contactEmail,
    contact_name: seller.contactName,
    contact_phone: seller.contactPhone,
    email: seller.email,
    logo_url: seller.logoUrl,
    seller_name: seller.name,
    office_type: seller.officeType,
    phone: seller.phone,
    tax_id: seller.taxId,
    updated_at: new Date().toISOString(),
    user_id: userId,
    website: seller.website,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function saveQuotationCompanyCertification(
  supabase: SupabaseClient,
  certification: CertificationSnapshot,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "save_quotation_company_certification",
    { p_value: certificationSnapshotToJson(certification) },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quotation company profile not found");
}

export async function listQuotationItemNames(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("quotation_item_catalog")
    .select("name")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => stringValue(item.name));
}

export async function listQuotationBanks(supabase: SupabaseClient): Promise<BankOption[]> {
  const { data, error } = await supabase
    .from("banks")
    .select("id,code,name,logo_path,sort_order")
    .not("code", "is", null)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((bank) => ({
    code: stringValue(bank.code),
    id: stringValue(bank.id),
    logoUrl: stringValue(bank.logo_path),
    name: stringValue(bank.name),
  }));
}

export async function listCompanyPaymentMethods(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompanyPaymentMethod[]> {
  const { data, error } = await supabase
    .from("quotation_company_payment_methods")
    .select("id,type,bank_id,custom_bank_name,custom_bank_logo_url,account_number,account_name,account_type,promptpay_id,provider_name,instructions,qr_mode,qr_image_url,is_default,position,banks(code,name,logo_path)")
    .eq("user_id", userId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((method) => {
    const bank = method.banks as { code?: unknown; logo_path?: unknown; name?: unknown } | null;
    return {
      accountName: stringValue(method.account_name),
      accountNumber: stringValue(method.account_number),
      accountType: stringValue(method.account_type) as PaymentAccountType,
      bankCode: stringValue(bank?.code),
      bankId: method.bank_id == null ? null : stringValue(method.bank_id),
      bankLogoUrl: stringValue(bank?.logo_path),
      bankName: stringValue(bank?.name),
      customBankLogoUrl: stringValue(method.custom_bank_logo_url),
      customBankName: stringValue(method.custom_bank_name),
      id: stringValue(method.id),
      instructions: stringValue(method.instructions),
      isDefault: method.is_default === true,
      position: Number(method.position),
      promptPayId: stringValue(method.promptpay_id),
      providerName: stringValue(method.provider_name),
      qrImageUrl: stringValue(method.qr_image_url),
      qrMode: paymentQrMode(method.qr_mode),
      type: paymentMethodType(method.type),
    };
  });
}

export async function saveCompanyPaymentMethods(
  supabase: SupabaseClient,
  methods: CompanyPaymentMethod[],
): Promise<void> {
  const { error } = await supabase.rpc("save_quotation_company_payment_methods", {
    p_methods: methods.map((method) => ({
      account_name: method.accountName,
      account_number: method.accountNumber,
      account_type: method.accountType,
      bank_id: method.bankId,
      custom_bank_logo_url: method.customBankLogoUrl,
      custom_bank_name: method.customBankName,
      id: method.id,
      instructions: method.instructions,
      is_default: method.isDefault,
      position: method.position,
      promptpay_id: method.promptPayId,
      provider_name: method.providerName,
      qr_image_url: method.qrImageUrl,
      qr_mode: method.qrMode,
      type: method.type,
    })),
  });
  if (error) throw quotationPersistenceError(error);
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
  const { data, error } = await supabase.rpc("save_quotation_with_payments", { p_payload: rpcPayload });
  if (error) throw quotationPersistenceError(error);
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
