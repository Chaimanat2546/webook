"use client";

import { Bell } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "../../ui/sidebar";
import { notificationCountLabel } from "./inbox-state";
import { useNotifications } from "./notifications-context";

export function NotificationBell({ sidebar = false, onOpen }: { sidebar?: boolean; onOpen?: () => void }) {
  const notifications = useNotifications();
  if (!notifications) return null;
  const count = notifications.data?.unreadCount ?? null;
  const badge = notificationCountLabel(count);
  const label = count === null ? "การแจ้งเตือน ยังไม่ทราบจำนวนที่ยังไม่อ่าน" : `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ`;
  const open = () => { onOpen?.(); notifications.setOpen(true); };
  const content = <><Bell aria-hidden className="size-5" /><span className={sidebar ? "truncate" : "sr-only"}>การแจ้งเตือน</span>{badge && <Badge className={sidebar ? "ml-auto" : "absolute -right-1 -top-1 min-w-4 px-1 text-[10px]"} aria-hidden>{badge}</Badge>}</>;
  if (sidebar) return <SidebarMenuItem className="print:hidden"><SidebarMenuButton type="button" tooltip="การแจ้งเตือน" aria-label={label} aria-haspopup="dialog" aria-expanded={notifications.open} onClick={open}>{content}</SidebarMenuButton></SidebarMenuItem>;
  return <Button type="button" variant="ghost" size="icon-lg" className="relative shrink-0 print:hidden" aria-label={label} aria-haspopup="dialog" aria-expanded={notifications.open} onClick={open}>{content}</Button>;
}
