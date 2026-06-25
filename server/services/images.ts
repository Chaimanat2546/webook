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

function moveValue(image: HouseImageItem): number {
  return typeof image.image_move === "number" && Number.isFinite(image.image_move)
    ? image.image_move
    : Number.MAX_SAFE_INTEGER;
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
