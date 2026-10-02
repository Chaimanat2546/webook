import type { SupabaseClient } from "@supabase/supabase-js";

export async function expireWaitingBookings(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("admin_expire_waiting_bookings", { p_limit: 500 });
  if (error) throw error;
  if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) throw new Error("invalid_booking_expiry_result");
  return data;
}
