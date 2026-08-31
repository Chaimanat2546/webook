export const PRIVATE_POOL_TYPE_OPTIONS = [
  { label: "ไม่ระบุ", value: "" },
  { label: "สระเกลือ", value: "salt" },
  { label: "สระคลอรีน", value: "chlorine" },
];

export type ListingFacilityIconKey =
  | "Wifi"
  | "Barbecue"
  | "PawPrint"
  | "CircleDotDashed"
  | "Disc3"
  | "LifeBuoy"
  | "TableTennis"
  | "KidSlide"
  | "PoolTriangle"
  | "Waves"
  | "MicVocal"
  | "Hockey"
  | "HotTub"
  | "Bath"
  | "WavesLadder"
  | "BedDouble";

const facilityIconByName: Record<string, ListingFacilityIconKey> = {
  wifi: "Wifi",
  barbecue: "Barbecue",
  "เตาปิ้งย่าง": "Barbecue",
  pets: "PawPrint",
  "สัตว์เลี้ยง": "PawPrint",
  snooker: "CircleDotDashed",
  "สนุกเกอร์": "CircleDotDashed",
  disco: "Disc3",
  "ไฟเธค": "Disc3",
  fancy_float: "LifeBuoy",
  "ห่วงยางแฟนซี": "LifeBuoy",
  table_tennis: "TableTennis",
  "โต๊ะปิงปอง": "TableTennis",
  slide: "KidSlide",
  slider: "KidSlide",
  "สไลเดอร์": "KidSlide",
  "สไลด์เดอร์": "KidSlide",
  pool_table: "PoolTriangle",
  "โต๊ะพูล": "PoolTriangle",
  kids_pool: "Waves",
  "สระเด็ก": "Waves",
  karaoke: "MicVocal",
  "คาราโอเกะ": "MicVocal",
  air_hockey: "Hockey",
  "แอร์ฮอกกี้": "Hockey",
  jacuzzi: "HotTub",
  "จากุซซี่": "HotTub",
  bathtub: "Bath",
  "อ่างอาบน้ำ": "Bath",
  private_pool: "WavesLadder",
  "สระว่ายน้ำส่วนตัว": "WavesLadder",
  extra_bed: "BedDouble",
  "เตียงเสริม": "BedDouble",
};

export function getListingFacilityIconKey(facility: {
  name: string | null;
  title: string | null;
}): ListingFacilityIconKey | null {
  const names = [facility.name, facility.title]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return names.map((name) => facilityIconByName[name]).find(Boolean) ?? null;
}

export function formatListingFacilityTitle(facility: {
  name: string | null;
  title: string | null;
}): string {
  if (facility.name === "wifi") return "Wifi";
  if (facility.name === "slide" || facility.name === "slider") return "สไลเดอร์";
  return facility.title?.trim() || facility.name?.trim() || "ไม่พบชื่อสิ่งอำนวยความสะดวก";
}

export function normalizePrivatePoolType(value: string | null, field: string): string | null {
  if (!value) return null;
  if (value === "salt" || value === "chlorine") return value;
  throw new Error(`${field} must be salt or chlorine`);
}
