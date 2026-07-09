"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canManageHouseRating,
  canUseAccommodation,
  requireAdmin,
} from "../../../../server/auth/admin";
import {
  getFacilities,
  getListingByPropertyId,
  updateListingDetailsByPropertyId,
  updateListingFacilitiesByListingId,
  updateListingPricesByListingId,
} from "../../../../server/repositories/listings";
import {
  normalizeListingFacilityFormValues,
  normalizeListingDetailsFormValues,
  normalizeListingPriceFormValues,
} from "../../../../server/services/houses";

function assertCanUseAccommodation(isAllowed: boolean): void {
  if (!isAllowed) throw new Error("Unauthorized");
}

function getSafeReturnTo(formData: FormData): string | null {
  const value = formData.get("returnTo");
  if (typeof value !== "string") return null;
  if (value === "/admin/houses" || value.startsWith("/admin/houses?")) return value;
  return null;
}

export async function saveHouseDetailsAction(propertyId: string, formData: FormData): Promise<never> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(canUseAccommodation(adminUser));

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const canManageRating = canManageHouseRating(adminUser);
  const normalizedValues = normalizeListingDetailsFormValues(formData);
  const values = {
    ...normalizedValues,
    owner_id: house.owner_id,
    rating: canManageRating ? normalizedValues.rating : house.rating,
  };
  await updateListingDetailsByPropertyId(supabase, propertyId, values);

  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}`);

  const params = new URLSearchParams({ saved: "1", section: "details" });
  const returnTo = getSafeReturnTo(formData);
  if (returnTo) params.set("returnTo", returnTo);

  redirect(`/admin/houses/${encodeURIComponent(propertyId)}?${params}`);
}

export async function saveHouseFacilitiesAction(propertyId: string, formData: FormData): Promise<never> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(canUseAccommodation(adminUser));

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const facilities = await getFacilities(supabase);
  const values = normalizeListingFacilityFormValues(formData, facilities);
  await updateListingFacilitiesByListingId(supabase, house.id, values);

  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}`);

  const params = new URLSearchParams({ saved: "1", section: "facilities" });
  const returnTo = getSafeReturnTo(formData);
  if (returnTo) params.set("returnTo", returnTo);

  redirect(`/admin/houses/${encodeURIComponent(propertyId)}?${params}`);
}

export async function saveHousePricesAction(propertyId: string, formData: FormData): Promise<never> {
  const { adminUser, supabase } = await requireAdmin();
  assertCanUseAccommodation(canUseAccommodation(adminUser));

  const house = await getListingByPropertyId(supabase, propertyId);
  if (!house) throw new Error("House not found");

  const values = normalizeListingPriceFormValues(formData);
  await updateListingPricesByListingId(supabase, house.id, values);

  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}`);

  const params = new URLSearchParams({ saved: "1", section: "prices" });
  const returnTo = getSafeReturnTo(formData);
  if (returnTo) params.set("returnTo", returnTo);

  redirect(`/admin/houses/${encodeURIComponent(propertyId)}?${params}`);
}
