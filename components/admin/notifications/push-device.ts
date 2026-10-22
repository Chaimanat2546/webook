interface DeviceSubscription {
  endpoint: string;
  unsubscribe: () => Promise<boolean>;
}

type RemoveSubscription = (endpoint: string) => Promise<{ ok: boolean }>;

let deviceOperation: Promise<void> = Promise.resolve();

/** Serialize browser subscription changes and registration with explicit opt-out. */
export async function withPushDeviceLock<T>(operation: () => Promise<T>): Promise<T> {
  // Web Locks also serialize Safari tabs and the installed PWA on this origin.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("webook-push-device", operation);
  }
  const previous = deviceOperation;
  let release!: () => void;
  deviceOperation = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}

export async function withTimeout<T>(work: Promise<T>, milliseconds = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("อุปกรณ์ยังไม่พร้อม กรุณาลองอีกครั้ง")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function removeDeviceBinding(subscription: DeviceSubscription, remove: RemoveSubscription): Promise<{ server: boolean; browser: boolean }> {
  // Start local retirement even if the network stalls. Keep the lock until both
  // mutations settle; timing out a Promise does not cancel its side effects.
  const [server, browser] = await Promise.allSettled([
    remove(subscription.endpoint), subscription.unsubscribe(),
  ]);
  return {
    server: server.status === "fulfilled" && server.value.ok,
    browser: browser.status === "fulfilled" && browser.value,
  };
}

export async function cleanupPushDevice(subscription: DeviceSubscription | null, remove: RemoveSubscription): Promise<boolean> {
  if (!subscription) return true;
  const result = await removeDeviceBinding(subscription, remove);
  return result.server && result.browser;
}

export async function disablePushDevice(getSubscription: () => Promise<DeviceSubscription | null>, remove: RemoveSubscription): Promise<{ complete: boolean; state: "off" | "cleanup-failed" }> {
  try {
    const complete = await cleanupPushDevice(await getSubscription(), remove);
    const remaining = await getSubscription();
    return { complete, state: remaining ? "cleanup-failed" : "off" };
  } catch { return { complete: false, state: "cleanup-failed" }; }
}

export async function optOutPushDevice(getSubscription: () => Promise<DeviceSubscription | null>, remove: RemoveSubscription): Promise<{ complete: boolean; state: "off" | "cleanup-failed" }> {
  try {
    const subscription = await getSubscription();
    // Consent is already cleared by the caller. Local retirement must not wait
    // behind an offline Server Action. Only destructive unsubscribe bypasses the
    // lock; late subscribe/register is compensated before that lock is released.
    const local = subscription ? subscription.unsubscribe().catch(() => false) : Promise.resolve(true);
    const cleanup = withPushDeviceLock(async () => {
      await local;
      let removed = true;
      if (subscription) {
        try { removed = (await remove(subscription.endpoint)).ok; } catch { removed = false; }
      }
      const result = await disablePushDevice(getSubscription, remove);
      return { ...result, complete: removed && result.complete };
    });
    // The queued cleanup retains the lock until its mutations really settle.
    // The UI can stop waiting without losing that cleanup or blocking logout.
    try { return await withTimeout(cleanup); }
    catch { return { complete: false, state: await getSubscription() ? "cleanup-failed" : "off" }; }
  } catch { return { complete: false, state: "cleanup-failed" }; }
}

export async function reconcilePushDevice<T extends DeviceSubscription>(actorId: string, boundActor: string | null, subscription: T | null, remove: RemoveSubscription): Promise<T | null> {
  if (!subscription || actorId === boundActor) return subscription;
  // A subscription with an unknown owner is unsafe on a shared browser too.
  const result = await removeDeviceBinding(subscription, remove);
  if (!result.browser) throw new Error("ไม่สามารถถอนการแจ้งเตือนของบัญชีเดิมบนอุปกรณ์นี้ได้");
  return null;
}

export async function runNotificationSignOut(cleanup: () => Promise<boolean>, signOut: () => Promise<void>, notifyFailure: () => void): Promise<void> {
  let success = false;
  try { success = await withTimeout(cleanup()); } catch { /* Signing out must remain possible offline. */ }
  if (!success) notifyFailure();
  await signOut();
}

export function pushApplicationKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export const PUSH_ACTOR_STORAGE_KEY = "webook-push-actor";
const PUSH_REVOCATION_STORAGE_KEY = "webook-push-revocation";

/** A distinct revision lets an in-flight explicit opt-in observe later opt-out. */
export function pushConsentRevision(): string | null {
  try { return localStorage.getItem(PUSH_REVOCATION_STORAGE_KEY); } catch { return null; }
}

export function storedPushActor(): string | null {
  try { return localStorage.getItem(PUSH_ACTOR_STORAGE_KEY); } catch { return null; }
}

export function storePushActor(actor: string | null): void {
  try {
    if (actor) localStorage.setItem(PUSH_ACTOR_STORAGE_KEY, actor);
    else {
      localStorage.removeItem(PUSH_ACTOR_STORAGE_KEY);
      localStorage.setItem(PUSH_REVOCATION_STORAGE_KEY, `${Date.now()}-${Math.random()}`);
    }
  } catch { /* Storage may be disabled; unknown bindings are retired on next visit. */ }
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await withTimeout(navigator.serviceWorker.getRegistration("/"));
  return registration ? await withTimeout(registration.pushManager.getSubscription()) : null;
}
