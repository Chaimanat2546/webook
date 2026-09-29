import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createHouseBookingsRepository } from "../server/repositories/house-bookings.ts";
import { getBookingCreationDefaults } from "../server/services/house-bookings.ts";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("booking creation defaults map only four listing fields scoped to validated property ID", async () => {
  const requests: URL[] = [];
  let row: unknown = { extra_beds: 0, insurance_fee: "3000", checkin_time: "14:00:00", checkout_time: "11:30:00" };
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async input => {
    requests.push(new URL(String(input)));
    return new Response(JSON.stringify(row), { headers: { "Content-Type": "application/json" } });
  } } });
  const repository = createHouseBookingsRepository(client);
  assert.deepEqual(await getBookingCreationDefaults(repository, "12"), { extra_person: 0, insurance: 3000, checkin_time: "14:00:00", checkout_time: "11:30:00" });
  assert.equal(requests[0].pathname, "/rest/v1/listings");
  assert.equal(requests[0].searchParams.get("select"), "extra_beds,insurance_fee,checkin_time,checkout_time");
  assert.equal(requests[0].searchParams.get("property_id"), "eq.12");
  await assert.rejects(() => getBookingCreationDefaults(repository, "12)"));
  assert.equal(requests.length, 1);
  row = { extra_beds: null, insurance_fee: null, checkin_time: null, checkout_time: null };
  assert.deepEqual(await getBookingCreationDefaults(repository, "12"), { extra_person: null, insurance: null, checkin_time: null, checkout_time: null });
  row = null;
  await assert.rejects(() => getBookingCreationDefaults(repository, "12"), /booking_house_not_found/);
});

test("house information renders editable booking-specific amounts and local times", async () => {
  const output = await build({ entryPoints: [fileURLToPath(new URL("../components/admin/houses/bookings/booking-house-information-details.tsx", import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Details = loaded.exports.BookingHouseInformationDetails as ComponentType<Record<string, unknown>>;
  const html = renderToStaticMarkup(createElement(Details, { data: { extra_person: 0, insurance: 3000, checkin_time: "14:00:00", checkout_time: "00:00:00" }, values: { extra_person: null, insurance: null, checkin_time: null, checkout_time: null }, onChange: () => {} }));
  for (const text of ["ราคาคนเสริม", "ประกันที่พัก", "เวลาเช็คอิน", "เวลาเช็คเอาท์", "14:00", "00:00", "ไม่กระทบข้อมูลบ้านหลัก"]) assert.ok(html.includes(text), text);
  assert.match(html, /<input[^>]+type="number"/);
  assert.match(html, /<input[^>]+type="time"/);
  assert.doesNotMatch(html, /ข้อมูลบ้าน:/);
});

test("an existing booking renders saved house information without loading listing defaults", async () => {
  const modulePath = fileURLToPath(new URL("../components/admin/houses/bookings/booking-house-information.tsx", import.meta.url));
  const component = await readFile(modulePath, "utf8");
  assert.match(component, /loadDefaults: boolean/);
  assert.match(component, /if \(!loadDefaults\)/);
  assert.match(component, /data: values/);
  assert.match(component, /getBookingCreationDefaultsAction/);

  const action = await readFile(fileURLToPath(new URL("../app/admin/houses/[propertyId]/bookings/actions.ts", import.meta.url)), "utf8");
  assert.match(action, /getBookingCreationDefaultsAction/);
  assert.doesNotMatch(action, /getBookingHouseInformationAction/);
});

test("booking editor loads an administrator-only Agent selector above the customer picker", async () => {
  const editor = await readFile(fileURLToPath(new URL("../components/admin/houses/bookings/booking-editor.tsx", import.meta.url)), "utf8");
  const action = await readFile(fileURLToPath(new URL("../app/admin/houses/[propertyId]/bookings/actions.ts", import.meta.url)), "utf8");
  const agencyChoices = await readFile(fileURLToPath(new URL("../lib/booking-agency.ts", import.meta.url)), "utf8");
  assert.match(action, /listBookingAgenciesAction/);
  assert.match(editor, /listBookingAgenciesAction/);
  assert.match(editor, /bookingAgencyChoices/);
  assert.match(agencyChoices, /ไม่ระบุเอเจนซี่/);
  assert.ok(editor.indexOf("เอเจนซี่") < editor.lastIndexOf("BookingCustomerPicker"));
});

test("repair bookings hide house information and Agent inputs without submitting a new Agent", async () => {
  const editor = await readFile(fileURLToPath(new URL("../components/admin/houses/bookings/booking-editor.tsx", import.meta.url)), "utf8");
  assert.match(editor, /form\.status !== "repair" && agencyAccess\.canManageBookingAgency/);
  assert.match(editor, /\{form\.status !== "repair" && <BookingHouseInformation/);
  assert.match(editor, /agencyAccess\.canManageBookingAgency && form\.status !== "repair"/);
});
