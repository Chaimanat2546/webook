import "server-only";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { canUseBooking, requireAdmin } from "./admin";
import { createHouseBookingsRepository } from "../repositories/house-bookings";

export async function requireBookingAdmin() {
  const session = await requireAdmin();
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("booking_unavailable");
  // Privileged access is tied to auth.uid, never a browser-provided permission or email.
  const { data, error } = await client.from("users").select("allow_tools").eq("uid", session.user.id).maybeSingle();
  if (error || !data || !canUseBooking(data)) throw new Error("booking_forbidden");
  // Booking operators manage every house; the user explicitly approved this scope.
  return { actorId: session.user.id, repository: createHouseBookingsRepository(client) };
}
