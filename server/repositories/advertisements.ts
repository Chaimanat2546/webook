import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdvertisementImageRow {
  advertisement_id: string;
  created_at: string | null;
  id: string;
  image_name: string;
  image_order: number;
  updated_at: string | null;
}

export interface AdvertisementRow {
  advertisement_images?: AdvertisementImageRow[];
  created_at: string | null;
  id: string;
  is_active: boolean;
  title: string;
  updated_at: string | null;
}

export interface AdvertisementImageInsert {
  advertisement_id: string;
  image_name: string;
  image_order: number;
}

const advertisementSelect =
  "id,title,is_active,created_at,updated_at,advertisement_images(id,advertisement_id,image_name,image_order,created_at,updated_at)";

export async function getAdvertisements(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("advertisements")
    .select(advertisementSelect)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdvertisementRow[];
}

export async function getAdvertisementById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("advertisements")
    .select(advertisementSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AdvertisementRow | null;
}

export async function getAdvertisementImageById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("advertisement_images")
    .select("id,advertisement_id,image_name,image_order,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AdvertisementImageRow | null;
}

export async function getAdvertisementImages(supabase: SupabaseClient, advertisementId: string) {
  const { data, error } = await supabase
    .from("advertisement_images")
    .select("id,advertisement_id,image_name,image_order,created_at,updated_at")
    .eq("advertisement_id", advertisementId)
    .order("image_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdvertisementImageRow[];
}

export async function insertAdvertisementWithImages(
  supabase: SupabaseClient,
  {
    id,
    images,
    isActive,
    title,
  }: {
    id: string;
    images: AdvertisementImageInsert[];
    isActive: boolean;
    title: string;
  },
) {
  const { error: advertisementError } = await supabase
    .from("advertisements")
    .insert({ id, is_active: isActive, title });

  if (advertisementError) throw new Error(advertisementError.message);

  const { error: imageError } = await supabase.from("advertisement_images").insert(images);
  if (imageError) {
    await supabase.from("advertisements").delete().eq("id", id);
    throw new Error(imageError.message);
  }
}

export async function updateAdvertisement(
  supabase: SupabaseClient,
  id: string,
  values: { isActive: boolean; title: string },
) {
  const { error } = await supabase
    .from("advertisements")
    .update({
      is_active: values.isActive,
      title: values.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function insertAdvertisementImages(
  supabase: SupabaseClient,
  images: AdvertisementImageInsert[],
) {
  if (images.length === 0) return;

  const { error } = await supabase.from("advertisement_images").insert(images);
  if (error) throw new Error(error.message);
}

export async function deleteAdvertisementImageById(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("advertisement_images").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateAdvertisementImageOrder(
  supabase: SupabaseClient,
  id: string,
  imageOrder: number,
) {
  const { error } = await supabase
    .from("advertisement_images")
    .update({ image_order: imageOrder, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
