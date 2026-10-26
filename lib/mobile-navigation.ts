export interface MobileNavigationPermissions {
  canUseDashboard: boolean;
  canAccessHouses: boolean;
  canUseBooking: boolean;
  canUseQuotation: boolean;
  canUseAccommodation: boolean;
  canManageCentralUsers: boolean;
  canManageWebookUsers: boolean;
}

export interface MobileDestination {
  id: "overview" | "houses" | "bookings" | "advertisements" | "quotations" | "centralUsers" | "webookUsers";
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
      if (!["/admin/dashboard", "/admin/houses", "/admin/bookings", "/admin/advertisements", "/admin/quotations", "/admin/quotations/customers", "/admin/users", "/admin/user-manager"].includes(pathname)) return;
      const href = `${pathname}${search ? `?${search}` : ""}`;
      if (snapshot[pathname] === href) return;
      snapshot = { ...snapshot, [pathname]: href };
      listeners.forEach(listener => listener());
    },
  };
}

export function mobileDestinations(permissions: MobileNavigationPermissions): MobileDestination[] {
  const items: MobileDestination[] = [];
  if (permissions.canUseDashboard) items.push({ id: "overview", label: "ภาพรวม", href: "/admin/dashboard" });
  if (permissions.canUseBooking) items.push({ id: "bookings", label: "การจอง", href: "/admin/bookings" });
  if (permissions.canAccessHouses) items.push({ id: "houses", label: "บ้านพัก", href: "/admin/houses" });
  if (permissions.canUseAccommodation) items.push({ id: "advertisements", label: "โฆษณา", href: "/admin/advertisements" });
  if (permissions.canUseQuotation) items.push(
    { id: "quotations", label: "ใบเสนอราคา", href: "/admin/quotations" },
  );
  if (permissions.canManageCentralUsers) items.push({ id: "centralUsers", label: "ผู้ใช้เว็บไซต์", href: "/admin/user-manager" });
  if (permissions.canManageWebookUsers) items.push({ id: "webookUsers", label: "ผู้ใช้ WeBooks", href: "/admin/users" });
  return items;
}

export function mobileNavigationLayout(permissions: MobileNavigationPermissions) {
  const modules = mobileDestinations(permissions);
  return { modules, dock: modules.length > 1 ? modules.slice(0, 3) : [], overflow: modules.slice(3) };
}

export function mobileSection(pathname: string): MobileDestination["id"] | "more" {
  if (pathname === "/admin/dashboard" || pathname.startsWith("/admin/dashboard/")) return "overview";
  if (["/admin/bookings"].some(path => pathname === path || pathname.startsWith(`${path}/`))) return "bookings";
  if (pathname === "/admin/advertisements" || pathname.startsWith("/admin/advertisements/")) return "advertisements";
  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) return "webookUsers";
  if (pathname === "/admin/user-manager" || pathname.startsWith("/admin/user-manager/")) return "centralUsers";
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
    "/admin/login-history": "ประวัติการเข้าสู่ระบบ",
    "/admin/dashboard": "แดชบอร์ด",
    "/admin/houses": "บ้านพัก",
    "/admin/bookings": "การจอง",
    "/admin/quotations": "ใบเสนอราคา",
    "/admin/quotations/customers": "ลูกค้า",
    "/admin/advertisements": "โฆษณา",
    "/admin/users": "ผู้ใช้ WeBooks",
    "/admin/user-manager": "ผู้ใช้เว็บไซต์",
  };
  return titles[pathname] ?? "WeBooks";
}
