import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHouseImageDisplayUrl } from "../../lib/house-image-display-url.ts";
import { dashboardPropertyId, dashboardScope, type DashboardScope, type DashboardMonth, type DashboardCustomer, type DashboardHouse, type DashboardHouseDetailData } from "../../lib/dashboard.ts";
import { record } from "../../lib/house-bookings.ts";
import type { DashboardReportingQuery, DashboardReportingResult } from "../../lib/dashboard.ts";
import { parseDashboardReportingResult } from "./dashboard-reporting.ts";

export interface DashboardRepository {
  report(actorId: string, query: DashboardReportingQuery): Promise<DashboardReportingResult>;
  access(actorId: string): Promise<DashboardScope | null>;
  bookingCustomer(scope: DashboardScope, bookingId: string): Promise<{ propertyId: string; customerId: string | null } | null>;
  coverImageUrl(scope: DashboardScope, propertyId: string): Promise<string | null>;
  creatorName(creatorId: string): Promise<string | null>;
  customerDetail(scope: DashboardScope, propertyId: string, customerId: string): Promise<DashboardCustomer | null>;
  newHouses(month: DashboardMonth): Promise<DashboardHouse[]>;
  houseDetail(propertyId: string): Promise<DashboardHouseDetailData | null>;
}


function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("dashboard_invalid_data");
  return value;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function customerDetail(value: unknown): DashboardCustomer {
  const row = record(value);
  return {
    firstName: text(row.first_name), lastName: nullableText(row.last_name), title: nullableText(row.title), nationality: nullableText(row.nationality), preferredLanguage: nullableText(row.preferred_language), vipStatus: nullableBoolean(row.vip_status), phone: text(row.phone), secondaryPhone: nullableText(row.secondary_phone), email: nullableText(row.email), lineId: nullableText(row.line_id), address: nullableText(row.address), subDistrict: nullableText(row.sub_district), district: nullableText(row.district), province: nullableText(row.province), postalCode: nullableText(row.postal_code), country: nullableText(row.country), specialRequests: nullableText(row.special_requests), notes: nullableText(row.notes),
  };
}

export function createDashboardRepository(client: SupabaseClient): DashboardRepository {
  return {
    async report(actorId, query) {
      const { data, error } = await client.rpc("dashboard_report", { p_actor: actorId, p_query: query });
      if (error) throw new Error("dashboard_unavailable");
      return parseDashboardReportingResult(data);
    },
    async access(actorId) {
      const { data, error } = await client.from("users").select("role_id,dv_id").eq("uid", actorId).maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      return dashboardScope(data);
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
      const { data: zoneCover, error: zoneCoverError } = await client.from("images")
        .select("image_name,image_url")
        .eq("property_id", propertyId)
        .eq("image_zone", "cover")
        .order("image_move")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (zoneCoverError) throw new Error("dashboard_unavailable");
      const zoneCoverImageUrl = buildHouseImageDisplayUrl({ imageName: nullableText(zoneCover?.image_name), imageUrl: nullableText(zoneCover?.image_url) });
      if (zoneCoverImageUrl) return zoneCoverImageUrl;

      const { data, error } = await client.from("images")
        .select("image_name,image_url")
        .eq("property_id", propertyId)
        .gte("cover_select", 1)
        .lte("cover_select", 10)
        .order("cover_select")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("dashboard_unavailable");
      const coverImageUrl = buildHouseImageDisplayUrl({ imageName: nullableText(data?.image_name), imageUrl: nullableText(data?.image_url) });
      if (coverImageUrl) return coverImageUrl;
      const { data: fallback, error: fallbackError } = await client.from("images")
        .select("image_name,image_url")
        .eq("property_id", propertyId)
        .order("image_move")
        .order("id")
        .limit(1)
        .maybeSingle();
      if (fallbackError) throw new Error("dashboard_unavailable");
      return buildHouseImageDisplayUrl({ imageName: nullableText(fallback?.image_name), imageUrl: nullableText(fallback?.image_url) });
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
    async houseDetail(propertyId) {
      const { data: listingData, error: listingError } = await client.from("listings")
        .select("id,property_id,title,description,property_tags,bedrooms,bathrooms,max_guests,location_zone,property_type,is_active,checkin_time,checkout_time,extra_beds,insurance_fee,sort_order,notes,created_at,updated_at")
        .eq("property_id", propertyId)
        .maybeSingle();
      if (listingError) throw new Error("dashboard_unavailable");
      if (!listingData) return null;
      const listing = record(listingData);
      const listingId = text(listing.id);
      const resolvedPropertyId = dashboardPropertyId(listing.property_id);
      if (!resolvedPropertyId || resolvedPropertyId !== propertyId) return null;

      const [{ data: imageData, error: imageError }, { data: priceData, error: priceError }, { data: listingFacilityData, error: listingFacilityError }, { data: facilityData, error: facilityError }] = await Promise.all([
        client.from("images").select("id,image_name,image_url,image_zone,image_move,cover_select").eq("property_id", propertyId).order("image_move").order("id"),
        client.from("listing_prices").select("day_of_week,base_guests,deville_price,agency_price,notes").eq("listing_id", listingId).order("day_of_week").order("id"),
        client.from("listing_facilities").select("facility_id,message,value_boolean").eq("listing_id", listingId).eq("value_boolean", true).order("id"),
        client.from("facilities").select("id,name,title").order("title", { ascending: true }),
      ]);
      if (imageError || priceError || listingFacilityError || facilityError) throw new Error("dashboard_unavailable");

      const facilityById = new Map<string, { name: string | null; title: string | null }>();
      for (const value of facilityData ?? []) {
        const facility = record(value);
        const id = nullableText(facility.id);
        if (id) facilityById.set(id, { name: nullableText(facility.name), title: nullableText(facility.title) });
      }

      return {
        propertyId: resolvedPropertyId,
        title: typeof listing.title === "string" ? listing.title : "ไม่ระบุชื่อบ้าน",
        description: nullableText(listing.description), propertyTags: stringArray(listing.property_tags),
        bedrooms: nullableNumber(listing.bedrooms), bathrooms: nullableNumber(listing.bathrooms), maxGuests: nullableNumber(listing.max_guests),
        locationZone: nullableText(listing.location_zone), propertyType: nullableText(listing.property_type), isActive: nullableBoolean(listing.is_active),
        checkinTime: nullableText(listing.checkin_time), checkoutTime: nullableText(listing.checkout_time), extraBedPrice: nullableNumber(listing.extra_beds),
        insuranceFee: nullableNumber(listing.insurance_fee), sortOrder: nullableNumber(listing.sort_order), notes: nullableText(listing.notes),
        createdAt: text(listing.created_at), updatedAt: nullableText(listing.updated_at),
        images: (imageData ?? []).flatMap(value => {
          const image = record(value);
          const url = buildHouseImageDisplayUrl({ imageName: nullableText(image.image_name), imageUrl: nullableText(image.image_url) });
          const id = dashboardPropertyId(image.id);
          if (!url || !id) return [];
          const zone = nullableText(image.image_zone);
          const coverSelect = nullableNumber(image.cover_select);
          return [{ id, url, zone, order: nullableNumber(image.image_move) ?? 0, isCover: zone === "cover" || (coverSelect !== null && coverSelect >= 1 && coverSelect <= 10) }];
        }),
        prices: (priceData ?? []).map(value => {
          const price = record(value);
          return { dayOfWeek: nullableNumber(price.day_of_week), baseGuests: nullableNumber(price.base_guests), devillePrice: nullableNumber(price.deville_price), agencyPrice: nullableNumber(price.agency_price), note: nullableText(price.notes) };
        }),
        facilities: (listingFacilityData ?? []).flatMap(value => {
          const facility = record(value);
          if (facility.value_boolean !== true) return [];
          const id = nullableText(facility.facility_id);
          const details = id ? facilityById.get(id) : undefined;
          return id && details ? [{ id, name: details.name, title: details.title, message: nullableText(facility.message) }] : [];
        }),
      };
    },
  };
}
