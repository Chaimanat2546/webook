import type { ReactNode } from "react";
import { requireAdminModule } from "../../../server/auth/admin-navigation";

export default async function ModuleLayout({ children }: { children: ReactNode }) {
  await requireAdminModule("houses");
  return children;
}
