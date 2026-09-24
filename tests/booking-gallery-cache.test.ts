import assert from "node:assert/strict";
import { test } from "node:test";
import { GalleryPairCache, groupGalleryPairsByMonth } from "../lib/booking-gallery-cache.ts";
import type { BookingGalleryCard } from "../lib/booking-gallery.ts";

const card = (propertyId: string): BookingGalleryCard => ({ propertyId, title: propertyId, zone: null, bookedNights: 0, days: {} });

test("cache groups only missing visible house/month pairs", () => {
  const cache = new GalleryPairCache();
  const token = cache.start("101", "2026-09", 100);
  assert.ok(token);
  cache.resolve("101", "2026-09", token, card("101"), 100);
  assert.deepEqual(groupGalleryPairsByMonth(cache, [{ propertyId: "101", month: "2026-09" }, { propertyId: "102", month: "2026-09" }, { propertyId: "103", month: "2026-10" }], 101), [
    { month: "2026-09", propertyIds: ["102"] }, { month: "2026-10", propertyIds: ["103"] },
  ]);
});

test("cache expires at 30 seconds and never treats error/loading as availability", () => {
  const cache = new GalleryPairCache();
  const token = cache.start("101", "2026-09", 100);
  assert.equal(cache.read("101", "2026-09", 100)?.status, "loading");
  assert.ok(token);
  cache.resolve("101", "2026-09", token, card("101"), 100);
  assert.equal(cache.read("101", "2026-09", 30099)?.status, "ready");
  assert.equal(cache.read("101", "2026-09", 30100), null);
  const retry = cache.start("101", "2026-09", 30100);
  assert.ok(retry);
  cache.reject("101", "2026-09", retry, "failed");
  assert.deepEqual(cache.read("101", "2026-09", 30100), { status: "error", message: "failed" });
});

test("returning to a page after freshness expiry shows loading and schedules only expired pairs", () => {
  const cache = new GalleryPairCache();
  const first = cache.start("101", "2026-09", 0);
  const second = cache.start("102", "2026-09", 0);
  assert.ok(first && second);
  cache.resolve("101", "2026-09", first, card("101"), 0);
  cache.resolve("102", "2026-09", second, card("102"), 10_000);
  assert.equal(cache.snapshot(30_001)["101:2026-09"], undefined);
  assert.equal(cache.snapshot(30_001)["102:2026-09"].status, "ready");
  assert.deepEqual(groupGalleryPairsByMonth(cache, [
    { propertyId: "101", month: "2026-09" }, { propertyId: "102", month: "2026-09" },
  ], 30_001), [{ month: "2026-09", propertyIds: ["101"] }]);
});

test("late response after house invalidation cannot overwrite a newer request", () => {
  const cache = new GalleryPairCache();
  const old = cache.start("101", "2026-09", 100);
  cache.start("102", "2026-09", 100);
  assert.ok(old);
  cache.invalidateHouse("101");
  const latest = cache.start("101", "2026-09", 200);
  assert.ok(latest);
  assert.equal(cache.resolve("101", "2026-09", old, card("101"), 201), false);
  assert.equal(cache.read("101", "2026-09", 201)?.status, "loading");
  assert.equal(cache.resolve("101", "2026-09", latest, card("101"), 202), true);
  assert.equal(cache.read("102", "2026-09", 202)?.status, "loading");
});

test("cache is bounded to 24 pairs and evicted inflight responses cannot reappear", () => {
  const cache = new GalleryPairCache();
  const old = cache.start("1", "2026-09", 0);
  assert.ok(old);
  for (let number = 2; number <= 25; number++) cache.start(String(number), "2026-09", 0);
  assert.equal(cache.size, 24);
  assert.equal(cache.resolve("1", "2026-09", old, card("1"), 1), false);
  assert.equal(cache.read("1", "2026-09", 1), null);
});
