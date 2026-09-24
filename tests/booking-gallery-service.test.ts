import assert from "node:assert/strict";
import { test } from "node:test";
import type { BookingGalleryHouse } from "../lib/booking-gallery.ts";
import type { Booking } from "../lib/house-bookings.ts";
import type { HouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { listBookingGallery } from "../server/services/house-bookings.ts";
import { createHouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const houseA: BookingGalleryHouse = { id: "listing-a", property_id: "101", title: "Alpha", location_zone: "พัทยา" };
const houseB: BookingGalleryHouse = { id: "listing-b", property_id: "102", title: "Beta", location_zone: null };
const booking: Booking = { id: "1", booking_code: "BK1", listing_id: "listing-b", houseid: "102", agent_id: null, customer_id: null, customer: null, check_in: "2026-09-20", check_out: "2026-09-23", status: "confirmed", booking_type: null, price_sell: 0, price_max: null, deposit_amount: 0, extra_charge: 0, quantity: 3, details: null, note: null, updated_at: "2026-09-18T00:00:00Z" };

test("normalises zone and loads only the bounded visible range", async () => {
  const calls: unknown[][] = [];
  const repository = {
    galleryHouses: async (zone: string | null) => { calls.push(["houses", zone]); return [houseA]; },
    galleryBookings: async (houses: BookingGalleryHouse[], start: string, end: string) => { calls.push(["bookings", houses, start, end]); return []; },
  } as unknown as HouseBookingsRepository;
  const cards = await listBookingGallery(repository, { month: "2026-09", zone: " พัทยา ", order: "title", start: "2020-01-01" });
  assert.deepEqual(calls, [["houses", "พัทยา"], ["bookings", [houseA], "2026-08-31", "2026-10-12"]]);
  assert.equal(cards[0].days["2026-10-11"].tone, "free");
});

test("booked order puts the fullest house first and title order remains alphabetical", async () => {
  const repository = {
    galleryHouses: async () => [houseA, houseB],
    galleryBookings: async () => [booking],
  } as unknown as HouseBookingsRepository;
  const bookedCards = await listBookingGallery(repository, { month: "2026-09", order: "booked" });
  assert.deepEqual(bookedCards.map(card => card.propertyId), ["102", "101"]);
  assert.deepEqual(bookedCards.map(card => card.bookedNights), [3, 0]);
  const titleCards = await listBookingGallery(repository, { month: "2026-09", order: "title" });
  assert.deepEqual(titleCards.map(card => card.propertyId), ["101", "102"]);
});

test("empty house selection skips booking reads", async () => {
  const repository = {
    galleryHouses: async () => [],
    galleryBookings: async () => { throw new Error("unexpected bookings read"); },
  } as unknown as HouseBookingsRepository;
  assert.deepEqual(await listBookingGallery(repository, { month: "2026-09" }), []);
});

test("repository reads zone-matched listings and scopes each booking read to its house pair", async () => {
  const requests: { table: string; fields: string; filters: Record<string, unknown>; start: number; end: number }[] = [];
  const bookingRow = { ...booking, listing_id: "listing-a", houseid: "101", customer: null };
  const client = {
    from(table: string) {
      const request = { table, fields: "", filters: {} as Record<string, unknown>, start: 0, end: 0 };
      requests.push(request);
      const query = {
        select(fields: string) { request.fields = fields; return query; },
        order() { return query; },
        range(start: number, end: number) { request.start = start; request.end = end; return query; },
        eq(field: string, value: unknown) { request.filters[field] = value; return query; },
        lt(field: string, value: unknown) { request.filters[`lt:${field}`] = value; return query; },
        gt(field: string, value: unknown) { request.filters[`gt:${field}`] = value; return query; },
        then(resolve: (result: { data: unknown[]; error: null }) => void) {
          const data = table === "listings" ? [houseA] : [bookingRow];
          resolve({ data, error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  const repository = createHouseBookingsRepository(client);
  const houses = await repository.galleryHouses("พัทยา");
  assert.deepEqual(houses, [houseA]);
  const bookings = await repository.galleryBookings(houses, "2026-08-31", "2026-10-12");
  assert.equal(bookings[0].id, "1");
  assert.deepEqual(requests[0].filters, { location_zone: "พัทยา" });
  assert.equal(requests[0].fields, "id,property_id,title,location_zone");
  assert.deepEqual(requests[1].filters, { listing_id: "listing-a", houseid: "101", "lt:check_in": "2026-10-12", "gt:check_out": "2026-08-31" });
});
