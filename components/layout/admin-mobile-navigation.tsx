"use client";

import { CalendarDays, FileText, House, LayoutDashboard, Megaphone, Menu, ShieldUser, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { isMobileWorkspace, mobileNavigationLayout, mobileSection, mobileTitle, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { cn } from "../../lib/utils";
import { useSidebar } from "../ui/sidebar";
import { AdminPageContainer } from "./admin-page-container";
import { useMobileNavigationLists } from "./admin-mobile-navigation-memory";
import { AdminMobileBrandHeader } from "./admin-mobile-brand-header";
import { NotificationBell } from "../admin/notifications/notification-bell";

const icons = { overview: LayoutDashboard, houses: House, bookings: CalendarDays, advertisements: Megaphone, quotations: FileText, centralUsers: Users, webookUsers: ShieldUser };


export function AdminMobileHeader() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { setOpenMobile } = useSidebar();
  if (isMobileWorkspace(pathname)) return null;
  if (pathname === "/admin/dashboard/websites" && search.get("view") !== "houses") return null;
  if (pathname === "/admin/dashboard/houses") return <AdminMobileBrandHeader subtitle="บ้านใหม่" />;
  if (pathname === "/admin/dashboard/agencies") return <AdminMobileBrandHeader subtitle="ยอดขายเอเจนซี่" />;
  if (pathname === "/admin/dashboard/bookings") return <AdminMobileBrandHeader subtitle="รายการจอง" />;
  if (pathname === "/admin/dashboard") return <AdminMobileBrandHeader subtitle="ภาพรวมธุรกิจ" />;
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden">
      <button type="button" aria-label="เปิดเมนูหลัก" onClick={() => setOpenMobile(true)} className="flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2"><Menu aria-hidden className="size-5" /></button>
      <p className="min-w-0 flex-1 text-base font-semibold">{mobileTitle(pathname)}</p>
      <NotificationBell />
    </header>
  );
}

export function AdminMobileContent({ children, hasDock = true }: { children: ReactNode; hasDock?: boolean }) {
  const pathname = usePathname();
  return (
    <div className={cn("min-w-0 flex-1 px-4 py-5 md:px-6", (pathname === "/admin/dashboard" || pathname === "/admin/dashboard/bookings") && "max-md:bg-background dark:max-md:bg-background", hasDock && !isMobileWorkspace(pathname) && "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-5 print:pb-0")}>
      <AdminPageContainer>{children}</AdminPageContainer>
    </div>
  );
}

export function AdminMobileNavigation(permissions: MobileNavigationPermissions) {
  const pathname = usePathname();
  const visitedLists = useMobileNavigationLists();
  const { dock: items } = mobileNavigationLayout(permissions);
  const active = mobileSection(pathname);
  if (isMobileWorkspace(pathname) || items.length < 2) return null;
  return (
    <nav aria-label="เมนูหลักบนมือถือ" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md overflow-hidden rounded-2xl bg-[#084860] shadow-lg md:hidden print:hidden">
      {items.map(item => {
        const Icon = icons[item.id];
        const selected = active === item.id;
        return (
          <Link key={item.id} href={visitedLists[item.href] ?? item.href}
            aria-current={selected ? "page" : undefined}
            onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (pathname === item.href) event.preventDefault();
            }}
            className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white", selected ? "bg-[#087F80] text-white" : "text-[#B6D0D9] hover:bg-white/10")}>
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
