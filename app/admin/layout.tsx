import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AdminShell } from "../../components/layout/admin-shell";
import { requireAdmin } from "../../server/auth/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return <AdminShell defaultSidebarOpen={defaultSidebarOpen}>{children}</AdminShell>;
}
