export const QUOTATION_IMAGE_MAX_SIDE = 1600;

export function resizeQuotationImageToMax(width: number, height: number): { height: number; width: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive");
  }
  const largest = Math.max(width, height);
  if (largest <= QUOTATION_IMAGE_MAX_SIDE) return { height: Math.round(height), width: Math.round(width) };
  const scale = QUOTATION_IMAGE_MAX_SIDE / largest;
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
}
