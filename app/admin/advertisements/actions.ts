"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdvertisementImageEnv } from "../../../lib/env";
import { requireAdmin } from "../../../server/auth/admin";
import {
  deleteAdvertisementImageById,
  getAdvertisementById,
  getAdvertisementImageById,
  getAdvertisementImages,
  insertAdvertisementImages,
  insertAdvertisementWithImages,
  updateAdvertisement,
  updateAdvertisementImageOrder,
  type AdvertisementImageInsert,
} from "../../../server/repositories/advertisements";
import {
  assertCanDeleteAdvertisementImage,
  buildAdvertisementImageName,
  buildAdvertisementImageObjectKey,
  getAvailableAdvertisementImageOrders,
  getImageFiles,
  normalizeAdvertisementImages,
  resolveAdvertisementImageObjectKey,
  validateAdvertisementImageEditCount,
  validateAdvertisementImageCount,
  validateAdvertisementImageFile,
  validateAdvertisementTitle,
} from "../../../server/services/advertisements";
import {
  deleteAdvertisementImageObject,
  uploadAdvertisementImageObject,
} from "../../../server/storage/advertisement-images";

function requireString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function booleanField(formData: FormData, name: string, fallback: boolean): boolean {
  const values = formData.getAll(name);
  if (values.length === 0) return fallback;
  return values.some((value) => value === "1" || value === "on" || value === "true");
}

function stringArrayField(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function assertAuthorized(isAuthorized: boolean): void {
  if (!isAuthorized) throw new Error("Unauthorized");
}

async function cleanupUploadedImages({
  objectKeys,
  workerSecret,
  workerUrl,
}: {
  objectKeys: string[];
  workerSecret: string;
  workerUrl: string;
}) {
  await Promise.allSettled(
    objectKeys.map((objectKey) =>
      deleteAdvertisementImageObject({ objectKey, workerSecret, workerUrl }),
    ),
  );
}

async function normalizeStoredImageOrder(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  advertisementId: string,
) {
  const images = await getAdvertisementImages(supabase, advertisementId);
  const normalized = normalizeAdvertisementImages(images);

  for (const image of normalized) {
    if (image.image_order !== images.find((item) => item.id === image.id)?.image_order) {
      await updateAdvertisementImageOrder(supabase, image.id, image.image_order);
    }
  }
}

export async function createAdvertisementAction(formData: FormData) {
  const { isAuthorized, supabase } = await requireAdmin();
  assertAuthorized(isAuthorized);

  const title = validateAdvertisementTitle(requireString(formData, "title"));
  const isActive = booleanField(formData, "is_active", true);
  const files = getImageFiles(formData, "images").map(validateAdvertisementImageFile);
  validateAdvertisementImageCount(files.length);

  const advertisementId = crypto.randomUUID();
  const { workerSecret, workerUrl } = getAdvertisementImageEnv();
  const uploadedObjectKeys: string[] = [];
  const imageRows: AdvertisementImageInsert[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const imageOrder = index + 1;
      const imageName = buildAdvertisementImageName(file.type);
      const objectKey = buildAdvertisementImageObjectKey(advertisementId, imageName);

      await uploadAdvertisementImageObject({
        body: await file.arrayBuffer(),
        contentType: file.type,
        objectKey,
        workerSecret,
        workerUrl,
      });
      uploadedObjectKeys.push(objectKey);
      imageRows.push({ advertisement_id: advertisementId, image_name: imageName, image_order: imageOrder });
    }

    await insertAdvertisementWithImages(supabase, {
      id: advertisementId,
      images: imageRows,
      isActive,
      title,
    });
  } catch (error) {
    await cleanupUploadedImages({ objectKeys: uploadedObjectKeys, workerSecret, workerUrl });
    throw error;
  }

  revalidatePath("/admin/advertisements");
  redirect(`/admin/advertisements/${encodeURIComponent(advertisementId)}?created=1`);
}

export async function updateAdvertisementAction(id: string, formData: FormData) {
  const { isAuthorized, supabase } = await requireAdmin();
  assertAuthorized(isAuthorized);

  const advertisement = await getAdvertisementById(supabase, id);
  if (!advertisement) throw new Error("Advertisement not found");

  const title = validateAdvertisementTitle(requireString(formData, "title"));
  const isActive = booleanField(formData, "is_active", false);
  const existingImages = advertisement.advertisement_images ?? [];
  const deletedImageIds = new Set(stringArrayField(formData, "deleted_image_ids"));
  const imagesToDelete = existingImages.filter((image) => deletedImageIds.has(image.id));
  const remainingImages = existingImages.filter((image) => !deletedImageIds.has(image.id));
  const files = getImageFiles(formData, "images").map(validateAdvertisementImageFile);
  validateAdvertisementImageEditCount({
    deletedImageCount: imagesToDelete.length,
    existingImageCount: existingImages.length,
    newImageCount: files.length,
  });

  const imageEnv = files.length > 0 ? getAdvertisementImageEnv() : null;
  const imageOrders = getAvailableAdvertisementImageOrders(remainingImages, files.length);
  const uploadedObjectKeys: string[] = [];
  const imageRows: AdvertisementImageInsert[] = [];

  try {
    if (imageEnv) {
      for (const [index, file] of files.entries()) {
        const imageOrder = imageOrders[index];
        if (!imageOrder) throw new Error("Invalid image order");
        const imageName = buildAdvertisementImageName(file.type);
        const objectKey = buildAdvertisementImageObjectKey(id, imageName);

        await uploadAdvertisementImageObject({
          body: await file.arrayBuffer(),
          contentType: file.type,
          objectKey,
          workerSecret: imageEnv.workerSecret,
          workerUrl: imageEnv.workerUrl,
        });
        uploadedObjectKeys.push(objectKey);
        imageRows.push({ advertisement_id: id, image_name: imageName, image_order: imageOrder });
      }
    }

    await updateAdvertisement(supabase, id, { isActive, title });
    for (const image of imagesToDelete) {
      await deleteAdvertisementImageById(supabase, image.id);
    }
    await insertAdvertisementImages(supabase, imageRows);
    await normalizeStoredImageOrder(supabase, id);

    if (imagesToDelete.length > 0) {
      const { workerSecret, workerUrl } = getAdvertisementImageEnv();
      await Promise.allSettled(
        imagesToDelete.map((image) =>
          deleteAdvertisementImageObject({
            objectKey: resolveAdvertisementImageObjectKey(image.advertisement_id, image.image_name),
            workerSecret,
            workerUrl,
          }),
        ),
      );
    }
  } catch (error) {
    if (imageEnv) {
      await cleanupUploadedImages({
        objectKeys: uploadedObjectKeys,
        workerSecret: imageEnv.workerSecret,
        workerUrl: imageEnv.workerUrl,
      });
    }
    throw error;
  }

  revalidatePath("/admin/advertisements");
  revalidatePath(`/admin/advertisements/${encodeURIComponent(id)}`);
  redirect(`/admin/advertisements/${encodeURIComponent(id)}?saved=1`);
}

export async function deleteAdvertisementImageAction(imageId: string) {
  const { isAuthorized, supabase } = await requireAdmin();
  assertAuthorized(isAuthorized);

  const image = await getAdvertisementImageById(supabase, imageId);
  if (!image) throw new Error("Advertisement image not found");

  const images = await getAdvertisementImages(supabase, image.advertisement_id);
  assertCanDeleteAdvertisementImage(images.length);

  const { workerSecret, workerUrl } = getAdvertisementImageEnv();
  await deleteAdvertisementImageObject({
    objectKey: resolveAdvertisementImageObjectKey(image.advertisement_id, image.image_name),
    workerSecret,
    workerUrl,
  });
  await deleteAdvertisementImageById(supabase, imageId);
  await normalizeStoredImageOrder(supabase, image.advertisement_id);

  revalidatePath("/admin/advertisements");
  revalidatePath(`/admin/advertisements/${encodeURIComponent(image.advertisement_id)}`);
}
