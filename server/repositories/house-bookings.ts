import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingId, record, type Booking, type BookingCustomer, type BookingUpdate } from "../../lib/house-bookings.ts";

export interface BookingHouse { id: string; property_id: string; title: string }
const selection = "id,booking_code,listing_id,houseid,agent_id,customer_id,booking_type,status,check_in,check_out,price_sell,price_max,deposit_amount,extra_charge,quantity,details,note,updated_at,customer:customers(id,first_name,last_name,phone)";
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
  return { id: bookingId(b.id), booking_code: text(b.booking_code), listing_id: text(b.listing_id), houseid: bookingId(b.houseid), agent_id: b.agent_id == null ? null : bookingId(b.agent_id), customer_id: b.customer_id == null ? null : bookingId(b.customer_id), customer: b.customer ? mapBookingCustomer(b.customer) : null, check_in: text(b.check_in), check_out: text(b.check_out), status: text(b.status), booking_type: nullableText(b.booking_type), price_sell: number(b.price_sell), price_max: b.price_max == null ? null : number(b.price_max), deposit_amount: number(b.deposit_amount), extra_charge: number(b.extra_charge), quantity: number(b.quantity), details: nullableText(b.details), note: nullableText(b.note), updated_at: text(b.updated_at) };
}
export function createHouseBookingsRepository(client: SupabaseClient) {
  return {
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
    async customers(query: string): Promise<BookingCustomer[]> {
      let request = client.from("customers").select("id,first_name,last_name,phone").order("first_name").order("id").limit(20);
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
