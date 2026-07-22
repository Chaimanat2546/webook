export const quotationPaymentAssetOriginNotConfiguredMessage =
  "quotation_payment_asset_origin_not_configured";

export class QuotationPaymentAssetOriginNotConfiguredError extends Error {
  constructor() {
    super(quotationPaymentAssetOriginNotConfiguredMessage);
  }
}

type DatabaseError = { code?: unknown; message?: unknown };

export function quotationPersistenceError(error: DatabaseError): Error {
  if (
    error.code === "P0001"
    && error.message === quotationPaymentAssetOriginNotConfiguredMessage
  ) {
    return new QuotationPaymentAssetOriginNotConfiguredError();
  }
  return new Error(typeof error.message === "string" ? error.message : "Database request failed");
}
