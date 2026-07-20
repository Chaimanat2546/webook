import QRCode from "qrcode";

export function buildQuotationPublicUrl(origin: string, token: string): string {
  const base = new URL(origin);
  return new URL(`/q/${encodeURIComponent(token)}`, base.origin).toString();
}

export function createQuotationPublicQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "image/png",
    width: 192,
  });
}
