import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("empty legacy schema upgrades without changing RLS and populated schema is refused", { skip: process.env.RUN_BOOKING_DB_TESTS !== "1" }, async () => {
  const container = `webook-legacy-booking-test-${process.pid}`;
  const run = (args: string[], input?: string) => spawnSync("docker", args, { input, encoding: "utf8" });
  function sql(input: string, ok = true) {
    const result = run(["exec", "-i", container, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], input);
    if (ok) assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0);
    return result.stdout + result.stderr;
  }
  const migration = readFileSync(new URL("../supabase/migrations/20260918090000_reconcile_empty_legacy_bookings.sql", import.meta.url), "utf8");
  assert.equal(run(["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"]).status, 0);
  try {
    for (let i = 0; i < 40; i++) {
      if (run(["exec", container, "pg_isready", "-U", "postgres"]).status === 0) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    sql(`create extension btree_gist;create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table public.listings(id uuid primary key,property_id bigint unique);
      create table public.bookings(id uuid default gen_random_uuid() primary key,listings_id uuid,guest_id uuid,check_in date not null,check_out date not null,during daterange generated always as(daterange(check_in,check_out,'[)')) stored,agent_id bigint,house_id bigint,details text,codebooking varchar);
      alter table public.bookings add constraint no_overlapping_bookings exclude using gist(listings_id with =,during with &&);
      create table public.booking_logs(id bigserial primary key,booking_id uuid not null,action text not null,old_status text,new_status text,changed_by uuid not null,notes text,created_at timestamptz default now(),deville_id bigint);
      alter table public.bookings enable row level security;alter table public.booking_logs enable row level security;
      alter default privileges in schema public grant all on tables to anon,authenticated;
      insert into public.bookings(check_in,check_out) values('2026-09-01','2026-09-02');`);
    assert.match(sql(`begin;${migration}commit;`, false), /Legacy bookings must be empty/);
    assert.match(sql("select count(*) from public.bookings"), /^1\s/);
    sql("delete from public.bookings;");
    sql(`begin;${migration}commit;`);
    assert.match(sql("select bool_and(relrowsecurity) from pg_class where oid in ('public.bookings'::regclass,'public.booking_logs'::regclass)"), /^t\s/);
    assert.match(sql("select has_table_privilege('anon','public.customers','select'),has_table_privilege('authenticated','public.customers','select')"), /^f\|f\s/);
    sql(readFileSync(new URL("../supabase/migrations/20260918100000_admin_update_house_booking.sql", import.meta.url), "utf8"));
    sql("insert into auth.users values('00000000-0000-4000-8000-000000000001');insert into public.listings values('00000000-0000-4000-8000-000000000010',1024);insert into public.customers(first_name,phone) values('Fixture','0000000000');insert into public.bookings(booking_code,listing_id,houseid,check_in,check_out,price_sell) values('TEST','00000000-0000-4000-8000-000000000010',1024,'2026-09-28','2026-10-03',15000);");
    sql(`select public.admin_update_house_booking(1024,1,(select updated_at from public.bookings where id=1),'00000000-0000-4000-8000-000000000001','{"check_in":"2026-09-28","check_out":"2026-10-04","customer_id":1,"status":"confirmed","quantity":1,"price_sell":15000,"deposit_amount":5000,"extra_charge":0,"note":null}'::jsonb);`);
    assert.match(sql("select check_out,price_sell from public.bookings"), /2026-10-04\|15000/);
    assert.match(sql("select action,performed_by from public.booking_logs where action='UPDATE'"), /UPDATE\|00000000-0000-4000-8000-000000000001/);
    sql(`begin;${migration}commit;`); // idempotent on modern schema
  } finally { run(["rm", "-f", container]); }
});
