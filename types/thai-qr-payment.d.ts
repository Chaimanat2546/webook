declare module "thai-qr-payment" {
  interface PromptPayOptions {
    amount?: number;
    recipient: string;
    recipientType?: "mobile" | "nationalId";
  }

  interface ParsedPromptPayPayload {
    amount: number | null;
    crc: { valid: boolean };
    currency: string;
    merchant: null | { kind: string; recipient?: string };
  }

  export function parsePayload(payload: string): ParsedPromptPayPayload;
  export function payloadFor(options: PromptPayOptions): string;
  export function renderThaiQRPaymentMatrix(
    options: PromptPayOptions & { size?: number },
  ): string;
}
