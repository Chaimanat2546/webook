import type { ReactNode } from "react";

import { signOut } from "../../app/login/actions";
import { AdminDesktopSidebar } from "./admin-desktop-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { Separator } from "../ui/separator";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AdminDesktopSidebar signOutAction={signOut} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger aria-label="เปิด/ปิดเมนู" />
          <Separator className="h-4" orientation="vertical" />
          <div className="flex flex-col">
            <p className="text-sm font-medium">VillaAdmin</p>
            <p className="text-xs text-muted-foreground">จัดการรูปบ้านพัก</p>
          </div>
        </header>

        <div className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
