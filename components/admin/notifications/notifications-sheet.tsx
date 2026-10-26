"use client";

import { Bell, X } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { Button } from "../../ui/button";
import { useNotifications } from "./notifications-context";
import { NotificationsInbox } from "./notifications-inbox";
import { NotificationsSettings } from "./notifications-settings";

export function NotificationsSheet() {
  const notifications = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const open = notifications?.open ?? false;
  const setOpen = notifications?.setOpen;
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(max-width: 767px)");
    const navigate = () => {
      if (!media.matches) return;
      setOpen?.(false); router.push("/admin/notifications");
    };
    navigate(); media.addEventListener("change", navigate);
    return () => media.removeEventListener("change", navigate);
  }, [open, router, setOpen]);
  if (!notifications || pathname === "/admin/notifications") return null;
  return <Sheet open={open} onOpenChange={notifications.setOpen}>
    <SheetContent showCloseButton={false} className="w-full! max-w-lg! gap-0 pb-[env(safe-area-inset-bottom)] print:hidden">
      <SheetHeader className="h-14 flex-row items-center justify-between gap-2 border-b px-4 py-1.5">
        <SheetTitle className="flex items-center gap-2 text-lg"><Bell aria-hidden className="size-5" />การแจ้งเตือน</SheetTitle>
        <SheetDescription className="sr-only">รายการการจองและการเปลี่ยนสถานะที่คุณมีสิทธิ์ดู</SheetDescription>
        <div className="ml-auto flex items-center gap-1">
          <NotificationsSettings />
          <SheetClose asChild><Button type="button" variant="ghost" size="icon" className="size-11" aria-label="ปิดการแจ้งเตือน"><X aria-hidden /></Button></SheetClose>
        </div>
      </SheetHeader>
      <NotificationsInbox active={open} surface="sheet" />
    </SheetContent>
  </Sheet>;
}
