import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { mobileDestinations, type MobileDestination, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { canAccessHouses, canManageCentralUsers, canManageWebookUsers, canUseAccommodation, canUseQuotation, requireAdmin } from "./admin";
import { requireBookingAdmin } from "./bookings";
import { canOpenDashboard } from "./dashboard";
import { bookingResult } from "../services/house-bookings";

/** Use the same server checks for landing, navigation and module entry. */
export const getAdminNavigationPermissions = cache(async (): Promise<MobileNavigationPermissions> => {
  const { adminUser } = await requireAdmin();
  const [canUseDashboard, bookingAccess] = await Promise.all([
    canOpenDashboard(),
    bookingResult(async () => { await requireBookingAdmin(); return true; }),
  ]);
  return {
    canUseDashboard,
    canUseBooking: bookingAccess.ok,
    canAccessHouses: canAccessHouses(adminUser),
    canUseAccommodation: canUseAccommodation(adminUser),
    canUseQuotation: canUseQuotation(adminUser),
    canManageCentralUsers: canManageCentralUsers(adminUser),
    canManageWebookUsers: canManageWebookUsers(adminUser),
  };
});

export async function requireAdminModule(module: MobileDestination["id"]) {
  const permissions = await getAdminNavigationPermissions();
  if (!mobileDestinations(permissions).some(item => item.id === module)) redirect("/");
}
