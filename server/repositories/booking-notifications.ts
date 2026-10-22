import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationEvent, notificationId, notificationPropertyId, notificationRecord, parsePushSubscription, type BookingNotification, type BrowserPushSubscription, type NotificationInbox, type NotificationRead } from "../../lib/booking-notifications.ts";
import type { PushJob, PushOutcome } from "../notifications/web-push.ts";

export interface PushDelivery extends PushJob { id: string; leaseToken: string; subscriptionId: string }
export interface NotificationRepository {
  inbox(actorId: string, page: number, id?: string): Promise<NotificationInbox>;
  read(actorId: string, input: NotificationRead): Promise<void>;
  subscribe(actorId: string, subscription: BrowserPushSubscription): Promise<string>;
  unsubscribe(actorId: string, selector: { endpoint?: string; subscriptionId?: string }): Promise<void>;
  claim(): Promise<PushDelivery[]>;
  canSend(delivery: PushDelivery): Promise<boolean>;
  complete(delivery: PushDelivery, outcome: PushOutcome): Promise<void>;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("notification_invalid_data");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("notification_invalid_data");
  return value;
}
function parseItem(value: unknown): BookingNotification {
  const row = notificationRecord(value);
  if (row.source !== "internal" && row.source !== "ical") throw new Error("notification_invalid_data");
  return {
    id: notificationId(row.id), bookingId: text(row.bookingId), propertyId: text(row.propertyId), title: text(row.title),
    checkIn: text(row.checkIn), checkOut: text(row.checkOut), status: text(row.status), source: row.source, eventType: notificationEvent(row.eventType),
    createdAt: text(row.createdAt), bookingUpdatedAt: text(row.bookingUpdatedAt), readAt: row.readAt === null ? null : text(row.readAt),
  };
}
export function parseInbox(value: unknown): NotificationInbox {
  const row = notificationRecord(value);
  if (!Array.isArray(row.items)) throw new Error("notification_invalid_data");
  return { items: row.items.map(parseItem), unreadCount: count(row.unreadCount), total: count(row.total), page: count(row.page), pageSize: count(row.pageSize), asOf: text(row.asOf) };
}

export function createNotificationRepository(client: SupabaseClient): NotificationRepository {
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error("notification_unavailable");
    return data;
  }
  return {
    async inbox(actorId, page, id) {
      return parseInbox(await rpc("booking_notification_list", { p_actor: actorId, p_page: page, p_id: id ?? null }));
    },
    async read(actorId, input) {
      await rpc("booking_notification_read", { p_actor: actorId, p_id: input.id ?? null, p_before: input.before ?? null });
    },
    async subscribe(actorId, subscription) {
      return notificationId(await rpc("booking_push_subscribe", { p_actor: actorId, p_endpoint: subscription.endpoint, p_p256dh: subscription.keys.p256dh, p_auth: subscription.keys.auth }));
    },
    async unsubscribe(actorId, selector) {
      await rpc("booking_push_unsubscribe", { p_actor: actorId, p_endpoint: selector.endpoint ?? null, p_subscription: selector.subscriptionId ?? null });
    },
    async claim() {
      const result = await rpc("booking_push_claim", { p_limit: 50 });
      if (!Array.isArray(result) || result.length > 50) throw new Error("notification_invalid_data");
      return result.map((value): PushDelivery => {
        const row = notificationRecord(value);
        const subscription = parsePushSubscription(row);
        const attempt = count(row.attempt);
        if (attempt < 1 || attempt > 5) throw new Error("notification_invalid_data");
        return { ...subscription, attempt, eventType: notificationEvent(row.eventType), propertyId: notificationPropertyId(row.propertyId), id: notificationId(row.id), leaseToken: notificationId(row.leaseToken), notificationId: notificationId(row.notificationId), subscriptionId: notificationId(row.subscriptionId) };
      });
    },
    async canSend(delivery) {
      return await rpc("booking_push_authorize", { p_id: delivery.id, p_lease: delivery.leaseToken }) === true;
    },
    async complete(delivery, outcome) {
      const acknowledged = await rpc("booking_push_complete", { p_id: delivery.id, p_lease: delivery.leaseToken, p_status: outcome.status, p_error: outcome.error, p_retry_at: outcome.retryAt });
      if (acknowledged !== true) throw new Error("notification_stale_lease");
    },
  };
}
