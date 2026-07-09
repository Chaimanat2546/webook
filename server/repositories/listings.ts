import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type HouseListItem,
  type ListingDetailsUpdate,
  type ListingFacilityUpdate,
  type ListingPriceUpdate,
  getPageRange,
  toListingSearchFilter,
} from "../services/houses";

export interface ListingDetailRow extends HouseListItem {
  id: string;
  checkin_time: string | null;
  checkout_time: string | null;
  extra_beds: number | null;
  insurance_fee: number | null;
  max_guests: number;
  notes: string | null;
  owner_id: number | null;
  property_type: string | null;
  rating: number | null;
}

export interface ListingPriceRow {
  agency_price: number | null;
  day_of_week: number | null;
  deville_price: number | null;
  id: string;
  listing_id: string | null;
}

export interface FacilityRow {
  id: string;
  name: string | null;
  title: string | null;
}

export interface ListingFacilityRow {
  facility_id: string | null;
  id: string;
  listing_id: string | null;
  message: string | null;
  value_boolean: boolean | null;
}

const listingDetailSelect = [
  "id",
  "property_id",
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
].join(",");

export async function getPaginatedListings(
  supabase: SupabaseClient,
  {
    page,
    search,
  }: {
    page: number;
    search: string;
  },
) {
  const { from, to } = getPageRange(page);
  const searchFilter = toListingSearchFilter(search);
  let query = supabase
    .from("listings")
    .select("property_id,title,bedrooms,bathrooms,location_zone,is_active", {
      count: "exact",
    })
    .order("is_active", { ascending: false })
    .order("property_id", { ascending: true })
    .range(from, to);

  if (searchFilter) {
    query = query.or(searchFilter);
  }

  const { count, data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { count: count ?? 0, houses: data ?? [] };
}

export async function getListingByPropertyId(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select(listingDetailSelect)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ListingDetailRow | null;
}

export async function getListingPricesByListingId(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingPriceRow[]> {
  const { data, error } = await supabase
    .from("listing_prices")
    .select("id,listing_id,day_of_week,deville_price,agency_price")
    .eq("listing_id", listingId)
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ListingPriceRow[];
}

export async function getFacilities(supabase: SupabaseClient): Promise<FacilityRow[]> {
  const { data, error } = await supabase
    .from("facilities")
    .select("id,name,title")
    .order("title", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FacilityRow[];
}

export async function getListingFacilitiesByListingId(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingFacilityRow[]> {
  const { data, error } = await supabase
    .from("listing_facilities")
    .select("id,listing_id,facility_id,message,value_boolean")
    .eq("listing_id", listingId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ListingFacilityRow[];
}

export async function updateListingDetailsByPropertyId(
  supabase: SupabaseClient,
  propertyId: string,
  values: ListingDetailsUpdate,
) {
  const { error } = await supabase
    .from("listings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateListingFacilitiesByListingId(
  supabase: SupabaseClient,
  listingId: string,
  values: ListingFacilityUpdate[],
) {
  const { data, error } = await supabase
    .from("listing_facilities")
    .select("facility_id")
    .eq("listing_id", listingId);

  if (error) {
    throw new Error(error.message);
  }

  const existingFacilityIds = new Set(
    (data ?? [])
      .map((row: { facility_id: string | null }) => row.facility_id)
      .filter((facilityId): facilityId is string => typeof facilityId === "string"),
  );
  const timestamp = new Date().toISOString();
  const inserts: Array<ListingFacilityUpdate & { listing_id: string; updated_at: string }> = [];

  for (const value of values) {
    if (existingFacilityIds.has(value.facility_id)) {
      const { error: updateError } = await supabase
        .from("listing_facilities")
        .update({ ...value, updated_at: timestamp })
        .eq("listing_id", listingId)
        .eq("facility_id", value.facility_id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      inserts.push({ ...value, listing_id: listingId, updated_at: timestamp });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("listing_facilities").insert(inserts);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function updateListingPricesByListingId(
  supabase: SupabaseClient,
  listingId: string,
  values: ListingPriceUpdate[],
) {
  const { data, error } = await supabase
    .from("listing_prices")
    .select("day_of_week")
    .eq("listing_id", listingId);

  if (error) {
    throw new Error(error.message);
  }

  const existingDays = new Set(
    (data ?? [])
      .map((row: { day_of_week: number | null }) => row.day_of_week)
      .filter((day): day is number => typeof day === "number"),
  );
  const timestamp = new Date().toISOString();
  const inserts: Array<ListingPriceUpdate & { listing_id: string; updated_at: string }> = [];

  for (const value of values) {
    if (existingDays.has(value.day_of_week)) {
      const { error: updateError } = await supabase
        .from("listing_prices")
        .update({ ...value, updated_at: timestamp })
        .eq("listing_id", listingId)
        .eq("day_of_week", value.day_of_week);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      inserts.push({ ...value, listing_id: listingId, updated_at: timestamp });
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("listing_prices").insert(inserts);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}
