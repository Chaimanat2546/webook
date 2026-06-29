import type { ReactNode } from "react";

import { AdminShell } from "../../components/layout/admin-shell";
import { requireAdmin } from "../../server/auth/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
