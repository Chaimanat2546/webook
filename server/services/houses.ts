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

export type PaginationPageItem = number | "ellipsis";

export function getPaginationItems(currentPage: number, totalPages: number): PaginationPageItem[] {
  const total = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 0;
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const page = Math.min(normalizePage(currentPage), total);

  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (page >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", total];
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
