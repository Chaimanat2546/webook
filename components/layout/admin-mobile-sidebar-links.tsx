"use client";

import Link from "next/link";
import { CalendarDays, Contact, FileText, House, LayoutDashboard, Megaphone, ShieldUser, Users } from "lucide-react";
import { mobileNavigationLayout, mobileSection, type MobileNavigationPermissions } from "../../lib/mobile-navigation";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { useMobileNavigationLists } from "./admin-mobile-navigation-memory";

const icons = { overview: LayoutDashboard, bookings: CalendarDays, houses: House, advertisements: Megaphone, quotations: FileText, centralUsers: Users, webookUsers: ShieldUser };

export function AdminMobileSidebarLinks({ permissions, pathname, onNavigate }: { permissions: MobileNavigationPermissions; pathname: string; onNavigate: () => void }) {
  const { modules, overflow } = mobileNavigationLayout(permissions);
  const items = modules.length === 1 && pathname !== modules[0].href ? modules : overflow;
  const visitedLists = useMobileNavigationLists();
  return <>
    {items.map(item => {
      const Icon = icons[item.id];
      return <SidebarMenuItem key={item.id}><SidebarMenuButton asChild isActive={mobileSection(pathname) === item.id}><Link href={visitedLists[item.href] ?? item.href} onClick={onNavigate}><Icon data-icon="inline-start" /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>;
    })}
    {permissions.canUseQuotation && <SidebarMenuItem><SidebarMenuButton asChild isActive={pathname === "/admin/quotations/customers"}><Link href={visitedLists["/admin/quotations/customers"] ?? "/admin/quotations/customers"} onClick={onNavigate}><Contact data-icon="inline-start" /><span>ข้อมูลลูกค้า</span></Link></SidebarMenuButton></SidebarMenuItem>}
  </>;
}
