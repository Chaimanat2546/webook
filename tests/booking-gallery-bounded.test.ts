import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGalleryCalendarInput, parseGalleryPageInput, buildBookingGallery, type GalleryHouseSummary } from "../lib/booking-gallery.ts";
import { createHouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { listBookingGalleryCalendars, listBookingGalleryHouses } from "../server/services/house-bookings.ts";

const house = (number: number): GalleryHouseSummary => ({ id: `listing-${number}`, property_id: String(number), title: `House ${number}`, location_zone: null });

test("page input limits page and search before any repository read", async () => {
  let reads = 0;
  const repository = { galleryHousePage: async () => { reads++; return { houses: [], total: 0 }; } } as unknown as ReturnType<typeof createHouseBookingsRepository>;
  for (const input of [{ page: 0 }, { page: -1 }, { page: 1.5 }, { page: 100001 }, { page: "2" }, { search: "x".repeat(121) }]) {
    await assert.rejects(() => listBookingGalleryHouses(repository, input));
  }
  assert.equal(reads, 0);
  assert.deepEqual(parseGalleryPageInput({ page: 2, search: "  DV 103  " }), { page: 2, search: "DV 103" });
});

test("house page has exactly six ordered entries and a total independent of bookings", async () => {
  const calls: unknown[][] = [];
  const repository = { galleryHousePage: async (query: { page: number; search: string }) => {
    calls.push([query.page, query.search]); return { houses: Array.from({ length: 6 }, (_, index) => house(index + 7)), total: 13 };
  } } as ReturnType<typeof createHouseBookingsRepository>;
  const result = await listBookingGalleryHouses(repository, { page: 2, search: " House " });
  assert.deepEqual(calls, [[2, "House"]]);
  assert.equal(result.total, 13);
  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.houses.map(item => item.property_id), ["7", "8", "9", "10", "11", "12"]);
});

test("calendar validation rejects empty, duplicate, oversize and malformed IDs before reads", async () => {
  let reads = 0;
  const repository = { galleryHousesByPropertyIds: async () => { reads++; return []; } } as unknown as ReturnType<typeof createHouseBookingsRepository>;
  for (const propertyIds of [[], ["101", "101"], Array.from({ length: 7 }, (_, index) => String(index + 1)), ["0"], ["1)"], ["9223372036854775808"]]) {
    await assert.rejects(() => listBookingGalleryCalendars(repository, { month: "2026-09", propertyIds }));
  }
  await assert.rejects(() => listBookingGalleryCalendars(repository, { month: "2026-13", propertyIds: ["101"] }));
  assert.equal(reads, 0);
  assert.deepEqual(parseGalleryCalendarInput({ month: "2026-09", propertyIds: ["101"] }), { month: "2026-09", start: "2026-08-31", end: "2026-10-12", propertyIds: ["101"] });
});

test("calendar service resolves requested houses and reads only their booking pairs", async () => {
  const calls: unknown[][] = [];
  const repository = {
    galleryHousesByPropertyIds: async (ids: string[]) => { calls.push(["resolve", ids]); return [house(101)]; },
    galleryBookingSlices: async (houses: GalleryHouseSummary[], start: string, end: string) => { calls.push(["bookings", houses, start, end]); return []; },
  } as unknown as ReturnType<typeof createHouseBookingsRepository>;
  const cards = await listBookingGalleryCalendars(repository, { month: "2026-09", propertyIds: ["101"] });
  assert.deepEqual(calls, [["resolve", ["101"]], ["bookings", [house(101)], "2026-08-31", "2026-10-12"]]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].days["2026-10-11"].tone, "free");
});

test("unknown and null booking statuses occupy dates, while checkout and wrong pair remain free", () => {
  const cards = buildBookingGallery([house(101)], [
    { id: "1", listing_id: "listing-101", houseid: "101", check_in: "2026-09-20", check_out: "2026-09-22", status: null },
    { id: "2", listing_id: "listing-other", houseid: "101", check_in: "2026-09-23", check_out: "2026-09-24", status: "confirmed" },
  ], "2026-09");
  assert.equal(cards[0].days["2026-09-20"].tone, "unknown");
  assert.equal(cards[0].days["2026-09-21"].bookingId, "1");
  assert.equal(cards[0].days["2026-09-22"].tone, "free");
  assert.equal(cards[0].days["2026-09-23"].tone, "free");
});

test("repository pages listings in DB and searches title, raw DV and prefixed DV", async () => {
  const requests: Array<{ fields: string; range: number[]; or: string; regex: string; orders: string[]; count: string }> = [];
  const client = { from() {
    const request = { fields: "", range: [] as number[], or: "", regex: "", orders: [] as string[], count: "" }; requests.push(request);
    const query = {
      select(fields: string, options?: { count?: string }) { request.fields = fields; request.count = options?.count ?? ""; return query; },
      order(field: string) { request.orders.push(field); return query; },
      range(start: number, end: number) { request.range = [start, end]; return query; },
      or(filter: string) { request.or = filter; return query; },
      regexIMatch(field: string, pattern: string) { request.regex = `${field}:${pattern}`; return query; },
      then(resolve: (result: { data: GalleryHouseSummary[]; count: number; error: null }) => void) { resolve({ data: [house(7)], count: 13, error: null }); },
    }; return query;
  } } as unknown as SupabaseClient;
  const repository = createHouseBookingsRepository(client);
  await repository.galleryHousePage({ page: 2, search: "Sea" });
  await repository.galleryHousePage({ page: 1, search: "101" });
  await repository.galleryHousePage({ page: 1, search: "DV 101" });
  await repository.galleryHousePage({ page: 1, search: "Sea & Sun" });
  assert.deepEqual(requests.map(request => request.range), [[6, 11], [0, 5], [0, 5], [0, 5]]);
  assert.deepEqual(requests[0].orders, ["title", "property_id"]);
  assert.equal(requests[0].count, "exact");
  assert.equal(requests[0].regex, "title:Sea");
  assert.match(requests[1].or, /property_id\.eq\.101/);
  assert.match(requests[2].or, /property_id\.eq\.101/);
  assert.equal(requests[3].regex, "title:Sea & Sun");
  assert.equal(requests[0].fields, "id,property_id,title,location_zone");
});

test("title search treats asterisk and mixed wildcard characters as literal substrings", async () => {
  const patterns: string[] = [];
  const client = { from() {
    const query = {
      select() { return query; }, order() { return query; }, range() { return query; },
      regexIMatch(_field: string, pattern: string) { patterns.push(pattern); return query; },
      ilike() { assert.fail("LIKE wildcard alias must not be used for arbitrary title search"); },
      then(resolve: (result: { data: unknown[]; count: number; error: null }) => void) { resolve({ data: [], count: 0, error: null }); },
    }; return query;
  } } as unknown as SupabaseClient;
  const repository = createHouseBookingsRepository(client);
  await repository.galleryHousePage({ page: 1, search: "*" });
  await repository.galleryHousePage({ page: 1, search: "Sea%_\\*" });
  assert.deepEqual(["Sea* View", "Sea View", "Asterisk *"].filter(title => new RegExp(patterns[0], "i").test(title)), ["Sea* View", "Asterisk *"]);
  assert.deepEqual(["Sea%_\\* Pool", "SeaXX Pool", "Sea%_\\ Pool"].filter(title => new RegExp(patterns[1], "i").test(title)), ["Sea%_\\* Pool"]);
});

test("repository paginates dense minimal booking rows with exact pair filter", async () => {
  const requests: Array<{ fields: string; filters: Record<string, unknown>; range: number[] }> = [];
  const client = { from(table: string) {
    assert.equal(table, "bookings");
    const request = { fields: "", filters: {} as Record<string, unknown>, range: [] as number[] }; requests.push(request);
    const query = {
      select(fields: string) { request.fields = fields; return query; },
      or(filter: string) { request.filters.pairs = filter; return query; },
      lt(field: string, value: unknown) { request.filters[`lt:${field}`] = value; return query; },
      gt(field: string, value: unknown) { request.filters[`gt:${field}`] = value; return query; },
      order() { return query; },
      range(start: number, end: number) { request.range = [start, end]; return query; },
      then(resolve: (result: { data: unknown[]; error: null }) => void) {
        const row = { id: "1", listing_id: "listing-101", houseid: "101", check_in: "2026-09-20", check_out: "2026-09-21", status: null };
        resolve({ data: request.range[0] === 0 ? Array.from({ length: 500 }, () => row) : [{ ...row, listing_id: "listing-102", houseid: "101" }], error: null });
      },
    }; return query;
  } } as unknown as SupabaseClient;
  const rows = await createHouseBookingsRepository(client).galleryBookingSlices([house(101), house(102)], "2026-08-31", "2026-10-12");
  assert.equal(rows.length, 500);
  assert.deepEqual(requests.map(request => request.range), [[0, 499], [500, 999]]);
  assert.equal(requests[0].fields, "id,listing_id,houseid,check_in,check_out,status");
  assert.equal(requests[0].filters.pairs, "and(listing_id.eq.listing-101,houseid.eq.101),and(listing_id.eq.listing-102,houseid.eq.102)");
  assert.deepEqual(requests[0].filters["lt:check_in"], "2026-10-12");
  assert.deepEqual(requests[0].filters["gt:check_out"], "2026-08-31");
});
