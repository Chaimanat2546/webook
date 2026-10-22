"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { subscribePush, unsubscribePush } from "../../app/admin/notifications/actions";
import { currentPushSubscription, reconcilePushDevice, storedPushActor, storePushActor, withPushDeviceLock } from "../admin/notifications/push-device";
import { synchronizeCurrentPushDevice } from "../admin/notifications/push-sync";

/** Runs on login, recovery and no-access pages too, outside the admin shell. */
export function PushSessionGuard() {
  useEffect(() => {
    const client = createSupabaseBrowserClient();
    let disposed = false;
    let actor: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let rerun = false;
    async function reconcile() {
      if (disposed || actor === undefined) return;
      if (running) { rerun = true; return; }
      running = true;
      try { do {
        rerun = false;
        const expectedActor = actor;
        const stillCurrent = () => !disposed && actor === expectedActor;
        try {
          const owned = await withPushDeviceLock(async () => {
            if (!stillCurrent()) return false;
            const subscription = await currentPushSubscription();
            if (!stillCurrent()) return false;
            if (expectedActor && storedPushActor() === expectedActor) return true;
            const kept = await reconcilePushDevice(expectedActor ?? "", storedPushActor(), subscription, unsubscribePush);
            if (!kept && stillCurrent()) storePushActor(null);
            return false;
          });
          if (owned && expectedActor && stillCurrent()) await synchronizeCurrentPushDevice(expectedActor, subscribePush, unsubscribePush, stillCurrent);
        } catch {
          // Keep consent so focus/online can retry a transient failure.
        }
      } while (rerun && !disposed); } finally { running = false; }
    }
    function schedule() {
      clearTimeout(timer);
      // Run outside Supabase's auth callback/session lock.
      timer = setTimeout(() => { void reconcile(); }, 0);
    }
    function resume() { if (document.visibilityState === "visible") schedule(); }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      actor = session?.user.id ?? null;
      schedule();
    });
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    navigator.serviceWorker?.addEventListener("controllerchange", schedule);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
      navigator.serviceWorker?.removeEventListener("controllerchange", schedule);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return null;
}
