import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type HouseListItem,
  type ListingDetailsUpdate,
  getPageRange,
  toListingSearchFilter,
} from "../services/houses";

export interface ListingDetailRow extends HouseListItem {
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

const listingDetailSelect = [
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
