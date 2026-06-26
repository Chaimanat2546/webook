export const UNASSIGNED_IMAGE_ZONE = "ไม่ระบุหมวด";

export interface HouseImageItem {
  created_at?: string | null;
  id: number;
  image_move: number | null;
  image_name: string | null;
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

export type ImageZoneKey = keyof typeof IMAGE_ZONE_META;
export type ImageZoneIconName =
  | (typeof IMAGE_ZONE_META)[ImageZoneKey]["icon"]
  | "image";

export interface ImageZoneMeta {
  icon: ImageZoneIconName;
  key: string;
  label: string;
}

const thaiDateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  hour12: false,
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function moveValue(image: HouseImageItem): number {
  return typeof image.image_move === "number" && Number.isFinite(image.image_move)
    ? image.image_move
    : Number.MAX_SAFE_INTEGER;
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

export function groupImagesByZone(images: HouseImageItem[]): ImageZoneGroup[] {
  const groups = new Map<string, HouseImageItem[]>();

  for (const image of images) {
    const zone = image.image_zone?.trim() || UNASSIGNED_IMAGE_ZONE;
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
    .sort((a, b) => a.minMove - b.minMove);
}
