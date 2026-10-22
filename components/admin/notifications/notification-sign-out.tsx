"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarMenuButton } from "../../ui/sidebar";
import { useNotifications } from "./notifications-context";
import { runNotificationSignOut } from "./push-device";

export function NotificationSignOut({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const notifications = useNotifications();
  const [pending, setPending] = useState(false);
  return <form action={async () => {
    setPending(true);
    try {
      await runNotificationSignOut(() => notifications?.cleanupDevice() ?? Promise.resolve(true), signOutAction, () => toast.error("ถอน Push บนอุปกรณ์ได้ไม่ครบ ระบบจะออกจากบัญชีต่อ"));
    } finally { setPending(false); }
  }}><SidebarMenuButton asChild tooltip="ออกจากระบบ"><button type="submit" disabled={pending}><LogOutIcon data-icon="inline-start" /><span>{pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</span></button></SidebarMenuButton></form>;
}
