export const HOUSE_PAGE_SIZE = 8;

export interface HouseListItem {
  bathrooms: number | null;
  bedrooms: number | null;
  is_active: boolean | null;
  location_zone: string | null;
  property_id: string;
  title: string | null;
}

export function normalizeHouseSearch(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export function normalizePage(value: string | string[] | number | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function getPageRange(pageInput: string | string[] | number | undefined) {
  const page = normalizePage(pageInput);
  const from = (page - 1) * HOUSE_PAGE_SIZE;
  return { from, to: from + HOUSE_PAGE_SIZE - 1 };
}

export function sortActiveFirst<T extends { is_active: boolean | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.is_active === true) - Number(a.is_active === true));
}

export function toListingSearchPattern(value: string): string {
  return normalizeHouseSearch(value)
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .trim();
}
