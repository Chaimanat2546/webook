export function canUseHospitalitySideBySideSettlement({
  paymentMethodCount,
  paymentContentLength = 0,
  hasPaymentQr = false,
  publicNotesLength,
}: {
  paymentMethodCount: number;
  paymentContentLength?: number;
  hasPaymentQr?: boolean;
  publicNotesLength: number;
}): boolean {
  return paymentMethodCount <= 2 && publicNotesLength <= 250 && paymentContentLength <= 1800 && !hasPaymentQr;
}
