import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { parseGalleryPageInput } from "../lib/booking-gallery.ts";
import { createHouseBookingsRepository } from "../server/repositories/house-bookings.ts";

test("gallery search mode defaults to DV and rejects unsupported modes", () => {
  assert.equal(parseGalleryPageInput({}).searchMode, "dv");
  assert.equal(parseGalleryPageInput({ searchMode: "title" }).searchMode, "title");
  for (const searchMode of ["all", "", null, 1]) assert.throws(() => parseGalleryPageInput({ searchMode }));
});

test("search modes emit mutually exclusive filters and invalid DV never searches titles", async () => {
  const urls: URL[] = [];
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async input => {
    urls.push(new URL(String(input)));
    return new Response("[]", { headers: { "Content-Type": "application/json", "Content-Range": "*/0" } });
  } } });
  const repository = createHouseBookingsRepository(client);
  for (const search of ["12", "DV 12"]) await repository.galleryHousePage(parseGalleryPageInput({ search, searchMode: "dv" }));
  await repository.galleryHousePage(parseGalleryPageInput({ search: "12", searchMode: "title", page: 2 }));
  for (const url of urls.slice(0, 2)) {
    assert.equal(url.searchParams.get("property_id"), "eq.12");
    assert.equal(url.searchParams.has("title"), false);
    assert.equal(url.searchParams.has("or"), false);
  }
  assert.equal(urls[2].searchParams.get("title"), "imatch.12");
  assert.equal(urls[2].searchParams.has("property_id"), false);
  assert.equal(urls[2].searchParams.get("order"), "is_active.desc.nullslast,property_id.asc");
  assert.equal(urls[2].searchParams.get("offset"), "6");
  for (const search of ["บ้าน", "0", "12)", "9223372036854775808"]) {
    assert.deepEqual(await repository.galleryHousePage(parseGalleryPageInput({ search, searchMode: "dv" })), { houses: [], total: 0 });
  }
  assert.equal(urls.length, 3);
  await repository.galleryHousePage(parseGalleryPageInput({ search: "", searchMode: "dv" }));
  assert.equal(urls[3].searchParams.has("property_id"), false);
});
