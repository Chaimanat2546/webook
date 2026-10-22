"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { unsubscribePush } from "../../app/admin/notifications/actions";
import { currentPushSubscription, reconcilePushDevice, storedPushActor, storePushActor } from "../admin/notifications/push-device";

/** Runs on login, recovery and no-access pages too, outside the admin shell. */
export function PushSessionGuard() {
  useEffect(() => {
    const client = createSupabaseBrowserClient();
    let disposed = false;
    let actor: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function reconcile() {
      if (disposed || actor === undefined) return;
      const expectedActor = actor;
      try {
        const subscription = await currentPushSubscription();
        if (disposed || actor !== expectedActor) return;
        const kept = await reconcilePushDevice(expectedActor ?? "", storedPushActor(), subscription, unsubscribePush);
        if (!kept) storePushActor(null);
      } catch {
        // Keep the actor marker so focus/online can retry browser retirement.
      }
    }
    function schedule() {
      clearTimeout(timer);
      // Run outside Supabase's auth callback/session lock.
      timer = setTimeout(() => { void reconcile(); }, 0);
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      actor = session?.user.id ?? null;
      schedule();
    });
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    return () => {
      disposed = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
    };
  }, []);
  return null;
}
