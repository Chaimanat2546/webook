import { notificationRecord } from "../../../lib/booking-notifications.ts";
import { cleanupPushDevice, currentPushSubscription, pushApplicationKey, storedPushActor, withPushDeviceLock, withTimeout } from "./push-device.ts";

export interface SyncSubscription { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> }
export type PushSyncState = "enabled" | "off" | "unavailable";
export type RegisterPush = (subscription: unknown, expectedActor: string) => Promise<{ ok: boolean }>;
export interface PushSyncDependencies {
  stillCurrent: () => boolean;
  boundActor: () => string | null;
  permission: () => NotificationPermission;
  subscription: () => Promise<SyncSubscription | null>;
  restore: () => Promise<SyncSubscription | null>;
  register: RegisterPush;
  retire: (subscription: SyncSubscription) => Promise<void>;
}

/** Only a previously opted-in, currently signed-in actor can repair its device. */
export async function synchronizePushDevice(actorId: string, dependencies: PushSyncDependencies): Promise<PushSyncState> {
  return withPushDeviceLock(async () => {
    const allowed = () => dependencies.stillCurrent() && dependencies.boundActor() === actorId;
    if (!actorId || !allowed() || dependencies.permission() !== "granted") return "off";
    try {
      let subscription = await dependencies.subscription();
      if (!allowed()) return "off";
      if (!subscription) subscription = await dependencies.restore();
      if (!allowed()) {
        if (subscription && dependencies.boundActor() !== actorId) await dependencies.retire(subscription);
        return "off";
      }
      if (!subscription) return "unavailable";
      const result = await dependencies.register(subscription.toJSON(), actorId);
      if (!allowed()) {
        if (dependencies.boundActor() !== actorId) await dependencies.retire(subscription);
        return "off";
      }
      return result.ok ? "enabled" : "unavailable";
    } catch { return "unavailable"; }
  });
}

export async function synchronizeCurrentPushDevice(actorId: string, register: RegisterPush, remove: (endpoint: string) => Promise<{ ok: boolean }>, stillCurrent: () => boolean, knownPublicKey?: string | null): Promise<PushSyncState> {
  if (typeof Notification === "undefined") return "off";
  return synchronizePushDevice(actorId, {
    stillCurrent, boundActor: storedPushActor, permission: () => Notification.permission,
    subscription: currentPushSubscription, register,
    async retire(subscription) { await cleanupPushDevice(subscription, remove); },
    async restore() {
      let publicKey = knownPublicKey;
      if (!publicKey) {
        const controller = new AbortController();
        try {
          const response = await withTimeout(fetch("/api/notifications", { cache: "no-store", credentials: "same-origin", signal: controller.signal }));
          if (!response.ok) throw new Error("push_sync_unavailable");
          const data = notificationRecord(await withTimeout(response.json()));
          if (data.actorId !== actorId || typeof data.pushPublicKey !== "string") throw new Error("push_sync_unavailable");
          publicKey = data.pushPublicKey;
        } finally { controller.abort(); }
      }
      if (!stillCurrent() || storedPushActor() !== actorId || Notification.permission !== "granted") return null;
      const registration = await withTimeout(navigator.serviceWorker.ready);
      if (!stillCurrent() || storedPushActor() !== actorId) return null;
      // Permission is already granted; never request it from this automatic path.
      return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationKey(publicKey) });
    },
  });
}
