import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Explicitly Staging-only, insert-only and resumable; never alters existing rows.
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://sxvkhzhqtrpxgzumsswl.supabase.co", "Staging only");
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing Staging credential");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const month = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
const [year, number] = month.split("-").map(Number);
const months = [0, 1, 2].map(offset => new Date(Date.UTC(year, number - 1 - offset, 1)).toISOString().slice(0, 7));
const marker = `[DEMO LARGE ${month}]`;
const uuid = key => {
  const hex = createHash("sha256").update(`${marker}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
async function ensureRows(table, key, rows, label) {
  const result = [];
  for (let offset = 0; offset < rows.length; offset += 40) {
    const batch = rows.slice(offset, offset + 40);
    const { data, error } = await db.from(table).select(`id,${key},${label}`).in(key, batch.map(row => row[key]));
    if (error) throw new Error(`${table} read: ${error.code}`);
    const existing = new Map(data.map(row => [row[key], row]));
    for (const row of batch) {
      if (existing.has(row[key])) assert.equal(existing.get(row[key])[label], row[label], "Demo key collision");
    }
    const missing = batch.filter(row => !existing.has(row[key]));
    if (missing.length) {
      const { data: inserted, error: insertError } = await db.from(table).insert(missing).select(`id,${key},${label}`);
      if (insertError) throw new Error(`${table} insert: ${insertError.code} ${insertError.message}`);
      result.push(...inserted);
    }
    result.push(...data);
  }
  return result;
}

const agents = ["ทะเลสวย", "บ้านพักวันหยุด", "เที่ยวด้วยกัน", "พูลวิลล่าแฟมิลี่", "พักผ่อนพลัส", "แฮปปี้ทริป", "วิลล่าคอนเนกต์", "บ้านสวนทัวร์"]
  .map((name, i) => ({ id: uuid(`agent-${i}`), name: `${marker} ${name}`, video_url: "https://example.invalid/demo", is_active: true }));
const houses = Array.from({ length: 30 }, (_, i) => ({
  id: uuid(`house-${i}`), property_id: 880000000 + year * 10000 + number * 100 + i,
  title: `${marker} บ้านตัวอย่าง ${String(i + 1).padStart(2, "0")}`,
  max_guests: 8 + i % 5 * 2, bedrooms: 2 + i % 4, bathrooms: 2 + i % 3, is_active: true,
  created_at: `${months[i < 24 ? 0 : i < 28 ? 1 : 2]}-01T08:00:00+07:00`,
}));
// Preflight all reserved DV numbers before any insertion.
const { data: collisions, error: collisionError } = await db.from("listings").select("id,property_id").in("property_id", houses.map(row => row.property_id));
assert.ifError(collisionError);
for (const row of collisions) assert.equal(row.id, houses.find(house => house.property_id === row.property_id)?.id, "Demo DV already used");
await ensureRows("agents", "id", agents, "name");
await ensureRows("listings", "id", houses, "title");
const customers = await ensureRows("customers", "first_name", houses.map((house, i) => ({
  first_name: `${marker} ลูกค้าสมมติ ${i + 1}`, phone: "0000000000", dv_id: house.property_id,
})), "first_name");
const bookings = [];
for (const [houseIndex, house] of houses.entries()) {
  for (let offset = 0; offset < (houseIndex < 24 ? 1 : houseIndex < 28 ? 2 : 3); offset++) {
    for (let k = 0; k < 6; k++) {
      const status = k < 4 ? "confirmed" : k === 4 ? (offset === 0 ? "waiting" : "cancelled") : "repair";
      const price = status === "repair" ? 0 : 4500 + houseIndex * 350 + k * 1250 + offset * 200;
      const day = 3 + k * 4;
      const nights = 1 + k % 2;
      const date = d => `${months[offset]}-${String(d).padStart(2, "0")}`;
      bookings.push({ booking_code: `DEMO-L-${month}-${houseIndex + 1}-${offset}-${k}`,
        listing_id: house.id, houseid: house.property_id,
        customer_id: status === "repair" ? null : customers.find(row => row.first_name === `${marker} ลูกค้าสมมติ ${houseIndex + 1}`).id,
        status, check_in: date(day), check_out: date(day + nights), quantity: nights,
        price_max: price, price_sell: price / 2, deposit_amount: 0, extra_charge: 0,
        agent_id: (houseIndex + k) % 11 === 0 ? null : agents[(houseIndex + k * 3) % agents.length].id,
        note: `${marker} ข้อมูลสมมติสำหรับทดสอบ Dashboard ไม่ใช่การจองจริง`,
        created_at: `${date(1 + k * 3)}T10:00:00+07:00`,
        payment_expires_at: status === "waiting" ? new Date(Date.now() + 86400000).toISOString() : null,
      });
    }
  }
}
assert.equal(bookings.length, 228);
const ensured = await ensureRows("bookings", "booking_code", bookings, "note");
assert.equal(ensured.length, 228);
const summary = [];
for (const reportMonth of months) {
  const codes = bookings.filter(row => row.created_at.startsWith(reportMonth)).map(row => row.booking_code);
  const actual = [];
  for (let offset = 0; offset < codes.length; offset += 40) {
    const { data, error } = await db.from("bookings").select("booking_code,status,price_max").in("booking_code", codes.slice(offset, offset + 40));
    assert.ifError(error);
    actual.push(...data);
  }
  assert.equal(actual.length, codes.length);
  const confirmed = actual.filter(row => row.status === "confirmed");
  const expected = bookings.filter(row => row.created_at.startsWith(reportMonth) && row.status === "confirmed");
  assert.equal(confirmed.length, expected.length);
  const total = confirmed.reduce((sum, row) => sum + Number(row.price_max), 0);
  assert.equal(total, expected.reduce((sum, row) => sum + row.price_max, 0));
  summary.push({ month: reportMonth, bookings: actual.length, confirmed: confirmed.length, salesTHB: total });
}
console.log(JSON.stringify({ houses: 30, agencies: 8, bookings: 228, summary }, null, 2));
