interface DeviceSubscription {
  endpoint: string;
  unsubscribe: () => Promise<boolean>;
}

type RemoveSubscription = (endpoint: string) => Promise<{ ok: boolean }>;

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
  let server = false;
  let browser = false;
  try { server = (await withTimeout(remove(subscription.endpoint))).ok; } catch { /* Try browser cleanup even without a network. */ }
  try { browser = await withTimeout(subscription.unsubscribe()); } catch { /* Report partial cleanup to the caller. */ }
  return { server, browser };
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

export async function reconcilePushDevice<T extends DeviceSubscription>(actorId: string, boundActor: string | null, subscription: T | null, remove: RemoveSubscription): Promise<T | null> {
  if (!subscription || actorId === boundActor) return subscription;
  // A subscription with an unknown owner is unsafe on a shared browser too.
  const result = await removeDeviceBinding(subscription, remove);
  if (!result.browser) throw new Error("ไม่สามารถถอนการแจ้งเตือนของบัญชีเดิมบนอุปกรณ์นี้ได้");
  return null;
}

export async function runNotificationSignOut(cleanup: () => Promise<boolean>, signOut: () => Promise<void>, notifyFailure: () => void): Promise<void> {
  let success = false;
  try { success = await cleanup(); } catch { /* Signing out must remain possible offline. */ }
  if (!success) notifyFailure();
  await signOut();
}

export function pushApplicationKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export const PUSH_ACTOR_STORAGE_KEY = "webook-push-actor";

export function storedPushActor(): string | null {
  try { return localStorage.getItem(PUSH_ACTOR_STORAGE_KEY); } catch { return null; }
}

export function storePushActor(actor: string | null): void {
  try {
    if (actor) localStorage.setItem(PUSH_ACTOR_STORAGE_KEY, actor);
    else localStorage.removeItem(PUSH_ACTOR_STORAGE_KEY);
  } catch { /* Storage may be disabled; unknown bindings are retired on next visit. */ }
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await withTimeout(navigator.serviceWorker.getRegistration("/"));
  return registration ? await withTimeout(registration.pushManager.getSubscription()) : null;
}
