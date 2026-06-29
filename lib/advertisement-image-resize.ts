export const ADVERTISEMENT_IMAGE_MAX_SIDE = 1080;

export interface ImageDimensions {
  height: number;
  width: number;
}

export function resizeToMax(
  width: number,
  height: number,
  maxSide = ADVERTISEMENT_IMAGE_MAX_SIDE,
): ImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive");
  }
  if (!Number.isFinite(maxSide) || maxSide <= 0) {
    throw new Error("Maximum image side must be positive");
  }

  const largestSide = Math.max(width, height);
  if (largestSide <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = maxSide / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
