import { buildPushPayload } from "@block65/webcrypto-web-push";
import { notificationEvent, notificationId, parsePushSubscription, pushKey, type BookingNotificationEvent, type BrowserPushSubscription } from "../../lib/booking-notifications.ts";

export interface PushConfig { publicKey: string; privateKey: string; subject: string }
export interface PushBindings { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
export interface PushJob extends BrowserPushSubscription { notificationId: string; attempt: number; eventType?: BookingNotificationEvent }
export interface PushOutcome { status: "sent" | "retry" | "failed" | "expired"; error: string | null; retryAt: string | null }

/** No Node-only crypto/server-only marker: this adapter also runs in the scheduled Worker. */
export function pushConfig(env: PushBindings): PushConfig | null {
  try {
    const publicKey = pushKey(env.VAPID_PUBLIC_KEY?.trim(), 65);
    const privateKey = pushKey(env.VAPID_PRIVATE_KEY?.trim(), 32);
    const subject = env.VAPID_SUBJECT?.trim() ?? "";
    if (!/^mailto:[^\s@]+@[^\s@]+$/.test(subject)) {
      const url = new URL(subject);
      if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    }
    return { publicKey, privateKey, subject };
  } catch { return null; }
}

export function pushResult(status: number, retryAfter: string | null, attempt: number, now = new Date()): PushOutcome {
  if (status >= 200 && status < 300) return { status: "sent", error: null, retryAt: null };
  if (status === 404 || status === 410) return { status: "expired", error: "push_subscription_gone", retryAt: null };
  const transient = status === 0 || status === 429 || status >= 500;
  const error = status === 0 ? "push_network" : status === 429 ? "push_rate_limited" : status >= 500 ? "push_provider_unavailable" : "push_rejected";
  if (!transient || attempt >= 5) return { status: "failed", error, retryAt: null };
  const delay = 60_000 * 2 ** Math.max(0, Math.min(3, attempt - 1));
  const retry = retryAfter && /^\d+$/.test(retryAfter) ? now.getTime() + Number(retryAfter) * 1000 : Date.parse(retryAfter ?? "");
  // Never overflow a timestamp on an untrusted Retry-After; jobs expire after 24h.
  const providerDelay = Number.isFinite(retry) ? Math.min(retry, now.getTime() + 86_400_000) : 0;
  return { status: "retry", error, retryAt: new Date(Math.max(now.getTime() + delay, providerDelay)).toISOString() };
}

export async function sendBookingPush(job: PushJob, config: PushConfig, transport: typeof fetch = fetch): Promise<PushOutcome> {
  let subscription: BrowserPushSubscription;
  let id: string;
  let eventType: BookingNotificationEvent;
  try { subscription = parsePushSubscription(job); id = notificationId(job.notificationId); eventType = notificationEvent(job.eventType); }
  catch { return { status: "failed", error: "push_invalid_subscription", retryAt: null }; }
  let payload: Awaited<ReturnType<typeof buildPushPayload>>;
  try {
    payload = await buildPushPayload({ data: JSON.stringify({ notificationId: id, ...(job.eventType ? { eventType } : {}) }), options: { ttl: 3600 } }, { ...subscription, expirationTime: null }, config);
  } catch { return { status: "failed", error: "push_encryption_failed", retryAt: null }; }
  try {
    // Workers supports manual/follow only; classify every 3xx as a failed send.
    const response = await transport(subscription.endpoint, { ...payload, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const outcome = pushResult(response.status, response.headers.get("Retry-After"), job.attempt);
    // Provider response bodies can contain endpoint credentials; never consume or log.
    if (response.body) await response.body.cancel();
    return outcome;
  } catch { return pushResult(0, null, job.attempt); }
}
