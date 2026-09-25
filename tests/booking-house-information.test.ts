import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createHouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { getBookingHouseInformation } from "../server/services/house-bookings.ts";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("house information reads only four latest listing fields scoped to validated property ID", async () => {
  const requests: URL[] = [];
  let row: unknown = { extra_beds: 0, insurance_fee: "3000", checkin_time: "14:00:00", checkout_time: "11:30:00" };
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async input => {
    requests.push(new URL(String(input)));
    return new Response(JSON.stringify(row), { headers: { "Content-Type": "application/json" } });
  } } });
  const repository = createHouseBookingsRepository(client);
  assert.deepEqual(await getBookingHouseInformation(repository, "12"), { extra_beds: 0, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "11:30:00" });
  assert.equal(requests[0].pathname, "/rest/v1/listings");
  assert.equal(requests[0].searchParams.get("select"), "extra_beds,insurance_fee,checkin_time,checkout_time");
  assert.equal(requests[0].searchParams.get("property_id"), "eq.12");
  await assert.rejects(() => getBookingHouseInformation(repository, "12)"));
  assert.equal(requests.length, 1);
  row = { extra_beds: null, insurance_fee: null, checkin_time: null, checkout_time: null };
  assert.deepEqual(await getBookingHouseInformation(repository, "12"), row);
  row = null;
  await assert.rejects(() => getBookingHouseInformation(repository, "12"), /booking_house_not_found/);
});

test("house information renders read-only amounts and local times without confusing zero with missing", async () => {
  const output = await build({ entryPoints: [fileURLToPath(new URL("../components/admin/houses/bookings/booking-house-information-details.tsx", import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Details = loaded.exports.BookingHouseInformationDetails as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Details, { data: { extra_beds: 0, insurance_fee: 3000, checkin_time: "14:00:00", checkout_time: "00:00:00" } }));
  for (const text of ["ราคาคนเสริม", "ประกันที่พัก", "เวลาเช็คอิน", "เวลาเช็คเอาท์", "0 บาท", "3,000 บาท", "14:00", "00:00"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<(input|select|textarea)\b/);
  const missing = renderToStaticMarkup(createElement(Details, { data: { extra_beds: null, insurance_fee: null, checkin_time: null, checkout_time: null } }));
  assert.equal((missing.match(/ไม่ระบุ/g) ?? []).length, 4);
});
