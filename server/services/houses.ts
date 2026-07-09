import { normalizePrivatePoolType } from "../../lib/listing-facilities.ts";
import { formatZone } from "../../lib/house-zones.ts";

export const HOUSE_PAGE_SIZE = 8;

export interface HouseListItem {
  bathrooms: number | null;
  bedrooms: number | null;
  is_active: boolean | null;
  location_zone: string | null;
  property_id: string;
  title: string | null;
}

export const LISTING_DETAIL_EDITABLE_FIELDS = [
  "title",
  "bedrooms",
  "bathrooms",
  "extra_beds",
  "insurance_fee",
  "owner_id",
  "checkin_time",
  "checkout_time",
  "notes",
  "location_zone",
  "property_type",
  "rating",
  "max_guests",
  "is_active",
] as const;

export const LISTING_DETAIL_FORBIDDEN_FIELDS = [
  "property_id",
  "description",
  "property_tags",
  "sort_order",
] as const;

type ListingDetailsRawValue = FormDataEntryValue | null | undefined;
type ListingDetailsFormValues = FormData | Record<string, ListingDetailsRawValue>;

export interface ListingDetailsUpdate {
  bathrooms: number | null;
  bedrooms: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  extra_beds: number | null;
  insurance_fee: number | null;
  is_active: boolean;
  location_zone: string | null;
  max_guests: number;
  notes: string | null;
  owner_id: number | null;
  property_type: string | null;
  rating: number | null;
  title: string;
}

export const LISTING_PRICE_DAYS = [
  { dayOfWeek: 0, label: "วันจันทร์" },
  { dayOfWeek: 1, label: "วันอังคาร" },
  { dayOfWeek: 2, label: "วันพุธ" },
  { dayOfWeek: 3, label: "วันพฤหัสบดี" },
  { dayOfWeek: 4, label: "วันศุกร์" },
  { dayOfWeek: 5, label: "วันเสาร์" },
  { dayOfWeek: 6, label: "วันอาทิตย์" },
] as const;

export interface ListingPriceUpdate {
  agency_price: number | null;
  day_of_week: (typeof LISTING_PRICE_DAYS)[number]["dayOfWeek"];
  deville_price: number | null;
}

export interface ListingFacilityFormOption {
  id: string;
  name: string | null;
}

export interface ListingFacilityUpdate {
  facility_id: string;
  message: string | null;
  value_boolean: boolean;
}

const LISTING_FACILITY_MESSAGE_NAMES = new Set(["pets", "private_pool"]);

function getListingDetailValue(values: ListingDetailsFormValues, field: string): string {
  const value =
    typeof (values as FormData).get === "function"
      ? (values as FormData).get(field)
      : (values as Record<string, ListingDetailsRawValue>)[field];

  return typeof value === "string" ? value : "";
}

function getListingDetailValues(values: ListingDetailsFormValues, field: string): string[] {
  if (typeof (values as FormData).getAll === "function") {
    return (values as FormData).getAll(field).filter((value): value is string => typeof value === "string");
  }

  const value = (values as Record<string, ListingDetailsRawValue>)[field];
  return typeof value === "string" ? [value] : [];
}

function nullableTextField(values: ListingDetailsFormValues, field: string): string | null {
  const value = getListingDetailValue(values, field).trim();
  return value || null;
}

function requiredTextField(values: ListingDetailsFormValues, field: string): string {
  const value = nullableTextField(values, field);
  if (value === null) throw new Error(`${field} is required`);
  return value;
}

function nullableIntegerField(
  values: ListingDetailsFormValues,
  field: string,
  { max, min = 0 }: { max?: number; min?: number } = {},
): number | null {
  const raw = getListingDetailValue(values, field).trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new Error(`${field} must be an integer`);

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${field} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${field} must be at most ${max}`);
  }

  return value;
}

function requiredIntegerField(
  values: ListingDetailsFormValues,
  field: string,
  { min = 1 }: { min?: number } = {},
): number {
  const value = nullableIntegerField(values, field, { min });
  if (value === null) throw new Error(`${field} is required`);
  return value;
}

function nullableTimeField(values: ListingDetailsFormValues, field: string): string | null {
  const raw = getListingDetailValue(values, field).trim();
  if (!raw) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw);
  if (!match) throw new Error(`${field} must be a valid time`);

  return `${match[1]}:${match[2]}`;
}

function booleanField(values: ListingDetailsFormValues, field: string): boolean {
  return getListingDetailValues(values, field).some((value) =>
    ["1", "on", "true"].includes(value.trim().toLowerCase()),
  );
}

export function normalizeListingDetailsFormValues(
  values: ListingDetailsFormValues,
): ListingDetailsUpdate {
  return {
    bathrooms: nullableIntegerField(values, "bathrooms"),
    bedrooms: nullableIntegerField(values, "bedrooms"),
    checkin_time: nullableTimeField(values, "checkin_time"),
    checkout_time: nullableTimeField(values, "checkout_time"),
    extra_beds: nullableIntegerField(values, "extra_beds"),
    insurance_fee: nullableIntegerField(values, "insurance_fee"),
    is_active: booleanField(values, "is_active"),
    location_zone: nullableTextField(values, "location_zone"),
    max_guests: requiredIntegerField(values, "max_guests", { min: 1 }),
    notes: nullableTextField(values, "notes"),
    owner_id: nullableIntegerField(values, "owner_id"),
    property_type: nullableTextField(values, "property_type"),
    rating: nullableIntegerField(values, "rating", { max: 5 }),
    title: requiredTextField(values, "title"),
  };
}

export function normalizeListingPriceFormValues(
  values: ListingDetailsFormValues,
): ListingPriceUpdate[] {
  return LISTING_PRICE_DAYS.map((day) => ({
    agency_price: nullableIntegerField(values, `agency_price_${day.dayOfWeek}`),
    day_of_week: day.dayOfWeek,
    deville_price: nullableIntegerField(values, `deville_price_${day.dayOfWeek}`),
  }));
}

export function canEditListingFacilityMessage(name: string | null | undefined): boolean {
  return LISTING_FACILITY_MESSAGE_NAMES.has(name ?? "");
}

export function normalizeListingFacilityFormValues(
  values: ListingDetailsFormValues,
  facilities: ListingFacilityFormOption[],
): ListingFacilityUpdate[] {
  return facilities.map((facility) => {
    const value_boolean = booleanField(values, `facility_${facility.id}`);
    const messageField = `facility_message_${facility.id}`;
    const message = value_boolean
      ? facility.name === "private_pool"
        ? normalizePrivatePoolType(nullableTextField(values, messageField), messageField)
        : facility.name === "pets"
          ? nullableTextField(values, messageField)
          : null
      : null;

    return {
      facility_id: facility.id,
      message,
      value_boolean,
    };
  });
}

export function formatHouseZone(zone: string | null | undefined): string {
  return formatZone(zone);
}

export function formatHouseActiveStatus(active: boolean | null | undefined): string {
  return active === true ? "ใช้งานอยู่" : "ปิดใช้งาน";
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

export function toListingPropertyIdSearchValue(value: string): string | null {
  const match = /^(?:dv\s*-\s*)?(\d+)$/i.exec(normalizeHouseSearch(value));
  if (!match) return null;

  const propertyId = match[1].replace(/^0+(?=\d)/, "");
  return /^0+$/.test(propertyId) ? null : propertyId;
}

export function toListingSearchFilter(value: string): string {
  const pattern = toListingSearchPattern(value);
  if (!pattern) return "";

  const filters = [`title.ilike.%${pattern}%`, `location_zone.ilike.%${pattern}%`];
  const propertyId = toListingPropertyIdSearchValue(value);
  if (propertyId) filters.push(`property_id.eq.${propertyId}`);

  return filters.join(",");
}
