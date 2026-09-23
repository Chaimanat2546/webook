import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createHouseBookingsRepository, mapBooking } from "../server/repositories/house-bookings.ts";
import { createBookingCustomer, getBookingCustomer, updateBookingCustomer } from "../server/services/booking-customers.ts";

interface Row { id: string; dv_id: string | null; first_name: string; last_name: string | null; phone: string; updated_at: string; [key: string]: unknown }
function fixture() {
  const rows: Row[] = [
    { id: "11", dv_id: "1", first_name: "M", last_name: "Family", phone: "0812345678", updated_at: "2026-09-22T00:00:00Z" },
    { id: "12", dv_id: null, first_name: "Legacy", last_name: null, phone: "0812345678", updated_at: "2026-09-22T00:00:00Z" },
  ];
  const client = createClient("https://test.supabase.co", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    if (url.pathname.endsWith("/listings")) return Response.json([{ id: "listing-" + url.searchParams.get("property_id")?.slice(3), property_id: url.searchParams.get("property_id")?.slice(3), title: "test" }]);
    assert.ok(url.pathname.endsWith("/customers"));
    let found = rows.filter(row => ["dv_id", "id", "updated_at"].every(key => {
      const filter = url.searchParams.get(key);
      return !filter || (filter === "is.null" ? row[key] === null : String(row[key]) === filter.slice(3));
    }));
    if (init?.method === "POST") {
      const values = JSON.parse(String(init.body)) as Row;
      const row = { ...values, id: String(20 + rows.length), updated_at: "2026-09-22T01:00:00Z" };
      rows.push(row); found = [row];
    } else if (init?.method === "PATCH") {
      const values = JSON.parse(String(init.body)) as Record<string, unknown>;
      found.forEach(row => Object.assign(row, values));
    }
    return Response.json(headers.get("accept")?.includes("vnd.pgrst.object") ? found[0] ?? null : found);
  } } });
  return { rows, repository: createHouseBookingsRepository(client) };
}

test("house B cannot search, inspect, edit or select house A customer; same phone creates a separate B customer", async () => {
  const { rows, repository } = fixture();
  const a = { id: "listing-1", property_id: "1", title: "A" }, b = { id: "listing-2", property_id: "2", title: "B" };
  assert.deepEqual((await repository.customers(a, "M")).map(row => row.id), ["11"]);
  assert.deepEqual(await repository.customers(b, "M"), []);
  assert.deepEqual(await repository.customersByPhone(b, "0812345678"), []);
  assert.equal(await repository.customerDetail(b, "11"), null);
  assert.equal(await repository.ownsCustomer(b, "11"), false);
  await assert.rejects(getBookingCustomer(repository, "2", "11"), /ลูกค้า/);
  await assert.rejects(updateBookingCustomer(repository, "2", "11", rows[0].updated_at, { first_name: "hacked", phone: "0812345678" }), /ลูกค้า/);
  const result = await createBookingCustomer(repository, "2", { first_name: "M", phone: "0812345678", dv_id: "1" });
  assert.equal(result.kind, "created");
  assert.equal(rows.at(-1)?.dv_id, "2");
  assert.equal(rows[0].first_name, "M");
  assert.equal(rows[1].dv_id, null);
  assert.equal((await repository.customers(a, "M")).length, 1);
  assert.equal((await repository.customers(b, "M")).length, 1);
  assert.equal((await createBookingCustomer(repository, "2", { first_name: "M", phone: "0812345678" })).kind, "existing");
});

test("calendar mapping never exposes a legacy joined customer belonging to another house", () => {
  const row = { id: "1", houseid: "1", customer_id: "11", customer: { id: "11", first_name: "Private", phone: "0812345678", dv_id: "2" } };
  assert.equal(mapBooking(row).customer, null);
  assert.equal(mapBooking({ ...row, customer: { ...row.customer, dv_id: null } }).customer, null);
  assert.equal(mapBooking({ ...row, customer: { ...row.customer, dv_id: "1" } }).customer?.first_name, "Private");
});
