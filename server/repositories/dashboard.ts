import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardPropertyId, dashboardScope, type DashboardScope, type DashboardMonth, type DashboardBookingSource, type DashboardCustomer, type DashboardHouse } from "../../lib/dashboard.ts";
import { record } from "../../lib/house-bookings.ts";

export interface DashboardRepository {
  access(actorId: string): Promise<DashboardScope | null>;
  bookings(scope: DashboardScope, month: DashboardMonth, dateField?: DashboardBookingDateField, includeNote?: boolean): Promise<DashboardBookingSource[]>;
  bookingCustomer(scope: DashboardScope, bookingId: string): Promise<{ propertyId: string; customerId: string | null } | null>;
  coverImageUrl(scope: DashboardScope, propertyId: string): Promise<string | null>;
  creatorName(creatorId: string): Promise<string | null>;
  customerDetail(scope: DashboardScope, propertyId: string, customerId: string): Promise<DashboardCustomer | null>;
  newHouses(month: DashboardMonth): Promise<DashboardHouse[]>;
}

export type DashboardBookingDateField = "created_at" | "updated_at" | "check_in";

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

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableUuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function customerDetail(value: unknown): DashboardCustomer {
  const row = record(value);
  return {
    firstName: text(row.first_name), lastName: nullableText(row.last_name), title: nullableText(row.title), nationality: nullableText(row.nationality), preferredLanguage: nullableText(row.preferred_language), vipStatus: nullableBoolean(row.vip_status), phone: text(row.phone), secondaryPhone: nullableText(row.secondary_phone), email: nullableText(row.email), lineId: nullableText(row.line_id), address: nullableText(row.address), subDistrict: nullableText(row.sub_district), district: nullableText(row.district), province: nullableText(row.province), postalCode: nullableText(row.postal_code), country: nullableText(row.country), specialRequests: nullableText(row.special_requests), notes: nullableText(row.notes),
  };
}

export function createDashboardRepository(client: SupabaseClient): DashboardRepository {
  return {
    async access(actorId) {
      const { data, error } = await client.from("users").select("role_id,dv_id").eq("uid", actorId).maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      return dashboardScope(data);
    },
    async bookings(scope, month, dateField = "created_at", includeNote = false) {
      const rows: DashboardBookingSource[] = [];
      // Read all pages, even when PostgREST's configured cap is below 500.
      for (let offset = 0; ;) {
        const agencyFields = scope.kind === "admin" ? ",agent_id,agent:agents(id,name)" : "";
        let query = client.from("bookings")
          .select(`id,booking_code,listing_id,houseid,customer_id,check_in,check_out,checkin_time,checkout_time,status,price_max,price_sell,extra_charge,insurance,payment_expires_at,created_at,updated_at,created_by${includeNote ? ",note" : ""},customer:customers(first_name,last_name),listing:listings!inner(id,property_id,title)${agencyFields}`, { count: "exact" })
          .gte(dateField, month.start).lt(dateField, month.end)
          .order(dateField, { ascending: false }).order("id", { ascending: false })
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
          const customer = row.customer ? record(row.customer) : null;
          rows.push({
            id: String(row.id), code: text(row.booking_code), propertyId, houseTitle: typeof house.title === "string" ? house.title : `DV-${propertyId}`,
            checkIn: text(row.check_in), checkOut: text(row.check_out), status: typeof row.status === "string" ? row.status : null,
            createdAt: text(row.created_at), updatedAt: text(row.updated_at), priceCents: cents(row.price_max),
            depositCents: cents(row.price_sell), extraChargeCents: cents(row.extra_charge), insuranceCents: cents(row.insurance), paymentExpiresAt: nullableText(row.payment_expires_at),
            ...(includeNote ? { note: nullableText(row.note) } : {}),
            checkInTime: nullableText(row.checkin_time), checkOutTime: nullableText(row.checkout_time), createdById: nullableUuid(row.created_by),
            customerId: dashboardPropertyId(row.customer_id),
            customerFirstName: customer && typeof customer.first_name === "string" ? customer.first_name : null,
            customerLastName: customer && typeof customer.last_name === "string" ? customer.last_name : null,
            agentId: scope.kind === "admin" && typeof row.agent_id === "string" ? row.agent_id : null,
            agentName: agent && agent.id === row.agent_id && typeof agent.name === "string" ? agent.name : null,
          });
        }
        offset += page.length;
        if (offset >= count) return rows;
        if (!page.length) throw new Error("dashboard_incomplete_data");
      }
    },
    async bookingCustomer(scope, bookingId) {
      let query = client.from("bookings").select("houseid,customer_id,listing_id,listing:listings!inner(id,property_id)").eq("id", bookingId);
      if (scope.kind === "owner") query = query.eq("houseid", scope.propertyId).eq("listing.property_id", scope.propertyId);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      if (!data) return null;
      const row = record(data), listing = record(row.listing);
      const propertyId = dashboardPropertyId(row.houseid);
      if (!propertyId || propertyId !== dashboardPropertyId(listing.property_id) || row.listing_id !== listing.id) return null;
      if (scope.kind === "owner" && propertyId !== scope.propertyId) return null;
      return { propertyId, customerId: dashboardPropertyId(row.customer_id) };
    },
    async coverImageUrl(scope, propertyId) {
      if (scope.kind === "owner" && scope.propertyId !== propertyId) return null;
      const { data, error } = await client.from("images")
        .select("image_url")
        .eq("property_id", propertyId)
        .gte("cover_select", 1)
        .lte("cover_select", 10)
        .order("cover_select")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      const coverImageUrl = nullableText(data?.image_url);
      if (coverImageUrl) return coverImageUrl;
      const { data: fallback, error: fallbackError } = await client.from("images")
        .select("image_url")
        .eq("property_id", propertyId)
        .order("image_move")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (fallbackError) throw new Error("dashboard_unavailable");
      return nullableText(fallback?.image_url);
    },
    async creatorName(creatorId) {
      const { data, error } = await client.from("users").select("name").eq("uid", creatorId).maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      return nullableText(data?.name);
    },
    async customerDetail(scope, propertyId, customerId) {
      if (scope.kind === "owner" && scope.propertyId !== propertyId) return null;
      const { data, error } = await client.from("customers")
        .select("first_name,last_name,title,nationality,preferred_language,vip_status,phone,secondary_phone,email,line_id,address,sub_district,district,province,postal_code,country,special_requests,notes")
        .eq("dv_id", propertyId).eq("id", customerId).maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      return data ? customerDetail(data) : null;
    },
    async newHouses(month) {
      const rows: DashboardHouse[] = [];
      for (let offset = 0; ;) {
        const { data, count, error } = await client.from("listings").select("id,property_id,title,created_at,bedrooms,bathrooms,max_guests,location_zone,property_type,is_active,checkin_time,checkout_time", { count: "exact" })
          .gte("created_at", month.start).lt("created_at", month.end)
          .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
        if (error || count === null) throw new Error("dashboard_unavailable");
        const page: unknown[] = data ?? [];
        for (const value of page) {
          const row = record(value);
          rows.push({
            id: text(row.id), propertyId: dashboardPropertyId(row.property_id), title: typeof row.title === "string" ? row.title : "ไม่ระบุชื่อบ้าน", createdAt: text(row.created_at),
            bedrooms: nullableNumber(row.bedrooms), bathrooms: nullableNumber(row.bathrooms), maxGuests: nullableNumber(row.max_guests),
            locationZone: nullableText(row.location_zone), propertyType: nullableText(row.property_type),
            isActive: typeof row.is_active === "boolean" ? row.is_active : null,
            checkinTime: nullableText(row.checkin_time), checkoutTime: nullableText(row.checkout_time),
          });
        }
        offset += page.length;
        if (offset >= count) return rows;
        if (!page.length) throw new Error("dashboard_incomplete_data");
      }
    },
  };
}
