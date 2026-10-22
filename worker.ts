import handler from "./.open-next/worker.js";
import { createClient } from "@supabase/supabase-js";
import { expireWaitingBookings } from "./server/repositories/booking-expiry";
import { createNotificationRepository } from "./server/repositories/booking-notifications";
import { dispatchBookingPush } from "./server/services/booking-notifications";
import { pushConfig } from "./server/notifications/web-push";
import { runBookingMaintenance } from "./server/notifications/maintenance";

interface CloudflareEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
interface ScheduledController { readonly cron: string; readonly scheduledTime: number; }

export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, env: CloudflareEnv): Promise<void> {
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    await runBookingMaintenance(
      () => expireWaitingBookings(client),
      () => dispatchBookingPush(createNotificationRepository(client), pushConfig(env)),
    );
  },
};
