"use client";

import { FileText, House, Megaphone, Menu, ShieldUser, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMobileNavigationMemory, isMobileWorkspace, mobileDestinations, mobileSection, mobileTitle, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { cn } from "../../lib/utils";
import { useSidebar } from "../ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const icons = { houses: House, advertisements: Megaphone, quotations: FileText, users: Users };
const tabClass = "flex min-h-18 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring";

export function AdminMobileHeader() {
  const pathname = usePathname();
  if (isMobileWorkspace(pathname)) return null;
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
    <div className={cn("min-w-0 flex-1 px-4 py-5 md:px-6", !isMobileWorkspace(pathname) && "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-5 print:pb-0")}>
      {children}
    </div>
  );
}

export function AdminMobileNavigation(permissions: MobileNavigationPermissions) {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  // In-memory only: never persist search terms/customer information to storage.
  const [memory] = useState(createMobileNavigationMemory);
  const visitedLists = useSyncExternalStore(memory.subscribe, memory.getSnapshot, memory.getServerSnapshot);
  const search = useSearchParams().toString();
  useEffect(() => { memory.remember(pathname, search); }, [memory, pathname, search]);
  const items = mobileDestinations(permissions);
  const active = mobileSection(pathname);
  if (isMobileWorkspace(pathname)) return null;
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
