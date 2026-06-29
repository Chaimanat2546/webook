import type { SupabaseClient } from "@supabase/supabase-js";

export interface HouseImageInsert {
  created_at: string;
  create_by: number;
  image_move: number;
  image_name: string;
  image_url: string;
  image_zone: string;
  property_id: number;
  updated_at: string;
}

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

export async function insertHouseImages(supabase: SupabaseClient, images: HouseImageInsert[]) {
  if (images.length === 0) return;

  const { error } = await supabase.from("images").insert(images);
  if (error) throw new Error(error.message);
}

export async function deleteHouseImageById(supabase: SupabaseClient, id: number) {
  const { error } = await supabase.from("images").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
