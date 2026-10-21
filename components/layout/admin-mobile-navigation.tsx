"use client";

import { CalendarDays, FileText, House, Megaphone, LayoutDashboard, Menu, MoreHorizontal, ShieldUser, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMobileNavigationMemory, isMobileWorkspace, mobileDestinations, mobileSection, mobileTitle, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { cn } from "../../lib/utils";
import { useSidebar } from "../ui/sidebar";
import { AdminPageContainer } from "./admin-page-container";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const icons = { houses: House, bookings: CalendarDays, advertisements: Megaphone, quotations: FileText, users: Users };
const tabClass = "flex min-h-18 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring";

export function AdminMobileHeader() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  if (isMobileWorkspace(pathname)) return null;
  if (pathname === "/admin/dashboard/bookings") return <header className="flex min-h-16 items-center border-b bg-background px-5 pt-[env(safe-area-inset-top)] dark:bg-background md:hidden print:hidden"><p className="text-xl font-bold">WeBooks</p></header>;
  if (pathname === "/admin/dashboard") return <header className="flex min-h-16 items-center gap-4 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden"><button type="button" aria-label="เปิดเมนูหลัก" onClick={() => setOpenMobile(true)} className="flex size-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-2"><Menu aria-hidden className="size-5" /></button><span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">WB</span><div className="min-w-0 flex-1"><p className="text-lg font-semibold leading-tight text-primary">WeBooks</p><p className="text-[11px] text-muted-foreground">ภาพรวมธุรกิจ</p></div><time className="shrink-0 rounded-full bg-muted px-3 py-1 text-[11px] font-medium" dateTime={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })}>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date())}</time></header>;
  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden">
      <p className="text-base font-semibold">{mobileTitle(pathname)}</p>
      <span className="text-xs text-muted-foreground">WeBooks</span>
    </header>
  );
}

export function AdminMobileContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={cn("min-w-0 flex-1 px-4 py-5 md:px-6", (pathname === "/admin/dashboard" || pathname === "/admin/dashboard/bookings") && "max-md:bg-background dark:max-md:bg-background", !isMobileWorkspace(pathname) && "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-5 print:pb-0")}>
      <AdminPageContainer>{children}</AdminPageContainer>
    </div>
  );
}

export function AdminMobileNavigation(permissions: MobileNavigationPermissions & { canUseDashboard?: boolean }) {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  // In-memory only: never persist search terms/customer information to storage.
  const [memory] = useState(createMobileNavigationMemory);
  const visitedLists = useSyncExternalStore(memory.subscribe, memory.getSnapshot, memory.getServerSnapshot);
  const search = useSearchParams().toString();
  useEffect(() => { memory.remember(pathname, search); }, [memory, pathname, search]);
  const items = mobileDestinations(permissions);
  const active = mobileSection(pathname);
  if (isMobileWorkspace(pathname) || pathname === "/admin/dashboard") return null;
  if (pathname === "/admin/dashboard/bookings") {
    const dashboardItems = [
      ...(permissions.canUseDashboard ? [{ label: "แดชบอร์ด", href: "/admin/dashboard", icon: LayoutDashboard }] : []),
      { label: "การจอง", href: `${pathname}${search ? `?${search}` : ""}`, icon: CalendarDays },
      ...(permissions.canAccessHouses ? [{ label: "บ้านพัก", href: visitedLists["/admin/houses"] ?? "/admin/houses", icon: House }] : []),
      ...(permissions.canUseAccommodation ? [{ label: "โฆษณา", href: visitedLists["/admin/advertisements"] ?? "/admin/advertisements", icon: Megaphone }] : []),
    ];
    return <nav aria-label="เมนูหลักบนมือถือ" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t bg-background px-2 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      {dashboardItems.map(({ label, href, icon: Icon }) => <Link key={label} href={href} aria-current={label === "การจอง" ? "page" : undefined} className="flex min-h-18 min-w-0 flex-1 items-center justify-center focus-visible:outline-2"><span className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-full px-1.5 py-2 text-[10px] whitespace-nowrap", label === "การจอง" ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground")}><Icon aria-hidden className="size-5" />{label}</span></Link>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={openMobile} onClick={() => setOpenMobile(true)} className="flex min-h-18 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground focus-visible:outline-2"><MoreHorizontal aria-hidden className="size-5" />เพิ่มเติม</button>
    </nav>;
  }
  return (
    <nav aria-label="เมนูหลักบนมือถือ" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_#00000008] md:hidden print:hidden">
      {items.map(item => {
        const Icon = icons[item.id];
        const selected = active === item.id;
        if (item.id === "users") return (
          <DropdownMenu key={item.id}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-current={selected ? "page" : undefined} className={cn(tabClass, selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}><Users className="size-6" aria-hidden /><span>ผู้ใช้</span></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-52">
              {permissions.canManageCentralUsers && <DropdownMenuItem asChild className="min-h-11"><Link href={visitedLists["/admin/user-manager"] ?? "/admin/user-manager"}><Users aria-hidden />ผู้ใช้เว็บไซต์</Link></DropdownMenuItem>}
              {permissions.canManageWebookUsers && <DropdownMenuItem asChild className="min-h-11"><Link href={visitedLists["/admin/users"] ?? "/admin/users"}><ShieldUser aria-hidden />ผู้ใช้ WeBooks</Link></DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        );
        return (
          <Link key={item.id} href={visitedLists[item.href] ?? item.href}
            aria-current={selected ? "page" : undefined}
            onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (pathname === item.href) event.preventDefault();
            }}
            className={cn("flex min-h-18 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring", selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="size-6" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" aria-haspopup="dialog" aria-expanded={openMobile}
        onClick={() => setOpenMobile(true)}
        className={cn("flex min-h-18 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring", active === "more" || openMobile ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
        <Menu className="size-6" aria-hidden />
        <span>เพิ่มเติม</span>
      </button>
    </nav>
  );
}
