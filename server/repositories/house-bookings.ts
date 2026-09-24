import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingGalleryHouse } from "../../lib/booking-gallery.ts";
import { CUSTOMER_FIELDS, normalizeBookingPhone, type BookingCustomerDetail, type BookingCustomerInput } from "../../lib/booking-customers.ts";
import { bookingId, record, type Booking, type BookingCreate, type BookingCustomer, type BookingUpdate } from "../../lib/house-bookings.ts";

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
export function mapBookingGalleryHouse(value: unknown): BookingGalleryHouse {
  const row = record(value);
  return { id: text(row.id), property_id: bookingId(row.property_id), title: text(row.title), location_zone: nullableText(row.location_zone) };
}
export function createHouseBookingsRepository(client: SupabaseClient) {
  return {
    async galleryHouses(zone: string | null): Promise<BookingGalleryHouse[]> {
      const houses: BookingGalleryHouse[] = [];
      for (let from = 0; ; from += 500) {
        let query = client.from("listings").select("id,property_id,title,location_zone").order("title").order("property_id").range(from, from + 499);
        if (zone) query = query.eq("location_zone", zone);
        const { data, error } = await query;
        if (error) throw error;
        const rows: unknown[] = data ?? [];
        houses.push(...rows.map(mapBookingGalleryHouse));
        if (rows.length < 500) return houses;
      }
    },
    async galleryBookings(houses: BookingGalleryHouse[], start: string, end: string): Promise<Booking[]> {
      const bookings: Booking[] = [];
      for (let index = 0; index < houses.length; index += 5) {
        const batches = await Promise.all(houses.slice(index, index + 5).map(house => this.list(house, start, end)));
        bookings.push(...batches.flat());
      }
      return bookings;
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
