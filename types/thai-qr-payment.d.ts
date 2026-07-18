declare module "thai-qr-payment" {
  interface PromptPayPayloadOptions {
    amount?: number;
    recipient: string;
    type?: "mobile" | "nationalId";
  }

  interface PromptPayRendererOptions {
    amount?: number;
    recipient: string;
    recipientType?: "mobile" | "nationalId";
    size?: number;
  }

  interface ParsedPromptPayPayload {
    amount: number | null;
    crc: { valid: boolean };
    currency: string;
    merchant: null | { kind: string; recipient?: string };
  }

  export function parsePayload(payload: string): ParsedPromptPayPayload;
  export function payloadFor(options: PromptPayPayloadOptions): string;
  export function renderThaiQRPaymentMatrix(
    options: PromptPayRendererOptions,
  ): string;
}
