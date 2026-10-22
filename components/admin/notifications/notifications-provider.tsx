"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { readNotifications, unsubscribePush } from "../../../app/admin/notifications/actions";
import type { NotificationPage } from "../../../lib/booking-notifications";
import { shouldRefreshNotifications, visibleNotificationPage } from "./inbox-state";
import { NotificationsContext } from "./notifications-context";
import { NotificationsSheet } from "./notifications-sheet";
import { cleanupPushDevice, currentPushSubscription, PUSH_ACTOR_STORAGE_KEY, storePushActor, withTimeout } from "./push-device";

export function NotificationsProvider({ children, actorId }: { children: ReactNode; actorId?: string }) {
  const [data, setData] = useState<NotificationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const request = useRef<AbortController | null>(null);
  const signedOut = useRef(false);
  const currentData = visibleNotificationPage(data, actorId);
  const currentActor = actorId ?? currentData?.actorId ?? null;

  const refresh = useCallback(async () => {
    if (signedOut.current || !shouldRefreshNotifications(document.visibilityState, navigator.onLine)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await withTimeout(fetch(`/api/notifications?page=${page}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }), 15_000);
      if (controller.signal.aborted || signedOut.current) return;
      if (response.status === 401 || response.status === 403) {
        setData(null);
        setError("กรุณาเข้าสู่ระบบอีกครั้งเพื่อดูการแจ้งเตือน");
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const next = await response.json() as NotificationPage;
      if (controller.signal.aborted || signedOut.current) return;
      if (actorId && next.actorId !== actorId) {
        setData(null);
        setError("บัญชีมีการเปลี่ยนแปลง กรุณาโหลดหน้าอีกครั้ง");
        return;
      }
      setData(next);
      setError(null);
    } catch {
      if (!controller.signal.aborted) setError("โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      controller.abort();
    }
  }, [actorId, page]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    const resume = () => { void refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== PUSH_ACTOR_STORAGE_KEY || event.newValue === currentActor) return;
      setData(null);
      void refresh();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("webook-notifications-refresh", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("storage", storage);
    return () => {
      request.current?.abort();
      clearTimeout(initialRefresh);
      clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("webook-notifications-refresh", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("storage", storage);
    };
  }, [refresh, currentActor]);

  async function cleanupDevice() {
    signedOut.current = true;
    request.current?.abort();
    setData(null);
    setOpen(false);
    try {
      return await cleanupPushDevice(await currentPushSubscription(), unsubscribePush);
    } catch { return false; }
    finally { storePushActor(null); }
  }

  async function markRead(input: { id: string } | { before: string }): Promise<boolean> {
    try {
      const result = await withTimeout(readNotifications(input));
      if (!result.ok) throw new Error("unavailable");
      await refresh();
      return true;
    } catch {
      toast.error("ทำเครื่องหมายอ่านไม่สำเร็จ กรุณาลองอีกครั้ง");
      return false;
    }
  }

  return <NotificationsContext.Provider value={{ data: currentData, actorId: currentActor, loading, error, open, setOpen, page, setPage, refresh, markRead, cleanupDevice }}>
    {children}
    <NotificationsSheet />
  </NotificationsContext.Provider>;
}
