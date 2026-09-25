import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GalleryBookingSlice, GalleryHouseSummary, GalleryPageInput } from "../../lib/booking-gallery.ts";
import { CUSTOMER_FIELDS, normalizeBookingPhone, type BookingCustomerDetail, type BookingCustomerInput } from "../../lib/booking-customers.ts";
import { bookingId, record, type Booking, type BookingCreate, type BookingCustomer, type BookingUpdate, type BookingHouseInformation } from "../../lib/house-bookings.ts";

export interface BookingHouse { id: string; property_id: string; title: string }
const customerDetailSelection = `id,first_name,last_name,phone,customer_type,vip_status,tax_head_office,updated_at,dv_id,${CUSTOMER_FIELDS.map(field => field.key).join(",")}`;
function mapCustomerDetail(value: unknown): BookingCustomerDetail {
  const row = record(value);
  const customer: BookingCustomerDetail = { ...mapBookingCustomer(value), customer_type: nullableText(row.customer_type), vip_status: row.vip_status == null ? null : row.vip_status === true, tax_head_office: row.tax_head_office == null ? null : row.tax_head_office === true, updated_at: nullableText(row.updated_at), dv_id: row.dv_id == null ? null : bookingId(row.dv_id) };
  for (const field of CUSTOMER_FIELDS) customer[field.key] = nullableText(row[field.key]);
  return customer;
}
const selection = "id,booking_code,listing_id,houseid,agent_id,customer_id,booking_type,status,check_in,check_out,price_sell,price_max,deposit_amount,extra_charge,quantity,details,note,updated_at,customer:customers(id,first_name,last_name,phone,dv_id)";
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function nullableText(value: unknown): string | null { return value == null ? null : text(value); }
function number(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(n)) throw new Error("invalid_booking_data");
  return n;
}
export function mapBookingCustomer(value: unknown): BookingCustomer {
  const c = record(value);
  return { id: bookingId(c.id), first_name: text(c.first_name), last_name: nullableText(c.last_name), phone: text(c.phone) };
}
export function mapBooking(value: unknown): Booking {
  const b = record(value);
  return { id: bookingId(b.id), booking_code: text(b.booking_code), listing_id: text(b.listing_id), houseid: bookingId(b.houseid), agent_id: b.agent_id == null ? null : bookingId(b.agent_id), customer_id: b.customer_id == null ? null : bookingId(b.customer_id), customer: b.customer && record(b.customer).dv_id != null && bookingId(record(b.customer).dv_id) === bookingId(b.houseid) ? mapBookingCustomer(b.customer) : null, check_in: text(b.check_in), check_out: text(b.check_out), status: text(b.status), booking_type: nullableText(b.booking_type), price_sell: number(b.price_sell), price_max: b.price_max == null ? null : number(b.price_max), deposit_amount: number(b.deposit_amount), extra_charge: number(b.extra_charge), quantity: number(b.quantity), details: nullableText(b.details), note: nullableText(b.note), updated_at: text(b.updated_at) };
}
export function mapBookingGalleryHouse(value: unknown): GalleryHouseSummary {
  const row = record(value);
  return { id: text(row.id), property_id: bookingId(row.property_id), title: text(row.title), location_zone: nullableText(row.location_zone), is_active: typeof row.is_active === "boolean" ? row.is_active : null };
}
function galleryPropertySearch(search: string): string | null {
  // Only an exact raw or DV-prefixed decimal ID enters the PostgREST or grammar.
  const property = /^(?:dv\s*)?([1-9]\d{0,18})$/i.exec(search)?.[1];
  return property && BigInt(property) <= BigInt("9223372036854775807") ? property : null;
}
function galleryLiteralTitlePattern(search: string): string {
  // PostgREST treats * as a LIKE wildcard alias. A regex filter keeps every
  // search character literal, including *, %, _, and backslashes.
  return search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function mapGalleryBookingSlice(value: unknown): GalleryBookingSlice {
  const row = record(value);
  return { id: bookingId(row.id), listing_id: text(row.listing_id), houseid: bookingId(row.houseid), check_in: text(row.check_in), check_out: text(row.check_out), status: nullableText(row.status) };
}
export function createHouseBookingsRepository(client: SupabaseClient) {
  return {
    async houseInformation(propertyId: string): Promise<BookingHouseInformation | null> {
      const { data, error } = await client.from("listings")
        .select("extra_beds,insurance_fee,checkin_time,checkout_time").eq("property_id", propertyId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = record(data);
      return { extra_beds: row.extra_beds == null ? null : number(row.extra_beds),
        insurance_fee: row.insurance_fee == null ? null : number(row.insurance_fee),
        checkin_time: nullableText(row.checkin_time), checkout_time: nullableText(row.checkout_time) };
    },
    async galleryHousePage(input: GalleryPageInput): Promise<{ houses: GalleryHouseSummary[]; total: number }> {
      const property = input.searchMode === "dv" && input.search ? galleryPropertySearch(input.search) : null;
      if (input.searchMode === "dv" && input.search && !property) return { houses: [], total: 0 };
      let query = client.from("listings").select("id,property_id,title,location_zone,is_active", { count: "exact" })
        .order("property_id", { ascending: true }).range((input.page - 1) * 6, input.page * 6 - 1);
      if (input.search) {
        if (property) query = query.eq("property_id", property);
        else query = query.regexIMatch("title", galleryLiteralTitlePattern(input.search));
      }
      const { data, count, error } = await query;
      if (error) throw error;
      return { houses: (data ?? []).map(mapBookingGalleryHouse), total: count ?? 0 };
    },
    async galleryHousesByPropertyIds(propertyIds: string[]): Promise<GalleryHouseSummary[]> {
      const { data, error } = await client.from("listings").select("id,property_id,title,location_zone,is_active").in("property_id", propertyIds);
      if (error) throw error;
      const wanted = new Set(propertyIds);
      return (data ?? []).map(mapBookingGalleryHouse).filter(house => wanted.has(house.property_id));
    },
    async galleryBookingSlices(houses: GalleryHouseSummary[], start: string, end: string): Promise<GalleryBookingSlice[]> {
      const pairs = houses.filter(house => /^[a-zA-Z0-9-]+$/.test(house.id) && /^[1-9]\d{0,18}$/.test(house.property_id))
        .map(house => `and(listing_id.eq.${house.id},houseid.eq.${house.property_id})`);
      if (pairs.length !== houses.length) throw new Error("invalid_gallery_house_pair");
      if (pairs.length === 0) return [];
      const allowed = new Set(houses.map(house => `${house.id}:${house.property_id}`));
      const rows: GalleryBookingSlice[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from("bookings").select("id,listing_id,houseid,check_in,check_out,status")
          .or(pairs.join(",")).lt("check_in", end).gt("check_out", start).order("check_in").order("id").range(from, from + 499);
        if (error) throw error;
        const page: unknown[] = data ?? [];
        rows.push(...page.map(mapGalleryBookingSlice).filter(row => allowed.has(`${row.listing_id}:${row.houseid}`)));
        if (page.length < 500) return rows;
      }
    },
    async house(propertyId: string): Promise<BookingHouse | null> {
      const { data, error } = await client.from("listings").select("id,property_id,title").eq("property_id", propertyId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = record(data);
      return { id: text(row.id), property_id: bookingId(row.property_id), title: text(row.title) };
    },
    async list(house: BookingHouse, start: string, end: string): Promise<Booking[]> {
      const result: Booking[] = [];
      // Explicit pagination avoids silently hiding events beyond PostgREST's row cap.
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from("bookings").select(selection).eq("listing_id", house.id).eq("houseid", house.property_id).lt("check_in", end).gt("check_out", start).order("check_in").order("id").range(from, from + 499);
        if (error) throw error;
        const rows: unknown[] = data ?? [];
        result.push(...rows.map(mapBooking));
        if (rows.length < 500) return result;
      }
    },
    async get(house: BookingHouse, id: string): Promise<Booking | null> {
      const { data, error } = await client.from("bookings").select(selection).eq("listing_id", house.id).eq("houseid", house.property_id).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapBooking(data) : null;
    },
    async customers(house: BookingHouse, query: string): Promise<BookingCustomer[]> {
      let request = client.from("customers").select("id,first_name,last_name,phone").eq("dv_id", house.property_id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(query ? 20 : 5);
      if (query) {
        // No raw PostgREST operators, wildcards or punctuation from user input.
        const escaped = query.replace(/[^\p{L}\p{N}\s@+\-]/gu, " ").trim();
        if (!escaped) return [];
        request = request.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
      }
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map(mapBookingCustomer);
    },
    async customersByPhone(house: BookingHouse, phone: string): Promise<BookingCustomer[]> {
      // A digits-only suffix finds legacy spacing and Thai +66 formats safely.
      const suffix = phone.replace(/\D/g, "").slice(-8).split("").join("%");
      const matches: BookingCustomer[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from("customers").select("id,first_name,last_name,phone")
          .eq("dv_id", house.property_id).ilike("phone", `%${suffix}%`).order("id").range(from, from + 499);
        if (error) throw error;
        const rows = (data ?? []).map(mapBookingCustomer);
        matches.push(...rows.filter(customer => normalizeBookingPhone(customer.phone) === phone));
        if (rows.length < 500) return matches;
      }
    },
    async createCustomer(house: BookingHouse, input: BookingCustomerInput): Promise<BookingCustomer> {
      const { data, error } = await client.from("customers").insert({ ...input, dv_id: house.property_id })
        .select("id,first_name,last_name,phone").single();
      if (error) throw error;
      return mapBookingCustomer(data);
    },
    async customerDetail(house: BookingHouse, id: string): Promise<BookingCustomerDetail | null> {
      const { data, error } = await client.from("customers").select(customerDetailSelection).eq("dv_id", house.property_id).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapCustomerDetail(data) : null;
    },
    async updateCustomer(house: BookingHouse, id: string, revision: string | null, input: BookingCustomerInput): Promise<BookingCustomer> {
      let query = client.from("customers").update({ ...input, updated_at: new Date().toISOString() }).eq("dv_id", house.property_id).eq("id", id);
      query = revision === null ? query.is("updated_at", null) : query.eq("updated_at", revision);
      const { data, error } = await query.select("id,first_name,last_name,phone").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("ข้อมูลลูกค้าถูกแก้ไขแล้ว กรุณาปิดและเปิดฟอร์มใหม่");
      return mapBookingCustomer(data);
    },
    async ownsCustomer(house: BookingHouse, id: string): Promise<boolean> {
      const { data, error } = await client.from("customers").select("id").eq("dv_id", house.property_id).eq("id", id).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async create(house: BookingHouse, actorId: string, input: BookingCreate): Promise<Booking> {
      const { request_id, ...values } = input;
      const { data, error } = await client.rpc("admin_create_house_booking", { p_property_id: house.property_id, p_request_id: request_id, p_actor_id: actorId, p_values: values });
      if (error) throw error;
      const saved = await this.get(house, bookingId(data));
      if (!saved) throw new Error("booking_not_found");
      return saved;
    },
    async update(house: BookingHouse, actorId: string, input: BookingUpdate): Promise<Booking> {
      const { error } = await client.rpc("admin_update_house_booking", { p_property_id: house.property_id, p_booking_id: input.id, p_expected_updated_at: input.updated_at, p_actor_id: actorId, p_values: { check_in: input.check_in, check_out: input.check_out, customer_id: input.customer_id, status: input.status, quantity: input.quantity, price_sell: input.price_sell, price_max: input.price_max, extra_charge: input.extra_charge, note: input.note } });
      if (error) throw error;
      const saved = await this.get(house, input.id);
      if (!saved) throw new Error("booking_not_found");
      return saved;
    },
  };
}
export type HouseBookingsRepository = ReturnType<typeof createHouseBookingsRepository>;
