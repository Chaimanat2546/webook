import { awsImageHostname } from "../../lib/aws-image-url.ts";
import { validateHouseImageObjectKey } from "../../lib/house-image-url.ts";
import {
  buildManagedImageFileName,
  validateManagedImageFileName,
  type ManagedImageNameOptions,
} from "./image-file-names.ts";

export const UNASSIGNED_IMAGE_ZONE = "ไม่ระบุหมวด";

export interface HouseImageItem {
  created_at?: string | null;
  id: number;
  image_move: number | null;
  image_name: string | null;
  image_url?: string | null;
  image_zone: string | null;
  updated_at?: string | null;
}

export interface ImageZoneGroup {
  images: HouseImageItem[];
  maxMove: number;
  minMove: number;
  zone: string;
}

export const IMAGE_ZONE_META = {
  inside: { icon: "armchair", label: "ภายใน" },
  parking: { icon: "car-front", label: "ที่จอดรถ" },
  bathroom: { icon: "bath", label: "ห้องน้ำ" },
  bedroom: { icon: "bed-double", label: "ห้องนอน" },
  kitchen: { icon: "cooking-pot", label: "ห้องครัว" },
  review: { icon: "message-circle-code", label: "รีวิว" },
  outside: { icon: "door-closed", label: "ภายนอก" },
} as const;

const IMAGE_ZONE_ORDER = ["cover", ...Object.keys(IMAGE_ZONE_META)] as const;

export type ImageZoneKey = keyof typeof IMAGE_ZONE_META;
export type ImageZoneIconName =
  | (typeof IMAGE_ZONE_META)[ImageZoneKey]["icon"]
  | "image";

export interface ImageZoneMeta {
  icon: ImageZoneIconName;
  key: string;
  label: string;
}

export type HouseImageFileOperation = "create" | "delete" | "replace";
export type HouseImageStorageProvider = "aws-s3" | "r2" | "unknown";

const HOUSE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedHouseImageMimeTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const validImageZones = new Set(["cover", ...Object.keys(IMAGE_ZONE_META)]);

const thaiDateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  hour12: false,
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function normalizedZone(value: string | null | undefined): string {
  return value?.trim() || UNASSIGNED_IMAGE_ZONE;
}

function moveValue(image: HouseImageItem): number {
  return typeof image.image_move === "number" && Number.isFinite(image.image_move)
    ? image.image_move
    : Number.MAX_SAFE_INTEGER;
}

function imageMoveForNewOrder(image: HouseImageItem): number {
  return typeof image.image_move === "number" && Number.isFinite(image.image_move)
    ? image.image_move
    : 0;
}

function zoneOrderValue(zone: string): number {
  const index = IMAGE_ZONE_ORDER.findIndex((value) => value === zone);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function formatImageMoveLabel(imageMove: number | null): string {
  return `# ${typeof imageMove === "number" && Number.isFinite(imageMove) ? imageMove : "-"}`;
}

export function formatThaiImageDateTime(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return thaiDateTimeFormatter.format(date);
}

export function getImageZoneMeta(zone: string): ImageZoneMeta {
  const key = zone.trim();
  const meta = IMAGE_ZONE_META[key as ImageZoneKey];

  if (meta) {
    return {
      icon: meta.icon,
      key,
      label: meta.label,
    };
  }

  return {
    icon: "image",
    key,
    label: key || UNASSIGNED_IMAGE_ZONE,
  };
}

export function getSelectedImageZoneGroup(
  groups: ImageZoneGroup[],
  selectedZone?: string,
): ImageZoneGroup | null {
  return groups.find((group) => group.zone === selectedZone) ?? groups[0] ?? null;
}

export function getHouseImageStorageProvider(imageUrl?: string | null): HouseImageStorageProvider {
  const value = imageUrl?.trim();
  if (!value) return "unknown";

  try {
    const url = new URL(value);
    if (url.pathname.startsWith("/houses/")) return "r2";
    if (url.hostname === awsImageHostname || url.hostname.endsWith(".amazonaws.com")) {
      return "aws-s3";
    }
  } catch {
    if (value.startsWith("houses/")) return "r2";
  }

  return "unknown";
}

export function isHouseImageFileOperationAllowed(
  imageUrl: string | null | undefined,
  operation: HouseImageFileOperation,
): boolean {
  const provider = getHouseImageStorageProvider(imageUrl);
  return (
    provider === "r2" &&
    (operation === "create" || operation === "replace" || operation === "delete")
  );
}

export function validateHouseImageFile(file: File): File {
  if (!supportedHouseImageMimeTypes.has(file.type)) throw new Error("Unsupported image type");
  if (file.size > HOUSE_MAX_IMAGE_BYTES) throw new Error("House image is too large");
  return file;
}

export function validateHouseImageZone(value: string): string {
  const zone = value.trim();
  if (!validImageZones.has(zone)) throw new Error("Invalid image zone");
  return zone;
}

export function getNextHouseImageMove(
  images: HouseImageItem[],
  zone: string,
  offset = 0,
): number {
  const selectedZone = normalizedZone(zone);
  const maxMove = Math.max(
    0,
    ...images
      .filter((image) => normalizedZone(image.image_zone) === selectedZone)
      .map(imageMoveForNewOrder),
  );

  return maxMove + offset + 1;
}

export function buildHouseImageName(
  mimeType: string,
  options?: ManagedImageNameOptions,
): string {
  return buildManagedImageFileName(mimeType, options);
}

export function buildHouseImageObjectKey(propertyId: string, imageName: string): string {
  const id = propertyId.trim();
  if (!/^\d+$/.test(id)) throw new Error("Invalid property id");
  return `houses/${id}/${validateManagedImageFileName(imageName)}`;
}

export function resolveHouseImageObjectKey(propertyId: string, imageName: string): string {
  const normalized = imageName.trim().replace(/\\/g, "/");
  if (normalized.startsWith("houses/")) return validateHouseImageObjectKey(normalized);
  return buildHouseImageObjectKey(propertyId, normalized);
}

export function getImageFiles(formData: FormData, fieldName: string): File[] {
  return formData
    .getAll(fieldName)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function groupImagesByZone(images: HouseImageItem[]): ImageZoneGroup[] {
  const groups = new Map<string, HouseImageItem[]>();

  for (const image of images) {
    const zone = normalizedZone(image.image_zone);
    const zoneImages = groups.get(zone) ?? [];
    zoneImages.push(image);
    groups.set(zone, zoneImages);
  }

  return [...groups.entries()]
    .map(([zone, zoneImages]) => {
      const sortedImages = [...zoneImages].sort((a, b) => moveValue(a) - moveValue(b));
      const moves = sortedImages.map(moveValue);

      return {
        images: sortedImages,
        maxMove: Math.max(...moves),
        minMove: Math.min(...moves),
        zone,
      };
    })
    .sort((a, b) => {
      const zoneOrderDelta = zoneOrderValue(a.zone) - zoneOrderValue(b.zone);
      if (zoneOrderDelta !== 0) return zoneOrderDelta;
      return a.minMove - b.minMove || a.zone.localeCompare(b.zone, "th");
    });
}
