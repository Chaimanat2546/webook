"use server";

import { cookies } from "next/headers";
import { notificationSession } from "../../../server/auth/notifications";
import { getPushRuntimeConfig } from "../../../server/notifications/runtime-config";
import { readBookingNotifications, registerNotificationDevice, removeNotificationDevice } from "../../../server/services/booking-notifications";
import type { NotificationActionResult } from "../../../lib/booking-notifications";
import { notificationId } from "../../../lib/booking-notifications";

export async function subscribePush(raw: unknown, expectedActor?: unknown): Promise<NotificationActionResult> {
  try {
    const { actorId, repository } = await notificationSession();
    if (expectedActor !== undefined && notificationId(expectedActor) !== actorId) return { ok: false, message: "บัญชีมีการเปลี่ยนแปลง กรุณาโหลดหน้าอีกครั้ง" };
    if (!await getPushRuntimeConfig()) return { ok: false, message: "ยังไม่ได้ตั้งค่าการแจ้งเตือนบนอุปกรณ์" };
    const id = await registerNotificationDevice(repository, actorId, raw);
    const cookieStore = await cookies();
    if (cookieStore.get("webook_push_subscription")?.value !== id) {
      cookieStore.set("webook_push_subscription", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 31_536_000 });
    }
    return { ok: true };
  } catch { return { ok: false, message: "ไม่สามารถเปิดแจ้งเตือนได้ กรุณาลองใหม่" }; }
}

export async function unsubscribePush(endpoint: unknown): Promise<NotificationActionResult> {
  try {
    const { actorId, repository } = await notificationSession(false);
    await removeNotificationDevice(repository, actorId, endpoint);
    (await cookies()).delete("webook_push_subscription");
    return { ok: true };
  } catch { return { ok: false, message: "ไม่สามารถปิดแจ้งเตือนได้ กรุณาลองใหม่" }; }
}

export async function readNotifications(raw: unknown, expectedActor?: unknown): Promise<NotificationActionResult> {
  try {
    const { actorId, repository } = await notificationSession();
    if (expectedActor !== undefined && notificationId(expectedActor) !== actorId) return { ok: false, message: "บัญชีมีการเปลี่ยนแปลง กรุณาโหลดหน้าอีกครั้ง" };
    await readBookingNotifications(repository, actorId, raw);
    return { ok: true };
  } catch { return { ok: false, message: "ไม่สามารถบันทึกสถานะอ่านได้ กรุณาลองใหม่" }; }
}
