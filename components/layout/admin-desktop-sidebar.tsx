"use client";

import { HouseIcon, LogOutIcon, MegaphoneIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import { TooltipProvider } from "../ui/tooltip";

export function AdminDesktopSidebar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg">
                  <div>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <HouseIcon />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Webook</span>
                      <span className="truncate text-xs">จัดการรูปบ้านพัก</span>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>เมนูหลัก</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/houses")}
                    tooltip="บ้านพัก"
                  >
                    <Link href="/admin/houses" onClick={closeMobileSidebar}>
                      <HouseIcon data-icon="inline-start" />
                      <span>บ้านพัก</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/advertisements")}
                    tooltip="โฆษณา"
                  >
                    <Link
                      href="/admin/advertisements"
                      onClick={closeMobileSidebar}
                    >
                      <MegaphoneIcon data-icon="inline-start" />
                      <span>โฆษณา</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <form action={signOutAction}>
                <SidebarMenuButton asChild tooltip="ออกจากระบบ">
                  <button type="submit">
                    <LogOutIcon data-icon="inline-start" />
                    <span>ออกจากระบบ</span>
                  </button>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
