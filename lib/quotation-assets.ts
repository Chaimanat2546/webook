const QUOTATION_ASSET_PREFIX = "quotations/assets/";
const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export function buildQuotationAssetObjectKey(randomUUID: () => string = crypto.randomUUID): string {
  return `${QUOTATION_ASSET_PREFIX}${randomUUID()}.webp`;
}

export function validateQuotationAssetObjectKey(value: string): string {
  const trimmed = value.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed).replace(/\\/g, "/");
  } catch {
    throw new Error("Invalid quotation asset key");
  }
  const fileName = decoded.slice(QUOTATION_ASSET_PREFIX.length);
  if (!decoded.startsWith(QUOTATION_ASSET_PREFIX) || decoded.includes("://") ||
    decoded.split("/").some((part) => !part || part === "." || part === "..") || !UUID.test(fileName)) {
    throw new Error("Invalid quotation asset key");
  }
  return decoded;
}

export function buildQuotationAssetUrl(objectKey: string, workerUrl: string): string {
  const key = validateQuotationAssetObjectKey(objectKey).split("/").map(encodeURIComponent).join("/");
  const base = workerUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing quotation asset Worker URL");
  return `${base}/${key}`;
}

export function validateQuotationAssetUrl(value: string, workerUrl: string): string {
  const candidate = new URL(value);
  const base = new URL(workerUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  if (candidate.protocol !== base.protocol || candidate.origin !== base.origin || candidate.search ||
    candidate.hash || !candidate.pathname.startsWith(`${basePath}/`)) {
    throw new Error("Invalid quotation asset URL");
  }
  const objectKey = decodeURIComponent(candidate.pathname.slice(basePath.length + 1));
  return buildQuotationAssetUrl(validateQuotationAssetObjectKey(objectKey), workerUrl);
}

export function validateQuotationAssetFile(file: File): File {
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) {
    throw new Error("ไฟล์โลโก้ต้องเป็น PNG, JPEG หรือ WEBP");
  }
  if (file.size === 0) throw new Error("ไฟล์โลโก้ว่างเปล่า");
  if (file.size > MAX_BYTES) throw new Error("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
  return file;
}
