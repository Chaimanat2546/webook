import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import {
  canManageCentralUsers,
  canManageWebookUsers,
  canUseAccommodation,
  canUseQuotation,
  requireAdmin,
} from "../../server/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { adminUser } = await requireAdmin();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell
      canManageCentralUsers={canManageCentralUsers(adminUser)}
      canManageWebookUsers={canManageWebookUsers(adminUser)}
      canUseAccommodation={canUseAccommodation(adminUser)}
      canUseQuotation={canUseQuotation(adminUser)}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AdminShell>
  );
}
