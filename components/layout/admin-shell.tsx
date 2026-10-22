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
import { AdminMobileNavigationMemory } from "./admin-mobile-navigation-memory";
import { mobileNavigationLayout } from "../../lib/mobile-navigation";
import { AdminMobileContent, AdminMobileHeader, AdminMobileNavigation } from "./admin-mobile-navigation";
import { NotificationsProvider } from "../admin/notifications/notifications-provider";
import { NotificationBell } from "../admin/notifications/notification-bell";

export function AdminShell({
  canUseDashboard = false,
  canAccessHouses,
  canManageCentralUsers,
  canManageWebookUsers,
  canUseAccommodation,
  canUseBooking,
  canUseQuotation,
  children,
  defaultSidebarOpen = true,
  notificationActorId,
}: {
  canUseDashboard?: boolean;
  canAccessHouses: boolean;
  canManageCentralUsers: boolean;
  canManageWebookUsers: boolean;
  canUseAccommodation: boolean;
  canUseBooking: boolean;
  canUseQuotation: boolean;
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  notificationActorId?: string;
}) {
  const permissions = { canUseDashboard, canAccessHouses, canManageCentralUsers, canManageWebookUsers, canUseAccommodation, canUseBooking, canUseQuotation };
  const hasDock = mobileNavigationLayout(permissions).dock.length > 1;
  return (
    <NotificationsProvider key={notificationActorId ?? "notifications"} actorId={notificationActorId}>
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AdminMobileNavigationMemory>
      <AdminDesktopSidebar
        canUseDashboard={canUseDashboard}
        canAccessHouses={canAccessHouses}
        canManageCentralUsers={canManageCentralUsers}
        canManageWebookUsers={canManageWebookUsers}
        canUseAccommodation={canUseAccommodation}
        canUseBooking={canUseBooking}
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
          <div className="ml-auto"><NotificationBell /></div>
        </header>
        <AdminMobileHeader />

        <AdminMobileContent hasDock={hasDock}>
          <ConnectionStatus />
          {children}
        </AdminMobileContent>
      </SidebarInset>
      <AdminMobileNavigation {...permissions} />
      <Toaster />
      </AdminMobileNavigationMemory>
    </SidebarProvider>
    </NotificationsProvider>
  );
}
