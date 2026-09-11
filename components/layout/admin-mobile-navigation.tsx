"use client";

import { Contact, FileText, House, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMobileNavigationMemory, isMobileWorkspace, mobileDestinations, mobileSection, mobileTitle, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { cn } from "../../lib/utils";
import { useSidebar } from "../ui/sidebar";

const icons = { houses: House, quotations: FileText, customers: Contact };

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
    <div className={cn("min-w-0 flex-1 px-4 py-5 md:px-6", !isMobileWorkspace(pathname) && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-5 print:pb-0")}>
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
        return (
          <Link key={item.id} href={visitedLists[item.href] ?? item.href}
            aria-current={selected ? "page" : undefined}
            onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (selected) event.preventDefault();
            }}
            className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring", selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="size-5" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" aria-haspopup="dialog" aria-expanded={openMobile}
        onClick={() => setOpenMobile(true)}
        className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring", active === "more" || openMobile ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
        <Menu className="size-5" aria-hidden />
        <span>เพิ่มเติม</span>
      </button>
    </nav>
  );
}
