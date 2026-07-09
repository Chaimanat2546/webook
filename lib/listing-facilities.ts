export const PRIVATE_POOL_TYPE_OPTIONS = [
  { label: "ไม่ระบุ", value: "" },
  { label: "สระเกลือ", value: "salt" },
  { label: "สระคลอรีน", value: "chlorine" },
];

export function formatListingFacilityTitle(facility: {
  name: string | null;
  title: string | null;
}): string {
  if (facility.name === "wifi") return "Wifi";
  return facility.title?.trim() || facility.name?.trim() || "ไม่พบชื่อสิ่งอำนวยความสะดวก";
}

export function normalizePrivatePoolType(value: string | null, field: string): string | null {
  if (!value) return null;
  if (value === "salt" || value === "chlorine") return value;
  throw new Error(`${field} must be salt or chlorine`);
}
