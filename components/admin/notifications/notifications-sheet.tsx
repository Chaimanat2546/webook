"use client";

import { Bell } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { useNotifications } from "./notifications-context";
import { NotificationsInbox } from "./notifications-inbox";

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
    <SheetContent className="w-full! max-w-lg! gap-0 pb-[env(safe-area-inset-bottom)] print:hidden">
      <SheetHeader className="border-b pr-14"><SheetTitle className="flex items-center gap-2 text-xl"><Bell aria-hidden className="size-5" />การแจ้งเตือน</SheetTitle><SheetDescription className="sr-only">รายการการจองและการเปลี่ยนสถานะที่คุณมีสิทธิ์ดู</SheetDescription></SheetHeader>
      <NotificationsInbox />
    </SheetContent>
  </Sheet>;
}
