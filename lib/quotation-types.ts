import type { QuotationItemInput } from "./quotation-calculator.ts";
import type { CertificationSnapshot } from "./quotation-certification.ts";
import type { QuotationPaymentMethod } from "./quotation-payment-methods.ts";

export type OfficeType = "branch" | "head_office";

export interface SellerSnapshot {
  address: string;
  branchNumber: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  email: string;
  logoUrl: string;
  name: string;
  officeType: OfficeType;
  phone: string;
  taxId: string;
  website: string;
}

export interface CustomerSnapshot {
  address: string;
  branchNumber: string;
  name: string;
  officeType: OfficeType;
  taxId: string;
}

export interface QuotationPayload {
  certification: CertificationSnapshot;
  customer: CustomerSnapshot;
  id: string | null;
  internalNotes: string;
  issueDate: string;
  items: QuotationItemInput[];
  paymentMethods: QuotationPaymentMethod[];
  publicNotes: string;
  reference: string;
  seller: SellerSnapshot;
  subject: string;
  validUntil: string;
  validityDays: string;
  withholdingTaxRate: string | null;
}
