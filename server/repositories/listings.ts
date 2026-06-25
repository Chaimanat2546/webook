import type { SupabaseClient } from "@supabase/supabase-js";

import { getPageRange, toListingSearchPattern } from "../services/houses";

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
  const pattern = toListingSearchPattern(search);
  let query = supabase
    .from("listings")
    .select("property_id,title,bedrooms,bathrooms,location_zone,is_active", {
      count: "exact",
    })
    .order("is_active", { ascending: false })
    .order("property_id", { ascending: true })
    .range(from, to);

  if (pattern) {
    query = query.or(
      `title.ilike.%${pattern}%,property_id.ilike.%${pattern}%,location_zone.ilike.%${pattern}%`,
    );
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
    .select("property_id,title,bedrooms,bathrooms,location_zone,is_active")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
