import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import { requireBookingAdmin } from "../../server/auth/bookings";
import { bookingResult } from "../../server/services/house-bookings";
import {
  canAccessHouses,
  canManageCentralUsers,
  canManageWebookUsers,
  canUseAccommodation,
  canUseQuotation,
  requireAdmin,
} from "../../server/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { adminUser } = await requireAdmin();
  const bookingAccess = await bookingResult(async () => {
    await requireBookingAdmin();
    return true;
  });
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell
      canAccessHouses={canAccessHouses(adminUser)}
      canManageCentralUsers={canManageCentralUsers(adminUser)}
      canManageWebookUsers={canManageWebookUsers(adminUser)}
      canUseAccommodation={canUseAccommodation(adminUser)}
      canUseBooking={bookingAccess.ok}
      canUseQuotation={canUseQuotation(adminUser)}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AdminShell>
  );
}
