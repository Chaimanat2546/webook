import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Run: node --use-system-ca --env-file=.env.staging scripts/seed-staging-dashboard.mjs
// Inserts only clearly marked demo records; existing records are never updated.
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://sxvkhzhqtrpxgzumsswl.supabase.co", "Staging only");
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing Staging service credential");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const month = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
const [year, number] = month.split("-").map(Number);
const previous = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
const marker = `[DEMO Dashboard ${month}]`;
function uuid(key) {
  const hex = createHash("sha256").update(`${marker}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
async function ensure(table, key, row, label) {
  const { data: existing, error } = await db.from(table).select("*").eq(key, row[key]).maybeSingle();
  if (error) throw new Error(`${table} read: ${error.code}`);
  if (existing) {
    assert.equal(existing[label], row[label], `${table}: demo key collision`);
    return existing;
  }
  const { data, error: insertError } = await db.from(table).insert(row).select().single();
  if (insertError) throw new Error(`${table} insert: ${insertError.code} ${insertError.message}`);
  return data;
}
const agents = [];
for (const name of ["Agency A", "Agency B"]) {
  agents.push(await ensure("agents", "id", { id: uuid(name), name: `${marker} ${name}`,
    video_url: "https://example.invalid/dashboard-demo", is_active: true }, "name"));
}
const houses = [];
for (let i = 0; i < 3; i++) {
  const propertyId = 99000000 + year * 100 + number * 3 + i;
  const id = uuid(`house-${i}`);
  const { data: collisions, error } = await db.from("listings").select("id").eq("property_id", propertyId);
  if (error) throw new Error(`House collision check: ${error.code}`);
  assert.ok(collisions.every(row => row.id === id), "Demo DV is already in use");
  const house = await ensure("listings", "id", { id, property_id: propertyId,
    title: `${marker} Villa ${String.fromCharCode(65 + i)}`, max_guests: 12,
    bedrooms: 3, bathrooms: 3, is_active: true,
    created_at: `${i === 2 ? previous : month}-05T10:00:00+07:00` }, "title");
  const customer = await ensure("customers", "first_name", { first_name: `${marker} Guest ${i + 1}`,
    phone: "0000000000", dv_id: propertyId }, "first_name");
  houses.push({ house, customer });
}
// Current month: 4 confirmed = 38,000 THB; waiting/cancelled/repair excluded from sales.
// Previous month: 1 confirmed = 9,000 THB. Date filters use created_at.
const fixtures = [
  [0, "confirmed", 12000, 0, month], [0, "confirmed", 8000, 0, month],
  [1, "confirmed", 15000, 1, month], [1, "confirmed", 3000, null, month],
  [0, "waiting", 7000, 0, month], [1, "cancelled", 6000, 1, month],
  [1, "repair", 0, null, month], [2, "confirmed", 9000, 1, previous],
];
for (let i = 0; i < fixtures.length; i++) {
  const [houseIndex, status, price, agentIndex, createdMonth] = fixtures[i];
  const { house, customer } = houses[houseIndex];
  const day = String(10 + i * 2).padStart(2, "0");
  const endDay = String(11 + i * 2).padStart(2, "0");
  await ensure("bookings", "booking_code", {
    booking_code: `DEMO-DASH-${month}-${i + 1}`, listing_id: house.id, houseid: house.property_id,
    customer_id: status === "repair" ? null : customer.id, status,
    check_in: `${month}-${day}`, check_out: `${month}-${endDay}`, quantity: 1,
    price_max: price, price_sell: price / 2, deposit_amount: 0, extra_charge: 0,
    agent_id: agentIndex === null ? null : agents[agentIndex].id,
    note: `${marker} Sample only; not a real reservation`,
    created_at: `${createdMonth}-08T10:00:00+07:00`,
    payment_expires_at: status === "waiting" ? new Date(Date.now() + 86400000).toISOString() : null,
  }, "note");
}
const { data: bookings, error } = await db.from("bookings").select("booking_code,status,price_max,created_at")
  .like("booking_code", `DEMO-DASH-${month}-%`);
if (error) throw new Error(`Verification: ${error.code}`);
assert.equal(bookings.length, 8);
const currentSales = bookings.filter(row => row.status === "confirmed" && row.created_at.startsWith(month));
assert.equal(currentSales.length, 4);
assert.equal(currentSales.reduce((total, row) => total + Number(row.price_max), 0), 38000);
console.log(JSON.stringify({ month, previous, houses: houses.map(({ house }) => ({ dv: house.property_id, title: house.title })),
  demoBookings: bookings.length, currentConfirmed: 4, currentSalesTHB: 38000, previousSalesTHB: 9000 }, null, 2));
