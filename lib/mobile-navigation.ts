export interface MobileNavigationPermissions {
  canAccessHouses: boolean;
  canUseQuotation: boolean;
  canUseAccommodation: boolean;
  canManageCentralUsers: boolean;
  canManageWebookUsers: boolean;
}

export interface MobileDestination {
  id: "houses" | "advertisements" | "quotations" | "users";
  label: string;
  href: string;
}

export function createMobileNavigationMemory() {
  const empty: Readonly<Record<string, string>> = {};
  let snapshot = empty;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    remember(pathname: string, search: string) {
      if (!["/admin/houses", "/admin/advertisements", "/admin/quotations", "/admin/quotations/customers", "/admin/users", "/admin/user-manager"].includes(pathname)) return;
      const href = `${pathname}${search ? `?${search}` : ""}`;
      if (snapshot[pathname] === href) return;
      snapshot = { ...snapshot, [pathname]: href };
      listeners.forEach(listener => listener());
    },
  };
}

export function mobileDestinations(permissions: MobileNavigationPermissions): MobileDestination[] {
  const items: MobileDestination[] = [];
  if (permissions.canAccessHouses) items.push({ id: "houses", label: "บ้านพัก", href: "/admin/houses" });
  if (permissions.canUseAccommodation) items.push({ id: "advertisements", label: "โฆษณา", href: "/admin/advertisements" });
  if (permissions.canUseQuotation) items.push(
    { id: "quotations", label: "ใบเสนอราคา", href: "/admin/quotations" },
  );
  if (permissions.canManageCentralUsers || permissions.canManageWebookUsers) items.push({ id: "users", label: "ผู้ใช้", href: permissions.canManageCentralUsers ? "/admin/user-manager" : "/admin/users" });
  return items;
}

export function mobileSection(pathname: string): MobileDestination["id"] | "more" {
  if (pathname === "/admin/advertisements" || pathname.startsWith("/admin/advertisements/")) return "advertisements";
  if (["/admin/users", "/admin/user-manager"].some(path => pathname === path || pathname.startsWith(`${path}/`))) return "users";
  if (pathname === "/admin/houses" || pathname.startsWith("/admin/houses/")) return "houses";
  if (pathname === "/admin/quotations" || pathname.startsWith("/admin/quotations/")) return "quotations";
  return "more";
}

export function isMobileWorkspace(pathname: string): boolean {
  if (pathname === "/admin/quotations/customers") return false;
  return ["/admin/houses/", "/admin/quotations/", "/admin/advertisements/", "/admin/users/"].some(prefix => pathname.startsWith(prefix));
}

export function mobileTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/admin/houses": "บ้านพัก",
    "/admin/quotations": "ใบเสนอราคา",
    "/admin/quotations/customers": "ลูกค้า",
    "/admin/advertisements": "โฆษณา",
    "/admin/users": "ผู้ใช้ WeBooks",
    "/admin/user-manager": "ผู้ใช้เว็บไซต์",
  };
  return titles[pathname] ?? "WeBooks";
}
