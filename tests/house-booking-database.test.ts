import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Uses an isolated PostgreSQL container, never a configured Supabase environment.
describe("house booking RPC integration", { skip: process.env.RUN_BOOKING_DB_TESTS !== "1" }, () => {
  const container = `webook-booking-test-${process.pid}`;
  function sql(source: string, success = true) {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: source, encoding: "utf8" });
    if (success) assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0, "query should fail");
    return `${result.stdout}${result.stderr}`;
  }
  const actor = "00000000-0000-4000-8000-000000000001";
  const values = { check_in: "2026-09-28", check_out: "2026-10-04", status: "confirmed", customer_id: 1, quantity: 1, price_sell: 3900, price_max: 6900, extra_charge: 0, note: "test" };
  const call = (house = 1024, revision = "2026-09-18T00:00:00Z", v = values) => `select public.admin_update_house_booking(${house},1,'${revision}','${actor}','${JSON.stringify(v)}'::jsonb);`;
  before(async () => {
    const run = spawnSync("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"]).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready);
    sql(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table auth.users(id uuid primary key); insert into auth.users values ('${actor}');
      create extension btree_gist;
      create table public.listings(id uuid primary key,property_id bigint unique);
      insert into public.listings values ('00000000-0000-4000-8000-000000000010',1024);
      create table public.customers(id bigint primary key); insert into public.customers values(1);
      create table public.bookings(id bigint primary key,listing_id uuid references public.listings,houseid bigint,customer_id bigint references public.customers,check_in date,check_out date,status text,quantity integer,price_sell numeric,deposit_amount numeric,extra_charge numeric,note text,updated_at timestamptz);
      alter table public.bookings add exclude using gist(listing_id with =,daterange(check_in,check_out,'[)') with &&) where (status not in ('cancelled','rejected'));
      create table public.booking_logs(booking_id bigint,performed_by uuid references auth.users(id));
      create function public.test_audit() returns trigger language plpgsql as 'begin insert into public.booking_logs values(new.id,auth.uid());return new;end';
      create trigger audit after update on public.bookings for each row execute function public.test_audit();
      insert into public.bookings values(1,'00000000-0000-4000-8000-000000000010',1024,null,'2026-09-28','2026-10-03','confirmed',1,15000,5000,0,null,'2026-09-18T00:00:00Z');
      grant usage on schema public,auth to service_role; grant all on all tables in schema public to service_role;`);
    sql(readFileSync(new URL("../supabase/migrations/20260918100000_admin_update_house_booking.sql", import.meta.url), "utf8"));
    assert.match(sql(`set role service_role; ${call()}`, false), /permission denied for table users/);
    sql(readFileSync(new URL("../supabase/migrations/20260918110000_booking_actor_integrity.sql", import.meta.url), "utf8"));
    sql("alter table public.bookings add column price_max numeric");
    sql(readFileSync(new URL("../supabase/migrations/20260918120000_booking_money_fields.sql", import.meta.url), "utf8"));
  });
  after(() => { spawnSync("docker", ["rm", "-f", container], { encoding: "utf8" }); });
  it("only the service role can invoke the mutation", () => {
    assert.match(sql(`set role authenticated; ${call()}`, false), /permission denied/);
  });
  it("rejects a booking substituted from another house", () => {
    assert.match(sql(call(999), false), /booking_not_found/);
  });
  it("rejects attempts to edit the unused deposit_amount", () => {
    assert.match(sql(call(1024, "2026-09-18T00:00:00Z", { ...values, deposit_amount: 99999 } as typeof values), false), /booking_invalid_input/);
    assert.match(sql("select deposit_amount from public.bookings where id=1"), /^5000\s/);
  });
  it("updates one stay, preserves its total and writes one correctly attributed audit record", () => {
    sql(`set role service_role; ${call()}`);
    assert.match(sql("select check_out,price_sell,customer_id,price_max,deposit_amount from public.bookings where id=1"), /2026-10-04\|3900\|1\|6900\|5000/);
    assert.match(sql("select count(*),min(performed_by::text) from public.booking_logs"), new RegExp(`1\\|${actor}`));
  });
  it("rejects a stale revision without logging a second update", () => {
    assert.match(sql(call(), false), /booking_stale/);
    assert.match(sql("select count(*) from public.booking_logs"), /^1\s/);
  });
  it("retains database overlap protection and rolls back log/write together", () => {
    sql("insert into public.bookings values(2,'00000000-0000-4000-8000-000000000010',1024,null,'2026-10-04','2026-10-06','confirmed',1,10000,0,0,null,now(),null)");
    const revision = sql("select updated_at from public.bookings where id=1").trim();
    assert.match(sql(call(1024, revision, { ...values, check_out: "2026-10-05" }), false), /exclusion constraint/);
    assert.match(sql("select check_out from public.bookings where id=1"), /2026-10-04/);
    assert.match(sql("select count(*) from public.booking_logs"), /^1\s/);
  });
});
