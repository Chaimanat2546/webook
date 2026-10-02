"use server";

import type { DashboardCustomer } from "../../../lib/dashboard.ts";
import { dashboardSession } from "../../../server/auth/dashboard.ts";
import { loadDashboardBookingCustomer } from "../../../server/services/dashboard.ts";

const BOOKING_ID = /^[1-9]\d*$/;

export type DashboardBookingCustomerActionResult =
  | { ok: true; customer: DashboardCustomer | null }
  | { ok: false; customer: null };

export async function loadDashboardBookingCustomerAction(bookingId: string): Promise<DashboardBookingCustomerActionResult> {
  if (!BOOKING_ID.test(bookingId)) return { ok: false, customer: null };
  try {
    const { actorId, repository } = await dashboardSession();
    return { ok: true, customer: await loadDashboardBookingCustomer(repository, actorId, bookingId) };
  } catch {
    return { ok: false, customer: null };
  }
}
