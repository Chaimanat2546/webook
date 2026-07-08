"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canUseAccommodation, requireAdmin } from "../../../../server/auth/admin";
import {
  getListingByPropertyId,
  updateListingDetailsByPropertyId,
} from "../../../../server/repositories/listings";
import { normalizeListingDetailsFormValues } from "../../../../server/services/houses";

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

  const values = {
    ...normalizeListingDetailsFormValues(formData),
    owner_id: house.owner_id,
    rating: house.rating,
  };
  await updateListingDetailsByPropertyId(supabase, propertyId, values);

  revalidatePath("/admin/houses");
  revalidatePath(`/admin/houses/${encodeURIComponent(propertyId)}`);

  const params = new URLSearchParams({ saved: "1", section: "details" });
  const returnTo = getSafeReturnTo(formData);
  if (returnTo) params.set("returnTo", returnTo);

  redirect(`/admin/houses/${encodeURIComponent(propertyId)}?${params}`);
}
