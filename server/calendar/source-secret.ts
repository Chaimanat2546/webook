import 'server-only';

async function keyFromBase64(value: string): Promise<CryptoKey> {
  try {
    const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
    if (bytes.length !== 32) throw new Error();
    return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } catch { throw new Error('calendar_secret_unconfigured'); }
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

export async function encryptSourceUrl(url: string, configuredKey = process.env.ICAL_SOURCE_ENCRYPTION_KEY ?? ''): Promise<string> {
  const key = await keyFromBase64(configuredKey);
  if (!url || url.length > 4096) throw new Error('calendar_secret_invalid');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode('ical-source:v1') }, key, new TextEncoder().encode(url));
  return JSON.stringify({ version: 1, nonce: encode(nonce), ciphertext: encode(new Uint8Array(encrypted)) });
}

export async function decryptSourceUrl(payload: string, configuredKey = process.env.ICAL_SOURCE_ENCRYPTION_KEY ?? ''): Promise<string> {
  const key = await keyFromBase64(configuredKey);
  try {
    if (payload.length > 8192) throw new Error();
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
      || !('nonce' in value) || typeof value.nonce !== 'string'
      || !('ciphertext' in value) || typeof value.ciphertext !== 'string') throw new Error();
    const nonce = decode(value.nonce);
    if (nonce.length !== 12) throw new Error();
    const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode('ical-source:v1') }, key, decode(value.ciphertext));
    return new TextDecoder('utf-8', { fatal: true }).decode(result);
  } catch { throw new Error('calendar_secret_invalid'); }
}
