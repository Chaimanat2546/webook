import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import { getAdminNavigationPermissions } from "../../server/auth/admin-navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const permissions = await getAdminNavigationPermissions();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell
      {...permissions}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AdminShell>
  );
}
