import type { SupabaseClient } from "@supabase/supabase-js";

export async function getImagesByPropertyId(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("images")
    .select("id,property_id,image_name,image_url,image_zone,image_move,created_at,updated_at")
    .eq("property_id", propertyId)
    .order("image_move", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
