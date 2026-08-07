import "server-only";

const MAX_PIXELS = 16_000_000;

type SupportedQuotationImage = "png" | "webp";

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0);
}

function readWebpDimensions(bytes: Uint8Array): { height: number; width: number } {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") {
    throw new Error("รูปภาพไม่ใช่ WebP ที่ถูกต้อง");
  }
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      height: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      width: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = readUInt32LE(bytes, 21);
    return { height: ((bits >> 14) & 0x3fff) + 1, width: (bits & 0x3fff) + 1 };
  }
  throw new Error("รูปภาพ WebP ไม่มีขนาดที่รองรับ");
}

function readPngDimensions(bytes: Uint8Array): { height: number; width: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") {
    throw new Error("รูปภาพไม่ใช่ PNG ที่ถูกต้อง");
  }
  return { height: readUInt32BE(bytes, 20), width: readUInt32BE(bytes, 16) };
}

/** Validates file signatures and dimensions on the server before an R2 upload. */
export async function validateQuotationUploadedImage(
  file: File,
  expectedFormat: SupportedQuotationImage,
): Promise<ArrayBuffer> {
  const data = await file.arrayBuffer();
  const bytes = new Uint8Array(data);
  const dimensions = expectedFormat === "png" ? readPngDimensions(bytes) : readWebpDimensions(bytes);
  if (!Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) ||
    dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > MAX_PIXELS) {
    throw new Error("รูปภาพมีขนาดพิกเซลเกินที่ระบบรองรับ");
  }
  return data;
}
