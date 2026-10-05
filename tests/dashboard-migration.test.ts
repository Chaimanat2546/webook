import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createDashboardRepository } from "../server/repositories/dashboard.ts";
import { loadDashboardAgency } from "../server/services/dashboard.ts";
import { parseDashboardAgencyDetailQuery } from "../lib/dashboard-routes.ts";

const migration = new URL("../supabase/migrations/20261002110000_scalable_dashboard_reporting.sql", import.meta.url);
it("dashboard reporting migration is available for deployment", () => assert.ok(existsSync(migration)));

describe("dashboard reporting PostgreSQL contract", { skip: process.env.RUN_DASHBOARD_DB_TESTS !== "1" }, () => {
  const container = `webook-dashboard-test-${process.pid}`;
  const admin = "00000000-0000-4000-8000-000000000001";
  const owner = "00000000-0000-4000-8000-000000000002";
  const agency = "00000000-0000-4000-8000-000000000010";
  function sql(source: string, success = true) {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: source, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (success) assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0);
    return result.stdout + result.stderr;
  }
  function report(options: Record<string, unknown> = {}, actor = admin) {
    return JSON.parse(sql(`select public.dashboard_report('${actor}', '${JSON.stringify({ month: "2026-09", ...options }).replaceAll("'", "''")}'::jsonb);`));
  }
  before(async () => {
    const run = spawnSync("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    for (let i = 0; i < 60; i++) {
      if (spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"]).status === 0) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    sql(`create role anon; create role authenticated; create role service_role;
      create table public.users(uid uuid primary key, role_id smallint, dv_id bigint);
      insert into users values ('${admin}',1,null),('${owner}',3,101);
      create table public.listings(id uuid primary key,property_id bigint,title text);
      insert into listings values ('00000000-0000-4000-8000-000000000101',101,'House A'),('00000000-0000-4000-8000-000000000202',202,'House B');
      create table public.agents(id uuid primary key,name text);
      insert into agents values ('${agency}','Agency A');
      create table public.customers(id bigint primary key,dv_id bigint,first_name text,last_name text);
      insert into customers values(1,202,'Private','Other House');
      create table public.bookings(id bigint primary key, booking_code text,listing_id uuid,houseid bigint,customer_id bigint,agent_id uuid,
        check_in date,check_out date,status text,price_max numeric,price_sell numeric,extra_charge numeric,insurance numeric,
        payment_expires_at timestamptz,created_at timestamptz,updated_at timestamptz,created_by uuid,note text,checkin_time time,checkout_time time);
      insert into bookings(id,booking_code,listing_id,houseid,customer_id,agent_id,check_in,check_out,status,price_max,created_at,updated_at,note)
      select n,'BK'||n,'00000000-0000-4000-8000-000000000101',101,1,'${agency}','2026-11-01','2026-11-03',
        case n when 2 then 'waiting' when 3 then 'cancelled' when 4 then 'mystery' else 'confirmed' end,
        case when n=5 then null else 100 end,'2026-08-10','2026-09-10','secret' from generate_series(1,5) n;
      insert into bookings(id,booking_code,listing_id,houseid,check_in,check_out,status,price_max,created_at,updated_at)
      values (6,'BK6','00000000-0000-4000-8000-000000000202',202,'2026-11-01','2026-11-03','confirmed',300,'2026-09-10','2026-08-31T17:00:00Z'),
             (7,'BK7','00000000-0000-4000-8000-000000000101',101,'2026-11-01','2026-11-03','confirmed',999,'2026-09-10','2026-09-30T17:00:00Z');`);
    sql(readFileSync(migration, "utf8"));
  });
  after(() => { spawnSync("docker", ["rm", "-f", container]); });
  it("uses Bangkok updated-month boundaries, all-status counts and confirmed sales", () => {
    const r = report();
    assert.equal(r.bookingCount, 6);
    assert.deepEqual(r.sales, { count: 3, amountCents: 40000, missingPrices: 1 });
    assert.deepEqual(r.statusCounts, { confirmed: 3, waiting: 1, cancelled: 1, repair: 0, unknown: 1 });
    assert.equal(r.daily.length, 30);
    assert.deepEqual(r.daily[0], { date: "2026-09-01", count: 1 });
    assert.deepEqual(r.daily[9], { date: "2026-09-10", count: 2 });
  });
  it("agency metrics precede status/search/amount filters and use global confirmed denominator", () => {
    const r = report({ agency, status: "waiting", search: "House A", amountFromCents: 10000, amountToCents: 10000 });
    assert.equal(r.bookingCount, 5);
    assert.deepEqual(r.selectedAgency, { id: agency, name: "Agency A", count: 5, amountCents: 10000, missingPrices: 1 });
    assert.equal(r.totalSalesCents, 40000);
    assert.equal(r.bookings.total, 1);
    assert.equal(r.bookings.rows[0].id, "2");
    assert.equal(r.bookings.rows[0].note, undefined);
    assert.equal(report({ search: "Private" }).bookings.total, 0);
  });
  it("maps actual PostgreSQL results through the repository and agency service", async () => {
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      if (path === "/rest/v1/users") return Response.json({ role_id: 1, dv_id: null });
      if (path === "/rest/v1/listings") return new Response("[]", { headers: { "Content-Type": "application/json", "Content-Range": "*/0" } });
      assert.equal(path, "/rest/v1/rpc/dashboard_report");
      const body = await request.json();
      assert.equal(body.p_actor, admin);
      return Response.json(report(body.p_query, body.p_actor));
    } } });
    const result = await loadDashboardAgency(createDashboardRepository(client), admin, parseDashboardAgencyDetailQuery({ month: "2026-09", status: "waiting", amountFrom: "100", amountTo: "100" }), agency);
    assert.equal(result.bookingCount, 5);
    assert.equal(result.bookings.total, 1);
    assert.equal(result.bookings.rows[0].id, "2");
    assert.equal(result.detail?.kind, "agency");
    if (result.detail?.kind !== "agency") assert.fail();
    assert.equal(result.detail.agency.count, 5);
    assert.equal(result.detail.sharePercent, 25);
    assert.equal(result.detail.agency.amountCents, 10000);
  });
  it("owner reports cannot leak another property, agency or detail", () => {
    const r = report({}, owner);
    assert.equal(r.bookingCount, 5);
    assert.deepEqual(r.agencies.rows, []);
    assert.deepEqual(r.topAgencies, []);
    assert.equal(r.bookings.rows[0].agentId, null);
    assert.equal(report({ bookingId: "6" }, owner).bookingDetail, null);
    assert.match(sql(`select dashboard_report('${owner}','{"agency":"${agency}"}');`, false), /dashboard_forbidden/);
  });
  it("stay ranges and details use the selected date scope but ignore list presentation filters", () => {
    const r = report({ checkInFrom: "2026-11-01", checkInTo: "2026-11-01", bookingId: "7", search: "no match" });
    assert.equal(r.bookingCount, 7);
    assert.equal(r.bookings.total, 0);
    assert.equal(r.bookingDetail.id, "7");
    assert.equal(report({ bookingId: "1", status: "waiting" }).bookingDetail.note, "secret");
  });
  it("supports existing multi-year stay filters without an unbounded chart response", () => {
    const r = report({ checkInFrom: "2025-01-01", checkInTo: "2027-12-31" });
    assert.equal(r.bookingCount, 7);
    assert.ok(r.daily.length <= 31);
  });
  it("sorts deterministically across pages with null prices last", () => {
    const first = report({ sort: "price-asc", pageSize: 2 });
    const second = report({ sort: "price-asc", pageSize: 2, page: 2 });
    const last = report({ sort: "price-asc", pageSize: 2, page: 3 });
    assert.deepEqual(first.bookings.rows.map((row: { id: string }) => row.id), ["4", "3"]);
    assert.deepEqual(second.bookings.rows.map((row: { id: string }) => row.id), ["2", "1"]);
    assert.deepEqual(last.bookings.rows.map((row: { id: string }) => row.id), ["6", "5"]);
  });
  it("validates inputs and grants only the server role with a fixed search path", () => {
    for (const input of [{ month: "2026-99" }, { sort: "sql" }, { status: "sql" }, { page: 0 }, { pageSize: 10000 }, { amountFromCents: 2, amountToCents: 1 }, { checkInFrom: "2026-11-02", checkInTo: "2026-11-01" }]) {
      assert.match(sql(`select dashboard_report('${admin}','${JSON.stringify({ month: "2026-09", ...input })}');`, false), /dashboard_invalid_query/);
    }
    assert.equal(sql(`select has_function_privilege('anon','dashboard_report(uuid,jsonb)','execute'),has_function_privilege('authenticated','dashboard_report(uuid,jsonb)','execute'),has_function_privilege('service_role','dashboard_report(uuid,jsonb)','execute');`).trim(), "f|f|t");
    assert.match(sql(`select proconfig from pg_proc where oid='dashboard_report(uuid,jsonb)'::regprocedure;`), /search_path=public, pg_temp/);
  });
  it("returns bounded pages for 30000 rows and indexes selective date and agency scopes", () => {
    sql(`insert into bookings(id,booking_code,listing_id,houseid,agent_id,check_in,check_out,status,price_max,created_at,updated_at)
      select 100+n,'LARGE'||n,'00000000-0000-4000-8000-000000000101',101,'${agency}','2025-01-01','2025-01-02','confirmed',100,'2025-01-01','2025-01-01'::timestamptz + (n % 365)*interval '1 day' from generate_series(1,30000) n; analyze bookings;`);
    const r = report({ month: "2025-01", page: 999999, pageSize: 9 });
    assert.ok(r.bookings.total > 2000);
    assert.ok(r.bookings.rows.length <= 9);
    assert.equal(r.bookings.page, r.bookings.pages);
    const plan = sql(`explain (analyze,buffers) select id from bookings where agent_id='${agency}' and updated_at >= '2026-08-31T17:00:00Z' and updated_at < '2026-09-30T17:00:00Z';`);
    assert.match(plan, /Index|Bitmap/);
    assert.match(plan, /Buffers:/);
    console.log(plan);
    console.log(sql(`explain (analyze,buffers) select dashboard_report('${admin}','{"month":"2025-01","pageSize":9}');`));
    sql(`update bookings set updated_at='2025-01-10' where id>100; analyze bookings;`);
    assert.equal(report({ month: "2025-01" }).bookingCount, 30000);
    assert.equal(report({ month: "2025-01" }).bookings.rows.length, 9);
    console.log(sql(`explain (analyze,buffers) select dashboard_report('${admin}','{"month":"2025-01","pageSize":9}');`));
  });
});
