import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardPropertyId, dashboardScope, type DashboardScope, type DashboardMonth, type DashboardBookingSource, type DashboardHouse } from "../../lib/dashboard.ts";
import { record } from "../../lib/house-bookings.ts";

export interface DashboardRepository {
  access(actorId: string): Promise<DashboardScope | null>;
  bookings(scope: DashboardScope, month: DashboardMonth): Promise<DashboardBookingSource[]>;
  newHouses(month: DashboardMonth): Promise<DashboardHouse[]>;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("dashboard_invalid_data");
  return value;
}

function cents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error("dashboard_invalid_amount");
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result)) throw new Error("dashboard_invalid_amount");
  return result;
}

export function createDashboardRepository(client: SupabaseClient): DashboardRepository {
  return {
    async access(actorId) {
      const { data, error } = await client.from("users").select("role_id,dv_id").eq("uid", actorId).maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      return dashboardScope(data);
    },
    async bookings(scope, month) {
      const rows: DashboardBookingSource[] = [];
      // Read all pages, even when PostgREST's configured cap is below 500.
      for (let offset = 0; ;) {
        const agencyFields = scope.kind === "admin" ? ",agent_id,agent:agents(id,name)" : "";
        let query = client.from("bookings")
          .select(`id,booking_code,listing_id,houseid,check_in,check_out,status,price_max,created_at,listing:listings!inner(id,property_id,title)${agencyFields}`, { count: "exact" })
          .gte("created_at", month.start).lt("created_at", month.end)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + 499);
        if (scope.kind === "owner") {
          query = query.eq("houseid", scope.propertyId).eq("listing.property_id", scope.propertyId);
        }
        const { data, count, error } = await query;
        if (error || count === null) throw new Error("dashboard_unavailable");
        const page: unknown[] = data ?? [];
        for (const value of page) {
          const row = record(value), house = record(row.listing);
          const propertyId = dashboardPropertyId(row.houseid);
          // Reject legacy mismatched listing/house pairs before exposing any fields.
          if (!propertyId || propertyId !== dashboardPropertyId(house.property_id) || row.listing_id !== house.id) continue;
          if (scope.kind === "owner" && propertyId !== scope.propertyId) continue;
          const agent = scope.kind === "admin" && row.agent ? record(row.agent) : null;
          rows.push({
            id: String(row.id), code: text(row.booking_code), propertyId, houseTitle: typeof house.title === "string" ? house.title : `DV-${propertyId}`,
            checkIn: text(row.check_in), checkOut: text(row.check_out), status: typeof row.status === "string" ? row.status : null,
            createdAt: text(row.created_at), priceCents: cents(row.price_max),
            agentId: scope.kind === "admin" && typeof row.agent_id === "string" ? row.agent_id : null,
            agentName: agent && agent.id === row.agent_id && typeof agent.name === "string" ? agent.name : null,
          });
        }
        offset += page.length;
        if (offset >= count) return rows;
        if (!page.length) throw new Error("dashboard_incomplete_data");
      }
    },
    async newHouses(month) {
      const rows: DashboardHouse[] = [];
      for (let offset = 0; ;) {
        const { data, count, error } = await client.from("listings").select("id,property_id,title,created_at", { count: "exact" })
          .gte("created_at", month.start).lt("created_at", month.end)
          .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
        if (error || count === null) throw new Error("dashboard_unavailable");
        const page: unknown[] = data ?? [];
        for (const value of page) {
          const row = record(value);
          rows.push({ id: text(row.id), propertyId: dashboardPropertyId(row.property_id), title: typeof row.title === "string" ? row.title : "ไม่ระบุชื่อบ้าน", createdAt: text(row.created_at) });
        }
        offset += page.length;
        if (offset >= count) return rows;
        if (!page.length) throw new Error("dashboard_incomplete_data");
      }
    },
  };
}
