"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "../../../app/admin/notifications/actions";
import { usePwa } from "../../pwa/pwa-provider";
import { Button } from "../../ui/button";
import { useNotifications } from "./notifications-context";
import { currentPushSubscription, disablePushDevice, pushApplicationKey, reconcilePushDevice, storedPushActor, storePushActor, withTimeout } from "./push-device";

type PushState = "checking" | "unsupported" | "denied" | "not-configured" | "enabled" | "off" | "ios-install" | "cleanup-failed" | "unavailable";

export function PushSettings() {
  const notifications = useNotifications();
  const { installed } = usePwa();
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const actorId = notifications?.actorId;
  const publicKey = notifications?.data?.pushPublicKey;
  const configLoaded = !!notifications?.data;
  const inboxError = notifications?.error;

  useEffect(() => {
    let disposed = false;
    async function inspect() {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      let next: PushState;
      if (ios && !installed) next = "ios-install";
      else if (!window.isSecureContext || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else if (!configLoaded) next = inboxError ? "unavailable" : "checking";
      else {
        try {
          const subscription = await currentPushSubscription();
          next = subscription && storedPushActor() === actorId ? "enabled" : publicKey ? "off" : "not-configured";
        } catch { next = publicKey ? "off" : "not-configured"; }
      }
      if (!disposed) setState(next);
    }
    void inspect();
    return () => { disposed = true; };
  }, [installed, publicKey, actorId, configLoaded, inboxError]);

  async function enable() {
    if (!actorId || !publicKey) return;
    setBusy(true);
    let subscription: PushSubscription | null = null;
    try {
      // This is the only permission request; it runs directly from the opt-in click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const registration = await withTimeout(navigator.serviceWorker.ready);
      subscription = await withTimeout(registration.pushManager.getSubscription());
      subscription = await reconcilePushDevice(actorId, storedPushActor(), subscription, unsubscribePush);
      if (!subscription) subscription = await withTimeout(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationKey(publicKey) }));
      const value = subscription.toJSON();
      const result = await withTimeout(subscribePush({ endpoint: value.endpoint, keys: value.keys }));
      if (!result.ok) throw new Error("subscription failed");
      storePushActor(actorId);
      setState("enabled");
      toast.success("เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว");
    } catch {
      const cleanup = await disablePushDevice(currentPushSubscription, unsubscribePush);
      if (cleanup.state === "off") storePushActor(null);
      setState(cleanup.state);
      toast.error("เปิดแจ้งเตือนไม่สำเร็จ อุปกรณ์อาจยังไม่พร้อม กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const result = await disablePushDevice(currentPushSubscription, unsubscribePush);
      if (result.state === "off") storePushActor(null);
      setState(result.state);
      if (result.complete) toast.success("ปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว");
      else toast.error("ถอนการเชื่อมต่อได้ไม่ครบ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง");
    } catch { toast.error("ปิดแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  const message: Record<PushState, string> = {
    checking: "กำลังตรวจสอบการแจ้งเตือนบนอุปกรณ์นี้",
    unsupported: "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Push ยังดูการแจ้งเตือนในเว็บได้",
    denied: "เบราว์เซอร์บล็อกการแจ้งเตือน เปิดสิทธิ์ในการตั้งค่าเว็บไซต์ก่อนลองอีกครั้ง",
    "not-configured": "ระบบยังไม่ได้ตั้งค่า Push ยังดูการแจ้งเตือนในเว็บได้",
    enabled: "เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว",
    off: "ยังไม่ได้เปิดแจ้งเตือนบนอุปกรณ์นี้",
    "ios-install": "บน iPhone/iPad (iOS 16.4 ขึ้นไป) เปิดเมนูแชร์ เลือกเพิ่มไปยังหน้าจอโฮม แล้วเปิด WeBooks จากไอคอนเพื่อเปิด Push",
    "cleanup-failed": "ยังยืนยันไม่ได้ว่าปิด Push แล้ว กรุณาลองปิดอีกครั้ง",
    unavailable: "ยังตรวจสอบการตั้งค่า Push ไม่ได้ กรุณาลองโหลดการแจ้งเตือนอีกครั้ง",
  };
  return <div className="space-y-2"><p className="text-sm font-medium">แจ้งเตือนบนอุปกรณ์นี้</p><p className="text-xs text-muted-foreground" role="status">{message[state]}</p>{(state === "off" || state === "enabled" || state === "cleanup-failed") && <Button type="button" size="sm" variant="outline" disabled={busy || !actorId || (state === "off" && !publicKey)} onClick={() => { void (state === "off" ? enable() : disable()); }}>{busy ? "กำลังดำเนินการ…" : state === "off" ? "เปิดแจ้งเตือนบนอุปกรณ์นี้" : "ปิดแจ้งเตือนบนอุปกรณ์นี้"}</Button>}</div>;
}
