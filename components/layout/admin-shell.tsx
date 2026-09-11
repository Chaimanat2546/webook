import type { ReactNode } from "react";

import { signOut } from "../../app/login/actions";
import { AdminDesktopSidebar } from "./admin-desktop-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { Separator } from "../ui/separator";
import { Toaster } from "../ui/sonner";
import { ConnectionStatus } from "../pwa/connection-status";
import { AdminMobileContent, AdminMobileHeader, AdminMobileNavigation } from "./admin-mobile-navigation";

export function AdminShell({
  canAccessHouses,
  canManageCentralUsers,
  canManageWebookUsers,
  canUseAccommodation,
  canUseQuotation,
  children,
  defaultSidebarOpen = true,
}: {
  canAccessHouses: boolean;
  canManageCentralUsers: boolean;
  canManageWebookUsers: boolean;
  canUseAccommodation: boolean;
  canUseQuotation: boolean;
  children: ReactNode;
  defaultSidebarOpen?: boolean;
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AdminDesktopSidebar
        canAccessHouses={canAccessHouses}
        canManageCentralUsers={canManageCentralUsers}
        canManageWebookUsers={canManageWebookUsers}
        canUseAccommodation={canUseAccommodation}
        canUseQuotation={canUseQuotation}
        signOutAction={signOut}
      />
      <SidebarInset>
        <header className="hidden h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:flex">
          <SidebarTrigger aria-label="เปิด/ปิดเมนู" />
          <Separator className="h-4" orientation="vertical" />
          <div className="flex flex-col">
            <p className="text-sm font-medium">WeBooks</p>
            <p className="text-xs text-muted-foreground">ระบบจัดการบ้านพัก</p>
          </div>
        </header>
        <AdminMobileHeader />

        <AdminMobileContent>
          <ConnectionStatus />
          {children}
        </AdminMobileContent>
      </SidebarInset>
      <AdminMobileNavigation canAccessHouses={canAccessHouses} canUseQuotation={canUseQuotation} canUseAccommodation={canUseAccommodation} canManageCentralUsers={canManageCentralUsers} canManageWebookUsers={canManageWebookUsers} />
      <Toaster />
    </SidebarProvider>
  );
}
