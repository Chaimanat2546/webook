import "server-only";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { dashboardScope } from "../../lib/dashboard";
import { createNotificationRepository } from "../repositories/booking-notifications";

export class NotificationAccessError extends Error {
  readonly status: 401 | 403 | 503;
  constructor(status: 401 | 403 | 503) { super("notification_access_failed"); this.status = status; }
}

export async function notificationSession(requireScope = true) {
  const session = await createSupabaseServerClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new NotificationAccessError(401);
  const client = createSupabaseAdminClient();
  if (!client) throw new NotificationAccessError(503);
  const { data, error: identityError } = await client.from("users").select("role_id,dv_id,allow_tools").eq("uid", user.id).maybeSingle();
  if (identityError) throw new NotificationAccessError(503);
  if (requireScope && !dashboardScope(data)) throw new NotificationAccessError(403);
  return { actorId: user.id, canUseBooking: data?.allow_tools?.allow_booking === true, repository: createNotificationRepository(client) };
}
