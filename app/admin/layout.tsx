import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import {
  canManageCentralUsers,
  canUseQuotation,
  requireAdmin,
} from "../../server/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { adminUser, byUid } = await requireAdmin();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell
      canUseQuotation={canUseQuotation(adminUser)}
      canManageCentralUsers={canManageCentralUsers(byUid)}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AdminShell>
  );
}
