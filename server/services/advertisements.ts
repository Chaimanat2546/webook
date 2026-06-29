export const ADVERTISEMENT_MIN_IMAGES = 1;
export const ADVERTISEMENT_MAX_IMAGES = 2;
export const ADVERTISEMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface AdvertisementImageItem {
  id: string;
  image_name: string;
  image_order: number;
}

const extensionByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAdvertisementTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error("Advertisement title is required");
  return title;
}

export function validateAdvertisementImageCount(count: number): number {
  if (count < ADVERTISEMENT_MIN_IMAGES) {
    throw new Error("Advertisement requires at least 1 image");
  }
  if (count > ADVERTISEMENT_MAX_IMAGES) {
    throw new Error("Advertisement supports at most 2 images");
  }
  return count;
}

export function validateAdvertisementImageEditCount({
  deletedImageCount,
  existingImageCount,
  newImageCount,
}: {
  deletedImageCount: number;
  existingImageCount: number;
  newImageCount: number;
}): number {
  return validateAdvertisementImageCount(existingImageCount - deletedImageCount + newImageCount);
}

export function validateAdvertisementImageFile(file: File): File {
  if (!extensionByMimeType[file.type]) throw new Error("Unsupported image type");
  if (file.size > ADVERTISEMENT_MAX_IMAGE_BYTES) throw new Error("Advertisement image is too large");
  return file;
}

export function assertCanDeleteAdvertisementImage(imageCount: number): void {
  if (imageCount <= ADVERTISEMENT_MIN_IMAGES) {
    throw new Error("Cannot delete the last advertisement image");
  }
}

export function buildAdvertisementImageName(
  advertisementId: string,
  imageOrder: number,
  mimeType: string,
): string {
  const extension = extensionByMimeType[mimeType];
  if (!extension) throw new Error("Unsupported image type");
  if (!Number.isInteger(imageOrder) || imageOrder < 1 || imageOrder > ADVERTISEMENT_MAX_IMAGES) {
    throw new Error("Invalid image order");
  }
  return `advertisements/${advertisementId}/${imageOrder}.${extension}`;
}

export function normalizeAdvertisementImages<T extends AdvertisementImageItem>(images: T[]): T[] {
  validateAdvertisementImageCount(images.length);
  return [...images]
    .sort((a, b) => a.image_order - b.image_order || a.id.localeCompare(b.id))
    .map((image, index) => ({ ...image, image_order: index + 1 }));
}

export function getAvailableAdvertisementImageOrders(
  images: AdvertisementImageItem[],
  newImageCount: number,
): number[] {
  validateAdvertisementImageCount(images.length + newImageCount);

  const usedOrders = new Set(images.map((image) => image.image_order));
  const orders: number[] = [];
  for (let order = 1; order <= ADVERTISEMENT_MAX_IMAGES && orders.length < newImageCount; order += 1) {
    if (!usedOrders.has(order)) orders.push(order);
  }
  return orders;
}

export function getImageFiles(formData: FormData, fieldName: string): File[] {
  return formData
    .getAll(fieldName)
    .filter((value): value is File => value instanceof File && value.size > 0);
}
