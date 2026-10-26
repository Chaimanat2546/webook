"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { readNotifications } from "../../../app/admin/notifications/actions";
import { withTimeout } from "./push-device";

/** An authorized detail view reads only its own item; GET/prefetch stays read-only. */
export function NotificationReadMarker({ id, read, actorId, href }: { id: string; read: boolean; actorId: string; href?: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let attempted = false;
    async function mark() {
      if (!active || attempted || document.visibilityState !== "visible") return;
      attempted = true;
      try {
        if (read) return;
        const result = await withTimeout(readNotifications({ id }, actorId));
        if (!active) return;
        if (result.ok) window.dispatchEvent(new Event("webook-notifications-refresh"));
        else toast.error("ไม่สามารถบันทึกสถานะอ่านได้ กรุณาลองเปิดรายการอีกครั้ง");
      } catch {
        if (active) toast.error("ไม่สามารถบันทึกสถานะอ่านได้ กรุณาลองเปิดรายการอีกครั้ง");
      } finally {
        if (active && href) router.replace(href);
      }
    }
    // Deferral avoids duplicate actions from Strict Mode's mount/cleanup cycle.
    const timer = window.setTimeout(() => { void mark(); }, 0);
    const onVisible = () => { void mark(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [id, read, actorId, href, router]);
  return null;
}
