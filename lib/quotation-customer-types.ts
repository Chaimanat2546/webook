import type { CustomerSnapshot, OfficeType } from "./quotation-types.ts";

export type QuotationCustomerType = "juristic" | "individual";

export interface DbdCustomerDefaults {
  address: string;
  name: string;
  status: string;
  taxId: string;
  verifiedAt: string;
}

export interface QuotationCustomerMaster {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  customerType: QuotationCustomerType;
  dbdAddress: string | null;
  dbdName: string | null;
  dbdStatus: string | null;
  dbdVerifiedAt: string | null;
  id: string;
  isActive: boolean;
  name: string;
  officeType: OfficeType;
  taxId: string;
  updatedAt: string;
}

export interface QuotationCustomerInput {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  customerType: QuotationCustomerType;
  id: string | null;
  name: string;
  officeType: OfficeType;
  saveUnverified: boolean;
  taxId: string;
}

export type CustomerMutationResult =
  | { customer: QuotationCustomerMaster; ok: true }
  | {
      existingCustomer?: QuotationCustomerMaster;
      fieldErrors: Record<string, string>;
      formError: string;
      ok: false;
      requiresUnverifiedConfirmation?: boolean;
    };

export type DbdLookupActionResult =
  | { defaults: DbdCustomerDefaults; ok: true }
  | { formError: string; ok: false; reason: "not_found" | "unavailable" };

export function quotationCustomerToSnapshot(
  customer: QuotationCustomerMaster,
): CustomerSnapshot {
  return {
    address: customer.address,
    branchNumber: customer.officeType === "branch" ? customer.branchNumber : "",
    name: customer.name,
    officeType: customer.officeType,
    taxId: customer.taxId,
  };
}
