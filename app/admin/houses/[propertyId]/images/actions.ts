"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildHouseImageUrl } from "../../../../../lib/house-image-url";
import { getHouseImageEnv } from "../../../../../lib/env";
import {
  canUseAccommodation,
  type AdminUserForAuth,
  requireAdmin,
} from "../../../../../server/auth/admin";
import {
  deleteHouseImageById,
  getImagesByPropertyId,
  insertHouseImages,
  type HouseImageInsert,
} from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import {
  buildHouseImageName,
  buildHouseImageObjectKey,
  getHouseImageStorageProvider,
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

function requireString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function stringArrayField(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
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

function getSafeReturnTo(value: string): string | null {
  if (value === "/admin/houses" || value.startsWith("/admin/houses?")) return value;
  return null;
}

function imagePageHref(propertyId: string, zone: string, returnTo: string | null): string {
  const params = new URLSearchParams({ saved: "1", zone });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
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

export async function updateHouseImagesAction(propertyId: string, formData: FormData) {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(adminUser);
  const adminCreateBy = requireAdminCreateBy(adminUser);

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const numericPropertyId = parsePropertyId(propertyId);
  const imageZone = validateHouseImageZone(requireString(formData, "image_zone") || "inside");
  const returnTo = getSafeReturnTo(requireString(formData, "return_to"));
  const deletedImageIds = new Set(stringArrayField(formData, "deleted_image_ids"));
  const existingImages = await getImagesByPropertyId(supabase, propertyId);
  const imagesToDelete = existingImages.filter((image) => deletedImageIds.has(String(image.id)));
  const remainingImages = existingImages.filter((image) => !deletedImageIds.has(String(image.id)));
  const files = getImageFiles(formData, "images").map(validateHouseImageFile);

  for (const image of imagesToDelete) {
    if (!isHouseImageFileOperationAllowed(image.image_url, "delete")) {
      throw new Error("Image provider does not support delete");
    }
  }

  const imageEnv =
    files.length > 0 ||
    imagesToDelete.some((image) => getHouseImageStorageProvider(image.image_url) === "r2")
      ? getHouseImageEnv()
      : null;
  const uploadedObjectKeys: string[] = [];
  const rows: HouseImageInsert[] = [];
  const now = new Date().toISOString();

  try {
    if (imageEnv) {
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
          image_move: getNextHouseImageMove(remainingImages, imageZone, index),
          image_name: imageName,
          image_url: buildHouseImageUrl(objectKey, imageEnv.workerUrl),
          image_zone: imageZone,
          property_id: numericPropertyId,
          updated_at: now,
        });
      }
    }

    await insertHouseImages(supabase, rows);
    for (const image of imagesToDelete) {
      await deleteHouseImageById(supabase, image.id);
    }

    if (imageEnv) {
      await Promise.allSettled(
        imagesToDelete
          .filter((image) => getHouseImageStorageProvider(image.image_url) === "r2")
          .map((image) =>
            deleteHouseImageObject({
              objectKey: resolveHouseImageObjectKey(propertyId, image.image_name ?? ""),
              workerSecret: imageEnv.workerSecret,
              workerUrl: imageEnv.workerUrl,
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

  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}/images`);
  redirect(imagePageHref(propertyId, imageZone, returnTo));
}
