import type { DiscountType, PriceMode, QuotationItemInput } from "./quotation-calculator.ts";

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
  contactName: string;
  email: string;
  name: string;
  officeType: OfficeType;
  phone: string;
  serviceLocation: string;
  shippingAddress: string;
  taxId: string;
}

export interface QuotationPayload {
  currency: "THB";
  customer: CustomerSnapshot;
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
  id: string | null;
  internalNotes: string;
  issueDate: string;
  items: QuotationItemInput[];
  priceMode: PriceMode;
  publicNotes: string;
  reference: string;
  seller: SellerSnapshot;
  subject: string;
  validUntil: string;
  validityDays: string;
}
