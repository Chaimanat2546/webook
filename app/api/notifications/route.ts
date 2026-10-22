import { notificationPage } from "../../../lib/booking-notifications";
import { NotificationAccessError, notificationSession } from "../../../server/auth/notifications";
import { getPushRuntimeConfig } from "../../../server/notifications/runtime-config";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET(request: Request) {
  try {
    const page = notificationPage(new URL(request.url).searchParams.get("page"));
    const { actorId, repository } = await notificationSession();
    const [inbox, config] = await Promise.all([repository.inbox(actorId, page), getPushRuntimeConfig()]);
    return Response.json({ ...inbox, actorId, pushPublicKey: config?.publicKey ?? null }, { headers });
  } catch (error) {
    const status = error instanceof NotificationAccessError ? error.status : error instanceof Error && error.message === "notification_invalid_input" ? 400 : 503;
    return Response.json({ error: "ไม่สามารถโหลดการแจ้งเตือนได้" }, { status, headers });
  }
}
