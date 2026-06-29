"use server";

import { revalidatePath } from "next/cache";

import { getHouseImageEnv } from "../../../../../lib/env";
import { buildHouseImageUrl } from "../../../../../lib/house-image-url";
import {
  canUseAccommodation,
  type AdminUserForAuth,
  requireAdmin,
} from "../../../../../server/auth/admin";
import {
  deleteHouseImageById,
  getHouseImageById,
  getHouseImagesByIds,
  getImagesByPropertyId,
  insertHouseImages,
  type HouseImageInsert,
} from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import {
  buildHouseImageName,
  buildHouseImageObjectKey,
  getImageFiles,
  getNextHouseImageMove,
  isHouseImageFileOperationAllowed,
  resolveHouseImageObjectKey,
  validateHouseImageFile,
  validateHouseImageZone,
} from "../../../../../server/services/images";
import {
  deleteHouseImageObject,
  uploadHouseImageObject,
} from "../../../../../server/storage/house-images";

export interface HouseImageUploadResult {
  uploadedCount: number;
}

export interface HouseImageDeleteResult {
  cleanupWarning: boolean;
  deletedId: number;
  fileName: string | null;
}

export interface HouseImageBulkDeleteResult {
  databaseFailed: Array<{ id: number; fileName: string | null; message: string }>;
  deleted: Array<{ id: number; fileName: string | null }>;
  skipped: Array<{ id: number; reason: string }>;
  storageFailed: Array<{ id: number; fileName: string | null; message: string }>;
}

function requireString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function assertCanUseAccommodation(adminUser: AdminUserForAuth | null): void {
  if (!canUseAccommodation(adminUser)) throw new Error("Unauthorized");
}

function requireAdminCreateBy(adminUser: AdminUserForAuth | null): number {
  if (!adminUser) throw new Error("Unauthorized");
  if (!Number.isInteger(adminUser.mid) || Number(adminUser.mid) < 1) {
    throw new Error("Admin profile is incomplete");
  }
  return Number(adminUser.mid);
}

function parsePropertyId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid property id");
  return id;
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
    objectKeys.map((objectKey) => deleteHouseImageObject({ objectKey, workerSecret, workerUrl })),
  );
}

function revalidateHouseImagePaths(propertyId: string) {
  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/images`);
}

function assertImageBelongsToProperty(
  image: { property_id?: number | string | null },
  propertyId: string,
) {
  if (String(image.property_id) !== propertyId) {
    throw new Error("Image does not belong to this house");
  }
}

function assertImageCanBeDeleted(imageUrl?: string | null) {
  if (!isHouseImageFileOperationAllowed(imageUrl, "delete")) {
    throw new Error("Image provider does not support delete");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function uploadHouseImagesAction(
  propertyId: string,
  formData: FormData,
): Promise<HouseImageUploadResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);
  const adminCreateBy = requireAdminCreateBy(adminUser);

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const numericPropertyId = parsePropertyId(propertyId);
  const imageZone = validateHouseImageZone(requireString(formData, "image_zone") || "inside");
  const files = getImageFiles(formData, "images").map(validateHouseImageFile);
  if (files.length === 0) return { uploadedCount: 0 };

  const existingImages = await getImagesByPropertyId(supabase, propertyId);
  const imageEnv = getHouseImageEnv();
  const uploadedObjectKeys: string[] = [];
  const rows: HouseImageInsert[] = [];
  const now = new Date().toISOString();

  try {
    for (const [index, file] of files.entries()) {
      const imageName = buildHouseImageName(file.type);
      const objectKey = buildHouseImageObjectKey(propertyId, imageName);
      await uploadHouseImageObject({
        body: await file.arrayBuffer(),
        contentType: file.type,
        objectKey,
        workerSecret: imageEnv.workerSecret,
        workerUrl: imageEnv.workerUrl,
      });
      uploadedObjectKeys.push(objectKey);
      rows.push({
        created_at: now,
        create_by: adminCreateBy,
        image_move: getNextHouseImageMove(existingImages, imageZone, index),
        image_name: imageName,
        image_url: buildHouseImageUrl(objectKey, imageEnv.workerUrl),
        image_zone: imageZone,
        property_id: numericPropertyId,
        updated_at: now,
      });
    }

    await insertHouseImages(supabase, rows);
  } catch (error) {
    await cleanupUploadedImages({
      objectKeys: uploadedObjectKeys,
      workerSecret: imageEnv.workerSecret,
      workerUrl: imageEnv.workerUrl,
    });
    throw error;
  }

  revalidateHouseImagePaths(propertyId);
  return { uploadedCount: rows.length };
}

export async function deleteHouseImageAction(
  propertyId: string,
  imageId: number,
): Promise<HouseImageDeleteResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);
  if (!Number.isInteger(imageId) || imageId < 1) throw new Error("Invalid image id");

  const image = await getHouseImageById(supabase, imageId);
  if (!image) throw new Error("Image not found");
  assertImageBelongsToProperty(image, propertyId);
  assertImageCanBeDeleted(image.image_url);

  await deleteHouseImageById(supabase, image.id);

  let cleanupWarning = false;
  try {
    const imageEnv = getHouseImageEnv();
    await deleteHouseImageObject({
      objectKey: resolveHouseImageObjectKey(propertyId, image.image_name ?? ""),
      workerSecret: imageEnv.workerSecret,
      workerUrl: imageEnv.workerUrl,
    });
  } catch {
    cleanupWarning = true;
  }

  revalidateHouseImagePaths(propertyId);
  return {
    cleanupWarning,
    deletedId: image.id,
    fileName: image.image_name ?? null,
  };
}

export async function deleteHouseImagesAction(
  propertyId: string,
  imageIds: number[],
): Promise<HouseImageBulkDeleteResult> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);

  const uniqueIds = [...new Set(imageIds.filter((id) => Number.isInteger(id) && id > 0))];
  const images = await getHouseImagesByIds(supabase, uniqueIds);
  const imageById = new Map(images.map((image) => [image.id, image]));
  const result: HouseImageBulkDeleteResult = {
    databaseFailed: [],
    deleted: [],
    skipped: [],
    storageFailed: [],
  };

  for (const imageId of uniqueIds) {
    const image = imageById.get(imageId);
    if (!image) {
      result.skipped.push({ id: imageId, reason: "Image not found" });
      continue;
    }

    if (String(image.property_id) !== propertyId) {
      result.skipped.push({ id: imageId, reason: "Image does not belong to this house" });
      continue;
    }

    if (!isHouseImageFileOperationAllowed(image.image_url, "delete")) {
      result.skipped.push({ id: imageId, reason: "Image provider does not support delete" });
      continue;
    }

    try {
      await deleteHouseImageById(supabase, image.id);
      result.deleted.push({ id: image.id, fileName: image.image_name ?? null });
    } catch (error) {
      result.databaseFailed.push({
        fileName: image.image_name ?? null,
        id: image.id,
        message: errorMessage(error),
      });
      continue;
    }

    try {
      const imageEnv = getHouseImageEnv();
      await deleteHouseImageObject({
        objectKey: resolveHouseImageObjectKey(propertyId, image.image_name ?? ""),
        workerSecret: imageEnv.workerSecret,
        workerUrl: imageEnv.workerUrl,
      });
    } catch (error) {
      result.storageFailed.push({
        fileName: image.image_name ?? null,
        id: image.id,
        message: errorMessage(error),
      });
    }
  }

  revalidateHouseImagePaths(propertyId);
  return result;
}
