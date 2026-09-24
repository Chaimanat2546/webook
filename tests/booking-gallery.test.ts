import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBookingGallery, parseBookingGalleryQuery, type BookingGalleryHouse } from "../lib/booking-gallery.ts";
import type { Booking } from "../lib/house-bookings.ts";
import * as galleryView from "../lib/booking-gallery.ts";

const houseA: BookingGalleryHouse = { id: "listing-a", property_id: "101", title: "Alpha", location_zone: "พัทยา" };
const houseB: BookingGalleryHouse = { id: "listing-b", property_id: "102", title: "Beta", location_zone: null };
const booking: Booking = { id: "1", booking_code: "BK1", listing_id: "listing-a", houseid: "101", agent_id: null, customer_id: null, customer: null, check_in: "2026-09-30", check_out: "2026-10-03", status: "confirmed", booking_type: null, price_sell: 0, price_max: null, deposit_amount: 0, extra_charge: 0, quantity: 3, details: null, note: null, updated_at: "2026-09-18T00:00:00Z" };

test("house search matches title or DV property ID and paginates six results", () => {
  const cards = Array.from({ length: 13 }, (_, index) => ({ ...buildBookingGallery([houseA], [], "2026-09")[0], propertyId: `DV-${index + 1}`, title: index === 8 ? "Sea Breeze" : `House ${index + 1}` }));
  const page = galleryView.paginateBookingGallery(cards, "", 2);
  assert.equal(page.total, 13);
  assert.equal(page.pageCount, 3);
  assert.deepEqual(page.cards.map(card => card.propertyId), ["DV-7", "DV-8", "DV-9", "DV-10", "DV-11", "DV-12"]);
  assert.deepEqual(galleryView.paginateBookingGallery(cards, " sea ", 2).cards.map(card => card.propertyId), ["DV-9"]);
  assert.deepEqual(galleryView.paginateBookingGallery(cards, "dv-12", 1).cards.map(card => card.propertyId), ["DV-12"]);
  assert.deepEqual(galleryView.paginateBookingGallery(cards, "dV DV-12", 1).cards.map(card => card.propertyId), ["DV-12"]);
  assert.deepEqual(galleryView.paginateBookingGallery([{ ...cards[0], propertyId: "1003" }], "DV 1003", 1).cards.map(card => card.propertyId), ["1003"]);
  assert.deepEqual(galleryView.paginateBookingGallery(cards, "missing", 1).cards, []);
  assert.equal(galleryView.paginateBookingGallery(cards, "", 99).page, 3);
});

test("per-house month lookup never displays another month or a failed load as availability", () => {
  const septemberCard = buildBookingGallery([houseA], [booking], "2026-09")[0];
  const octoberCard = buildBookingGallery([houseA], [booking], "2026-10")[0];
  const months = {
    "2026-09": { status: "ready" as const, cards: [septemberCard] },
    "2026-10": { status: "loading" as const },
  };
  assert.equal(galleryView.bookingGalleryCardForMonth("101", "2026-09", months).card?.days["2026-09-30"].tone, "confirmed");
  assert.equal(galleryView.bookingGalleryCardForMonth("101", "2026-10", months).card, null);
  assert.equal(galleryView.bookingGalleryCardForMonth("102", "2026-09", months).card, null);
  assert.equal(galleryView.bookingGalleryCardForMonth("101", "2026-10", { ...months, "2026-10": { status: "error", message: "failed" } }).card, null);
  assert.equal(galleryView.bookingGalleryCardForMonth("101", "2026-10", { ...months, "2026-10": { status: "ready", cards: [octoberCard] } }).card?.days["2026-10-01"].tone, "confirmed");
});

test("a booking save refreshes every visited month because stays may cross months", () => {
  const months = {
    "2026-09": { status: "ready" as const, cards: [] },
    "2026-10": { status: "ready" as const, cards: [] },
    "2026-11": { status: "error" as const, message: "failed" },
  };
  assert.deepEqual(galleryView.bookingGalleryMonthsToRefresh(months), ["2026-09", "2026-10", "2026-11"]);
});

test("pagination keeps large portfolios to five numbered controls around the current page", () => {
  assert.deepEqual(galleryView.bookingGalleryPageNumbers(1, 30), [1, 2, 3, "ellipsis", 30]);
  assert.deepEqual(galleryView.bookingGalleryPageNumbers(15, 30), [1, "ellipsis", 14, 15, 16, "ellipsis", 30]);
  assert.deepEqual(galleryView.bookingGalleryPageNumbers(30, 30), [1, "ellipsis", 28, 29, 30]);
  assert.deepEqual(galleryView.bookingGalleryPageNumbers(2, 3), [1, 2, 3]);
});

test("query bounds September to its Monday-first six-week grid and normalises zone", () => {
  assert.deepEqual(parseBookingGalleryQuery({ month: "2026-09", zone: " พัทยา ", order: "booked", start: "2020-01-01", end: "2030-01-01" }), {
    month: "2026-09", start: "2026-08-31", end: "2026-10-12", zone: "พัทยา", order: "booked",
  });
  assert.deepEqual(parseBookingGalleryQuery({ month: "2026-09", zone: "   " }), {
    month: "2026-09", start: "2026-08-31", end: "2026-10-12", zone: null, order: "title",
  });
});

test("query rejects malformed months, zones and order", () => {
  for (const input of [{ month: "2026-13" }, { month: "2026-9" }, { month: "0000-01" }, { month: "9999-12" }, { month: "2026-09", zone: 2 }, { month: "2026-09", zone: "x".repeat(121) }, { month: "2026-09", order: "price" }]) {
    assert.throws(() => parseBookingGalleryQuery(input));
  }
});

test("keeps empty house and checkout is exclusive across the month boundary", () => {
  const cards = buildBookingGallery([houseA, houseB], [booking], "2026-09");
  assert.equal(Object.keys(cards[0].days).length, 42);
  assert.equal(cards[0].days["2026-08-31"].tone, "free");
  assert.equal(cards[0].days["2026-09-30"].tone, "confirmed");
  assert.equal(cards[0].days["2026-10-01"].tone, "confirmed");
  assert.equal(cards[0].days["2026-10-03"].tone, "free");
  assert.equal(cards[0].bookedNights, 1);
  assert.equal(cards[1].bookedNights, 0);
  assert.equal(cards[1].zone, null);
  assert.equal(cards[1].days["2026-09-30"].tone, "free");
});

test("paints waiting and repair but never cancelled bookings", () => {
  const cards = buildBookingGallery([houseA], [
    { ...booking, id: "2", check_in: "2026-09-20", check_out: "2026-09-21", status: "cancelled" },
    { ...booking, id: "3", check_in: "2026-09-21", check_out: "2026-09-22", status: "waiting" },
    { ...booking, id: "4", check_in: "2026-09-22", check_out: "2026-09-23", status: "repair" },
  ], "2026-09");
  assert.equal(cards[0].days["2026-09-20"].tone, "free");
  assert.deepEqual(cards[0].days["2026-09-21"], { date: "2026-09-21", tone: "waiting", bookingId: "3" });
  assert.deepEqual(cards[0].days["2026-09-22"], { date: "2026-09-22", tone: "repair", bookingId: "4" });
  assert.equal(cards[0].bookedNights, 1);
});

test("legacy non-cancelled status occupies nights with an edit target while cancelled and checkout stay free", () => {
  const cards = buildBookingGallery([houseA], [
    { ...booking, id: "legacy-1", check_in: "2026-09-20", check_out: "2026-09-22", status: "legacy_hold" },
    { ...booking, id: "cancelled-1", check_in: "2026-09-23", check_out: "2026-09-24", status: "cancelled" },
  ], "2026-09");
  assert.deepEqual(cards[0].days["2026-09-20"], { date: "2026-09-20", tone: "unknown", bookingId: "legacy-1" });
  assert.deepEqual(cards[0].days["2026-09-21"], { date: "2026-09-21", tone: "unknown", bookingId: "legacy-1" });
  assert.deepEqual(cards[0].days["2026-09-22"], { date: "2026-09-22", tone: "free", bookingId: null });
  assert.deepEqual(cards[0].days["2026-09-23"], { date: "2026-09-23", tone: "free", bookingId: null });
  assert.equal(cards[0].bookedNights, 2);
});

test("ignores bookings whose listing and property pair is not the card's house", () => {
  const cards = buildBookingGallery([houseA, houseB], [{ ...booking, houseid: "102" }], "2026-09");
  assert.equal(cards[0].bookedNights, 0);
  assert.equal(cards[1].bookedNights, 0);
});

test("summary counts occupied dates once when stale overlapping rows are returned", () => {
  const cards = buildBookingGallery([houseA], [
    { ...booking, check_in: "2026-09-20", check_out: "2026-09-22" },
    { ...booking, id: "2", check_in: "2026-09-21", check_out: "2026-09-23", status: "waiting" },
  ], "2026-09");
  assert.equal(cards[0].bookedNights, 3);
});
