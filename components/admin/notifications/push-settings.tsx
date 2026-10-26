"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "../../../app/admin/notifications/actions";
import { usePwa } from "../../pwa/pwa-provider";
import { Button } from "../../ui/button";
import { useNotifications } from "./notifications-context";
import { cleanupPushDevice, currentPushSubscription, optOutPushDevice, pushApplicationKey, pushConsentRevision, reconcilePushDevice, storedPushActor, storePushActor, withPushDeviceLock, withTimeout } from "./push-device";
import { synchronizeCurrentPushDevice } from "./push-sync";

type PushState = "checking" | "unsupported" | "denied" | "not-configured" | "enabled" | "off" | "ios-install" | "cleanup-failed" | "unavailable";

export function PushSettings() {
  const notifications = useNotifications();
  const { installed } = usePwa();
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [inspection, setInspection] = useState(0);
  const [canDisable, setCanDisable] = useState(false);
  const actorId = notifications?.actorId;
  const publicKey = notifications?.data?.pushPublicKey;
  const configLoaded = !!notifications?.data;
  const inboxError = notifications?.error;

  useEffect(() => {
    let disposed = false;
    async function inspect() {
      if (busy) return;
      setState("checking");
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      let next: PushState;
      if (ios && !installed) next = "ios-install";
      else if (!window.isSecureContext || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        try {
          const subscription = await currentPushSubscription();
          const consent = !!actorId && storedPushActor() === actorId;
          if (!disposed) setCanDisable(consent || !!subscription);
          if (!consent && subscription) next = "cleanup-failed";
          else if (!configLoaded) next = inboxError ? "unavailable" : "checking";
          else next = !publicKey ? "not-configured" : consent && actorId
            ? await withTimeout(synchronizeCurrentPushDevice(actorId, subscribePush, unsubscribePush, () => !disposed, publicKey)) : "off";
        } catch { next = "unavailable"; }
      }
      if (!disposed) setState(next);
    }
    void inspect();
    window.addEventListener("focus", inspect);
    window.addEventListener("online", inspect);
    navigator.serviceWorker?.addEventListener("controllerchange", inspect);
    return () => {
      disposed = true;
      window.removeEventListener("focus", inspect);
      window.removeEventListener("online", inspect);
      navigator.serviceWorker?.removeEventListener("controllerchange", inspect);
    };
  }, [installed, publicKey, actorId, configLoaded, inboxError, inspection, busy]);

  async function enable() {
    if (!actorId || !publicKey) return;
    setBusy(true);
    const previousActor = storedPushActor();
    const revision = pushConsentRevision();
    const stillConsenting = () => pushConsentRevision() === revision;
    let subscription: PushSubscription | null = null;
    try {
      // This is the only permission request; it runs directly from the opt-in click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (stillConsenting()) storePushActor(null);
        setState(permission === "denied" ? "denied" : "off"); return;
      }
      const enabled = await withTimeout(withPushDeviceLock(async () => {
        if (!stillConsenting()) return false;
        const registration = await withTimeout(navigator.serviceWorker.ready);
        subscription = await withTimeout(registration.pushManager.getSubscription());
        subscription = await reconcilePushDevice(actorId, previousActor, subscription, unsubscribePush);
        if (!stillConsenting()) return false;
        if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationKey(publicKey) });
        if (!stillConsenting()) { await cleanupPushDevice(subscription, unsubscribePush); return false; }
        const value = subscription.toJSON();
        const result = await subscribePush({ endpoint: value.endpoint, keys: value.keys }, actorId);
        if (!stillConsenting()) { await cleanupPushDevice(subscription, unsubscribePush); return false; }
        if (!result.ok) throw new Error("subscription failed");
        storePushActor(actorId);
        return true;
      }));
      if (!enabled) { setState("off"); return; }
      setState("enabled");
      toast.success("เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว");
    } catch {
      if (stillConsenting()) storePushActor(null);
      const cleanup = await optOutPushDevice(currentPushSubscription, unsubscribePush);
      setState(cleanup.state);
      toast.error("เปิดแจ้งเตือนไม่สำเร็จ อุปกรณ์อาจยังไม่พร้อม กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    // Cancel consent before queued synchronization can revive an opted-out device.
    storePushActor(null);
    try {
      const result = await optOutPushDevice(currentPushSubscription, unsubscribePush);
      if (result.state === "off") storePushActor(null);
      setState(result.state);
      if (result.complete) toast.success("ปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว");
      else toast.error("ถอนการเชื่อมต่อได้ไม่ครบ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง");
    } catch { toast.error("ปิดแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  }

  async function retry() {
    if (!configLoaded) await notifications?.refresh();
    setInspection((value) => value + 1);
  }

  const message: Record<PushState, string> = {
    checking: "กำลังตรวจสอบและเชื่อมต่อการแจ้งเตือนบนอุปกรณ์นี้",
    unsupported: "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Push ยังดูการแจ้งเตือนในเว็บได้",
    denied: "เบราว์เซอร์บล็อกการแจ้งเตือน เปิดสิทธิ์ในการตั้งค่าเว็บไซต์ก่อนลองอีกครั้ง",
    "not-configured": "ระบบยังไม่ได้ตั้งค่า Push ยังดูการแจ้งเตือนในเว็บได้",
    enabled: "เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว",
    off: "ยังไม่ได้เปิดแจ้งเตือนบนอุปกรณ์นี้",
    "ios-install": "บน iPhone/iPad (iOS 16.4 ขึ้นไป) เปิดเมนูแชร์ เลือกเพิ่มไปยังหน้าจอโฮม แล้วเปิด WeBooks จากไอคอนเพื่อเปิด Push",
    "cleanup-failed": "ยังยืนยันไม่ได้ว่าปิด Push แล้ว กรุณาลองปิดอีกครั้ง",
    unavailable: "ยังเชื่อมต่อการแจ้งเตือนไม่สำเร็จ ระบบจะลองใหม่เมื่อกลับมาออนไลน์",
  };
  const status = state === "enabled" ? "เปิดอยู่" : state === "off" ? "ปิดอยู่" : state === "checking" ? "กำลังตรวจสอบ" : "ยังไม่พร้อม";
  return <div className="space-y-4">
    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">แจ้งเตือนบนอุปกรณ์นี้</p>
        <span className={state === "enabled"
          ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"}>{status}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground" role="status">{message[state]}</p>
    </div>
    <div className="flex flex-col gap-2">
      {state === "off" && <Button type="button" className="min-h-11 w-full" disabled={busy || !actorId || !publicKey} onClick={() => { void enable(); }}>{busy ? "กำลังดำเนินการ…" : "เปิดแจ้งเตือนบนอุปกรณ์นี้"}</Button>}
      {state === "unavailable" && <Button type="button" className="min-h-11 w-full" variant="outline" disabled={busy || !actorId} onClick={() => { void retry(); }}>ลองเชื่อมต่ออีกครั้ง</Button>}
      {(canDisable || state === "enabled" || state === "cleanup-failed") && <Button type="button" className="min-h-11 w-full" variant="outline" disabled={busy || !actorId} onClick={() => { void disable(); }}>{busy ? "กำลังดำเนินการ…" : "ปิดแจ้งเตือนบนอุปกรณ์นี้"}</Button>}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">การตั้งค่านี้ใช้เฉพาะบัญชีและอุปกรณ์นี้</p>
  </div>;
}
