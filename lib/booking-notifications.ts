export type BookingNotificationEvent = "booking_created" | "payment_succeeded" | "booking_cancelled" | "payment_expired";

export function notificationEvent(value: unknown): BookingNotificationEvent {
  if (value === undefined) return "booking_created"; // Older queued payloads remain readable during rollout.
  if (value === "booking_created" || value === "payment_succeeded" || value === "booking_cancelled" || value === "payment_expired") return value;
  throw new Error("notification_invalid_event");
}

export function notificationEventLabel(event: BookingNotificationEvent, source?: "internal" | "ical"): string {
  if (event === "payment_succeeded") return "ชำระเงิน booking สำเร็จ";
  if (event === "booking_cancelled") return "ยกเลิก booking";
  if (event === "payment_expired") return "booking หมดเวลาชำระเงิน";
  return source === "ical" ? "นำเข้า booking จาก iCal" : "มี booking ใหม่";
}

/** Keep bigint DVs as canonical decimal text, including IDs beyond JS safe integers. */
export function notificationPropertyId(value: unknown): string | undefined {
  if (value === undefined) return undefined; // Older queued jobs have no house ID.
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)
    || value.trim() !== value || BigInt(value) > BigInt("9223372036854775807")) {
    throw new Error("notification_invalid_property");
  }
  return value;
}

export interface BookingNotification {
  id: string;
  bookingId: string;
  propertyId: string;
  title: string;
  checkIn: string;
  checkOut: string;
  status: string;
  eventType: BookingNotificationEvent;
  source: "internal" | "ical";
  createdAt: string;
  bookingUpdatedAt: string;
  readAt: string | null;
}

export interface NotificationInbox {
  items: BookingNotification[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
}

export interface NotificationPage extends NotificationInbox {
  actorId: string;
  pushPublicKey: string | null;
}

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type NotificationActionResult = { ok: true } | { ok: false; message: string };
export type NotificationRead = { id: string; before?: never } | { before: string; id?: never };

export function notificationRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("notification_invalid_input");
  return value as Record<string, unknown>;
}

export function notificationId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("notification_invalid_input");
  return value.toLowerCase();
}

export function notificationPage(value: unknown): number {
  if (value === null || value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw new Error("notification_invalid_input");
  return Number(value);
}

export function pushEndpoint(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error("notification_invalid_input");
  const url = new URL(value);
  const host = url.hostname;
  const approved = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com"
    || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com");
  if (!approved || url.protocol !== "https:" || url.port || url.username || url.password || url.hash) throw new Error("notification_invalid_input");
  return url.href;
}

export function pushKey(value: unknown, bytes: number): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length !== Math.ceil(bytes * 4 / 3)) throw new Error("notification_invalid_input");
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  if (raw.length !== bytes || (bytes === 65 && raw.charCodeAt(0) !== 4)) throw new Error("notification_invalid_input");
  return value;
}

export function parsePushSubscription(raw: unknown): BrowserPushSubscription {
  const value = notificationRecord(raw);
  const keys = notificationRecord(value.keys);
  return { endpoint: pushEndpoint(value.endpoint), keys: { p256dh: pushKey(keys.p256dh, 65), auth: pushKey(keys.auth, 16) } };
}

export function parseNotificationRead(raw: unknown): NotificationRead {
  const value = notificationRecord(raw);
  if (value.id !== undefined && value.before === undefined) return { id: notificationId(value.id) };
  if (value.id === undefined && typeof value.before === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value.before)) {
    const date = new Date(value.before);
    // PostgreSQL cutoffs have microseconds. Keep them intact so read-all does
    // not leave items in the final fractional millisecond unread.
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.before.slice(0, 10)) return { before: value.before };
  }
  throw new Error("notification_invalid_input");
}
