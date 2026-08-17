"use client";

import { FileTextIcon, HouseIcon, LogOutIcon, MegaphoneIcon, UsersIcon } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "../ui/sidebar";
import { TooltipProvider } from "../ui/tooltip";

export function AdminDesktopSidebar({
  canManageCentralUsers,
  canUseQuotation,
  signOutAction,
}: {
  canManageCentralUsers: boolean;
  canUseQuotation: boolean;
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
                <SidebarMenuButton
                  asChild
                  size="lg"
                  className="hover:bg-transparent hover:text-inherit active:bg-transparent active:text-inherit"
                >
                  <div>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <h1>WE</h1>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Webook</span>
                      <span className="truncate text-xs">ระบบจัดการบ้านพัก</span>
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
                {canUseQuotation ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/admin/quotations")}
                      tooltip="ใบเสนอราคา"
                    >
                      <Link href="/admin/quotations" onClick={closeMobileSidebar}>
                        <FileTextIcon data-icon="inline-start" />
                        <span>ใบเสนอราคา</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/admin/quotations"}>
                          <Link href="/admin/quotations" onClick={closeMobileSidebar}>
                            <FileTextIcon aria-hidden/>
                            <span>รายการใบเสนอราคา</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname.startsWith("/admin/quotations/customers")}>
                          <Link href="/admin/quotations/customers" onClick={closeMobileSidebar}>
                            <UsersIcon aria-hidden />
                            <span>ข้อมูลลูกค้า</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                ) : null}
                {canManageCentralUsers ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/admin/user-manager")}
                      tooltip="จัดการผู้ใช้"
                    >
                      <Link href="/admin/user-manager" onClick={closeMobileSidebar}>
                        <UsersIcon data-icon="inline-start" />
                        <span>จัดการผู้ใช้</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
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
