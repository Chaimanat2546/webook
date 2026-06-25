import type { ReactNode } from "react";

import { AdminShell } from "../../components/layout/admin-shell";
import { Card, CardContent } from "../../components/ui/card";
import { requireAdmin } from "../../server/auth/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthorized } = await requireAdmin();

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-sm text-center">
          <CardContent className="flex flex-col gap-2 p-5">
            <h1 className="text-lg font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
            <p className="text-sm text-muted-foreground">
              MVP นี้เปิดให้ Administrator เท่านั้น
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
