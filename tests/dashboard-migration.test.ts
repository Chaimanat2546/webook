import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createDashboardRepository } from "../server/repositories/dashboard.ts";
import { loadDashboardAgency } from "../server/services/dashboard.ts";
import { parseDashboardAgencyDetailQuery } from "../lib/dashboard-routes.ts";

const migration = new URL("../supabase/migrations/20261002110000_scalable_dashboard_reporting.sql", import.meta.url);
const orderingMigration = new URL("../supabase/migrations/20261005120000_dashboard_json_ordering.sql", import.meta.url);
const confirmedAgencyCountsMigration = new URL("../supabase/migrations/20261005130000_dashboard_confirmed_agency_counts.sql", import.meta.url);
it("dashboard reporting migration is available for deployment", () => assert.ok(existsSync(migration)));
it("dashboard confirmed agency counts migration is available for deployment", () => assert.ok(existsSync(confirmedAgencyCountsMigration)));

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
  function inspectPlans(label: string, actor: string, query: Record<string, unknown>) {
    for (const mode of ["force_custom_plan", "force_generic_plan"]) {
      const output = sql(`load 'auto_explain'; set client_min_messages=log;
        set auto_explain.log_min_duration=0; set auto_explain.log_analyze=on;
        set auto_explain.log_buffers=on; set auto_explain.log_nested_statements=on;
        set auto_explain.log_timing=off; set auto_explain.log_format='json';
        set auto_explain.log_parameter_max_length=0; set plan_cache_mode='${mode}';
        select dashboard_report('${actor}','${JSON.stringify(query)}');`);
      const plans = [...output.matchAll(/LOG:  duration: ([\d.]+) ms  plan:\r?\n(\{[\s\S]*?\r?\n\})/g)]
        .map(match => ({ ms: Number(match[1]), document: JSON.parse(match[2]) as Record<string, unknown> }));
      const nested = plans.find(plan => String(plan.document["Query Text"]).trimStart().startsWith("with base"));
      assert.ok(nested, "auto_explain must expose the internal reporting query, not only the outer Result");
      const root = nested.document.Plan as Record<string, unknown>;
      const scans: Record<string, unknown>[] = [];
      const indexes: string[] = [];
      function visit(node: Record<string, unknown>) {
        if (typeof node["Index Name"] === "string" && node["Index Name"].startsWith("bookings_")) indexes.push(node["Index Name"]);
        if (node["Relation Name"] === "bookings" || ["CTE base", "CTE scoped"].includes(String(node["Subplan Name"]))) {
          scans.push({ type: node["Node Type"], relation: node["Relation Name"], cte: node["Subplan Name"], rows: node["Actual Rows"], removed: node["Rows Removed by Filter"], loops: node["Actual Loops"] });
        }
        if (Array.isArray(node.Plans)) for (const child of node.Plans) visit(child);
      }
      visit(root);
      assert.ok(scans.some(node => node.relation === "bookings"), "internal plan must include the real booking scan");
      console.log("RPC INTERNAL PLAN", JSON.stringify({ label, mode, internalMs: nested.ms, outerMs: plans.at(-1)?.ms, sharedHitBlocks: root["Shared Hit Blocks"], tempReadBlocks: root["Temp Read Blocks"], tempWrittenBlocks: root["Temp Written Blocks"], indexes, scans }));
    }
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
    sql(readFileSync(orderingMigration, "utf8"));
    sql(readFileSync(confirmedAgencyCountsMigration, "utf8"));
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
    assert.deepEqual(r.selectedAgency, { id: agency, name: "Agency A", count: 2, amountCents: 10000, missingPrices: 1 });
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
    assert.equal(result.detail.agency.count, 2);
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
  it("booking JSON ordering survives reordered aggregate input without changing page membership", () => {
    // Fault injection: preserve the chosen page, but change its delivery order
    // before aggregation. No SQL relation promises scan order to its consumer.
    const original = sql("select pg_get_functiondef('public.dashboard_report(uuid,jsonb)'::regprocedure);");
    const perturbed = original.replace("from payloads where not is_detail", "from (select * from payloads order by data->>'id' asc) payloads where not is_detail");
    assert.notEqual(perturbed, original, "aggregate input seam must exist");
    try {
      sql(perturbed);
      for (const [sort, expected] of [
        ["updated-desc", ["5", "4", "3", "2", "1", "6"]],
        ["price-asc", ["4", "3", "2", "1", "6", "5"]],
        ["price-desc", ["6", "4", "3", "2", "1", "5"]],
      ] as const) {
        const ids = [1, 2, 3].flatMap(page => report({ sort, page, pageSize: 2, bookingId: "1" }).bookings.rows.map((row: { id: string }) => row.id));
        assert.deepEqual(ids, expected, sort);
      }
    } finally { sql(original); }
  });
  it("agency JSON ordering survives reordered aggregate input", () => {
    const original = sql("select pg_get_functiondef('public.dashboard_report(uuid,jsonb)'::regprocedure);");
    const perturbed = original.replace("from agency_page a", 'from (select * from agency_page order by "amountCents" asc) a');
    assert.notEqual(perturbed, original, "agency aggregate input seam must exist");
    try {
      sql(perturbed);
      assert.deepEqual(report({ agencySort: "sales-desc" }).agencies.rows.map((row: { id: string | null }) => row.id), [null, agency]);
    } finally { sql(original); }
  });
  it("top-agency JSON ordering survives reordered aggregate input", () => {
    const original = sql("select pg_get_functiondef('public.dashboard_report(uuid,jsonb)'::regprocedure);");
    const seam = 'from (select * from groups order by "amountCents" desc,count desc,name collate public.dashboard_thai,id nulls last limit 5) g';
    const perturbed = original.replace(seam, 'from (select * from (select * from groups order by "amountCents" desc,count desc,name collate public.dashboard_thai,id nulls last limit 5) chosen order by "amountCents" asc) g');
    assert.notEqual(perturbed, original, "top-agency aggregate input seam must exist");
    try {
      sql(perturbed);
      assert.deepEqual(report().topAgencies.map((row: { id: string | null }) => row.id), [null, agency]);
    } finally { sql(original); }
  });
  it("preserves every booking sort across pages with ties, null prices and a separate detail", () => {
    sql(`insert into bookings(id,booking_code,listing_id,houseid,check_in,check_out,status,price_max,created_at,updated_at)
      select n,'SORT'||n,'00000000-0000-4000-8000-000000000101',101,
        '2026-06-01'::date + (n % 3),'2026-06-05','confirmed',
        case when n=65 then null when n in (61,62) then 200 else 100 end,
        '2026-05-01','2026-06-10'::timestamptz from generate_series(60,65) n;`);
    for (const [sort, expected] of [
      ["updated-desc", ["65", "64", "63", "62", "61", "60"]],
      ["checkin-desc", ["65", "62", "64", "61", "63", "60"]],
      ["date-desc", ["65", "62", "64", "61", "63", "60"]],
      ["date-asc", ["63", "60", "64", "61", "65", "62"]],
      ["price-asc", ["64", "63", "60", "62", "61", "65"]],
      ["price-desc", ["62", "61", "64", "63", "60", "65"]],
    ] as const) {
      const ids = [1, 2, 3].flatMap(page => {
        const r = report({ month: "2026-06", sort, page, pageSize: 2, bookingId: "60" });
        assert.equal(r.bookings.total, 6);
        assert.equal(r.bookingDetail.id, "60");
        assert.equal(r.bookings.rows.some((row: Record<string, unknown>) => "note" in row || "is_detail" in row), false);
        return r.bookings.rows.map((row: { id: string }) => row.id);
      });
      assert.deepEqual(ids, expected, sort);
    }
  });
  it("keeps tied agencies stable across pages without exposing sort helper fields", () => {
    sql(`insert into agents(id,name) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ชื่อซ้ำ' from generate_series(1,12) n;
      insert into bookings(id,booking_code,listing_id,houseid,agent_id,check_in,check_out,status,price_max,created_at,updated_at)
      select 70+n,'AGENCY-SORT'||n,'00000000-0000-4000-8000-000000000101',101,
        ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'2026-03-01','2026-03-02','confirmed',100,'2026-03-01','2026-03-01' from generate_series(1,12) n;`);
    const expected = Array.from({ length: 12 }, (_, i) => `10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
    for (const agencySort of ["sales-desc", "sales-asc", "count-desc", "count-asc", "name-asc"]) {
      const first = report({ month: "2026-03", agencySort });
      const second = report({ month: "2026-03", agencySort, agenciesPage: 2 });
      assert.equal(first.agencies.rows.length, 10);
      assert.equal(second.agencies.rows.length, 2);
      assert.deepEqual([...first.agencies.rows, ...second.agencies.rows].map((row: { id: string }) => row.id), expected, agencySort);
      assert.deepEqual(first.topAgencies.map((row: { id: string }) => row.id), expected.slice(0,5));
      assert.deepEqual(Object.keys(first.agencies.rows[0]).sort(), ["amountCents", "count", "id", "missingPrices", "name"]);
    }
  });
  it("keeps an existing agency accessible when its selected scope has no bookings", () => {
    const r = report({ agency, checkInFrom: "2027-01-01", checkInTo: "2027-01-02" });
    assert.deepEqual(r.selectedAgency, { id: agency, name: "Agency A", count: 0, amountCents: 0, missingPrices: 0 });
    assert.equal(r.bookings.total, 0);
    assert.equal(report({ agency: "00000000-0000-4000-8000-000000000099" }).selectedAgency, null);
    assert.deepEqual(report({ agency: "unassigned", month: "2027-01" }).selectedAgency, { id: null, name: "ไม่ระบุเอเจนซี่", count: 0, amountCents: 0, missingPrices: 0 });
  });
  it("uses Thai dictionary name order including leading vowels", () => {
    sql(`insert into agents values ('00000000-0000-4000-8000-000000000011','เก่ง'),('00000000-0000-4000-8000-000000000012','ขวัญ');
      insert into bookings(id,booking_code,listing_id,houseid,agent_id,check_in,check_out,status,price_max,created_at,updated_at)
      select 10+n,'THAI'||n,'00000000-0000-4000-8000-000000000101',101,
        ('00000000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'2026-01-01','2026-01-02','confirmed',100,'2026-01-01','2026-01-01' from generate_series(1,2) n;`);
    const r = report({ month: "2026-01", agencySort: "name-asc" });
    assert.deepEqual(r.agencies.rows.map((row: { name: string }) => row.name), ["เก่ง", "ขวัญ"]);
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
    if (process.env.RUN_DASHBOARD_PLANS === "1") {
        for (const [label, actor, query] of [
          ["selective-month", admin, { month: "2026-09", pageSize: 9 }],
          ["broad-month", admin, { month: "2025-01", pageSize: 9 }],
          ["owner-month", owner, { month: "2026-09", pageSize: 9 }],
          ["agency-month", admin, { month: "2025-01", agency, pageSize: 9 }],
          ["stay-range", admin, { month: "2026-09", checkInFrom: "2026-11-01", checkInTo: "2026-11-03", pageSize: 9 }],
        ] as const) {
          inspectPlans(label, actor, query);
        }
    }
    sql(`update bookings set updated_at='2025-01-10' where id>100; analyze bookings;`);
    assert.equal(report({ month: "2025-01" }).bookingCount, 30000);
    assert.equal(report({ month: "2025-01" }).bookings.rows.length, 9);
    if (process.env.RUN_DASHBOARD_PLANS === "1") {
      inspectPlans("dense-month-30000", admin, { month: "2025-01", pageSize: 9 });
      inspectPlans("dense-agency-30000", admin, { month: "2025-01", agency, pageSize: 9 });
      // A minority owner/agency exercises selectivity hidden by single-tenant fixtures.
      sql(`update bookings set houseid=202,listing_id='00000000-0000-4000-8000-000000000202',
        agent_id='00000000-0000-4000-8000-000000000011' where id>100 and id%100<>0; analyze bookings;`);
      assert.equal(report({ month: "2025-01" }, owner).bookingCount, 300);
      assert.equal(report({ month: "2025-01", agency }).bookingCount, 300);
      inspectPlans("minority-owner-300-of-30000", owner, { month: "2025-01", pageSize: 9 });
      inspectPlans("minority-agency-300-of-30000", admin, { month: "2025-01", agency, pageSize: 9 });
    }
    console.log(sql(`explain (analyze,buffers) select dashboard_report('${admin}','{"month":"2025-01","pageSize":9}');`));
  });
});
