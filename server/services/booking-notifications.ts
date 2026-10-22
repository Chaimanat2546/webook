import { notificationId, parseNotificationRead, parsePushSubscription, pushEndpoint, type NotificationRead } from "../../lib/booking-notifications.ts";
import type { NotificationRepository, PushDelivery } from "../repositories/booking-notifications.ts";
import { sendBookingPush, type PushConfig, type PushOutcome } from "../notifications/web-push.ts";

export async function registerNotificationDevice(repository: NotificationRepository, actorId: string, raw: unknown) {
  return repository.subscribe(actorId, parsePushSubscription(raw));
}
export async function removeNotificationDevice(repository: NotificationRepository, actorId: string, endpoint: unknown) {
  await repository.unsubscribe(actorId, { endpoint: pushEndpoint(endpoint) });
}
export async function retirePushBindingOnAccountChange(repository: Pick<NotificationRepository, "unsubscribe">, previousActorId: string | null, nextActorId: string, subscriptionId: unknown) {
  if (!previousActorId || previousActorId === nextActorId || subscriptionId === null || subscriptionId === undefined) return;
  await repository.unsubscribe(previousActorId, { subscriptionId: notificationId(subscriptionId) });
}
export async function readBookingNotifications(repository: NotificationRepository, actorId: string, raw: unknown) {
  const input: NotificationRead = parseNotificationRead(raw);
  await repository.read(actorId, input);
}
export async function getBookingNotification(repository: NotificationRepository, actorId: string, rawId: unknown) {
  const id = notificationId(rawId);
  const page = await repository.inbox(actorId, 1, id);
  return page.items.find(item => item.id === id) ?? null;
}

export interface PushDispatchReport { sent: number; failed: number; deferred: number }
/** Lease failures are left for the next cron; no endpoints or provider errors enter logs. */
export async function dispatchBookingPush(
  repository: NotificationRepository,
  config: PushConfig | null,
  send: (job: PushDelivery, config: PushConfig) => Promise<PushOutcome> = sendBookingPush,
): Promise<PushDispatchReport> {
  const report: PushDispatchReport = { sent: 0, failed: 0, deferred: 0 };
  if (!config) return report;
  const deliveries = await repository.claim();
  for (let offset = 0; offset < deliveries.length; offset += 5) {
    await Promise.allSettled(deliveries.slice(offset, offset + 5).map(async delivery => {
      try {
        if (!await repository.canSend(delivery)) { report.failed++; return; }
        const result = await send(delivery, config);
        await repository.complete(delivery, result);
        if (result.status === "sent") report.sent++;
        else if (result.status === "retry") report.deferred++;
        else report.failed++;
      } catch { report.deferred++; }
    }));
  }
  return report;
}
