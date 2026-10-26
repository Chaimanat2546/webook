import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

interface Inbox {
  items: { id: string; bookingId: string; propertyId: string; title: string; source: string; eventType: string; createdAt: string; bookingUpdatedAt: string; readAt: string | null }[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
}
interface Delivery {
  id: string;
  leaseToken: string;
  notificationId: string;
  subscriptionId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  attempt: number;
  eventType: string;
  propertyId: string;
}

// Explicit opt-in; this fixture never reads project credentials or touches a remote database.
describe("booking notification PostgreSQL contract", { skip: process.env.RUN_NOTIFICATION_DB_TESTS !== "1" }, () => {
  const container = `webook-notifications-${process.pid}`;
  const admin = "00000000-0000-4000-8000-000000000001";
  const owner = "00000000-0000-4000-8000-000000000002";
  const other = "00000000-0000-4000-8000-000000000003";
  const denied = "00000000-0000-4000-8000-000000000004";
  const admin2 = "00000000-0000-4000-8000-000000000005";
  const house = "00000000-0000-4000-8000-000000000010";
  const pgBin = process.env.BOOKING_NOTIFICATION_PG_BIN;
  const executable = pgBin ? join(pgBin, process.platform === "win32" ? "psql.exe" : "psql") : "docker";
  let fixtureDirectory = "";
  let args = ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
  function sql(source: string, success = true): string {
    const result = spawnSync(executable, args, { input: source, encoding: "utf8", timeout: 60_000, windowsHide: true });
    if (success) assert.equal(result.status, 0, result.stderr || result.error?.message);
    else assert.notEqual(result.status, 0, "SQL must reject the operation");
    return `${result.stdout}${result.stderr}`.trim();
  }
  function concurrentSql(source: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { windowsHide: true });
      let output = "", error = "";
      child.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      child.stderr.on("data", (data: Buffer) => { error += data.toString(); });
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
      child.stdin.end(source);
    });
  }
  const inbox = (actor = owner, page = 1, id?: string): Inbox => JSON.parse(sql(`set role service_role; select booking_notification_list('${actor}',${page},${id ? `'${id}'` : "null"});`)) as Inbox;
  const subscribe = (actor = owner, endpoint = "https://fcm.googleapis.com/fcm/send/fixture"): string => sql(`set role service_role; select booking_push_subscribe('${actor}','${endpoint}','${"B".repeat(87)}','${"a".repeat(22)}');`);
  const insert = (id = 1, status = "confirmed", source = "null", property = 100) => sql(`insert into bookings(id,listing_id,houseid,status,check_in,check_out,calendar_source_id) values(${id},'${house}',${property},'${status}','2026-10-23','2026-10-24',${source});`);
  const claim = (limit = 50): Delivery[] => JSON.parse(sql(`set role service_role; select booking_push_claim(${limit});`)) as Delivery[];
  const complete = (job: Delivery, status: string, error = "null", retry = "null") => sql(`set role service_role; select booking_push_complete('${job.id}','${job.leaseToken}','${status}',${error},${retry});`);

  before(async () => {
    if (pgBin) {
      fixtureDirectory = mkdtempSync(join(tmpdir(), "webook-notification-db-"));
      const run = (name: string, commandArgs: string[]) => {
        const result = spawnSync(join(pgBin, process.platform === "win32" ? `${name}.exe` : name), commandArgs, { encoding: "utf8", timeout: 60_000, windowsHide: true });
        assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
      };
      run("initdb", ["-D", join(fixtureDirectory,"data"), "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"]);
      const port = await new Promise<number>((resolvePort, reject) => {
        const server = createServer();
        server.on("error", reject);
        server.listen(0,"127.0.0.1", () => {
          const address = server.address();
          assert.ok(address && typeof address !== "string");
          server.close(() => resolvePort(address.port));
        });
      });
      run("pg_ctl", ["-D", join(fixtureDirectory,"data"), "-l", join(fixtureDirectory,"postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
      args = ["-h", "127.0.0.1", "-p", String(port), "-d", "postgres", "-U", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
    } else {
      const run = spawnSync("docker", ["run", "--rm", "-d", "--network", "none", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], { encoding: "utf8", timeout: 120_000, windowsHide: true });
      assert.equal(run.status, 0, run.stderr || run.error?.message);
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-t", "1"], { timeout: 5000, windowsHide: true }).status === 0) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      assert.ok(ready, "disposable PostgreSQL must accept TCP connections");
    }
    sql(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create table users(id uuid primary key default gen_random_uuid(),uid uuid references auth.users,role_id integer,dv_id bigint);
      create table listings(id uuid primary key,property_id bigint,title text);
      create table bookings(id bigint generated by default as identity primary key,listing_id uuid references listings,houseid bigint,status text,check_in date,check_out date,calendar_source_id uuid,updated_at timestamptz,payment_expires_at timestamptz);
      grant usage on schema public to anon,authenticated,service_role;
      grant select,update on bookings to service_role;
      -- Real Supabase schemas have default grants: the migration must explicitly revoke them.
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      insert into bookings(id,status) values(999,'confirmed');`);
    sql(readFileSync(new URL("../supabase/migrations/20261022100000_booking_notifications.sql", import.meta.url), "utf8"));
    const expiry = readFileSync(new URL("../supabase/migrations/20260930100000_booking_payment_expiry.sql", import.meta.url), "utf8");
    sql(expiry.match(/create or replace function public\.admin_expire_waiting_bookings[\s\S]*?\$\$;/i)![0]);
    const lifecycle = new URL("../supabase/migrations/20261022150000_booking_lifecycle_notifications.sql", import.meta.url);
    if (existsSync(lifecycle)) sql(readFileSync(lifecycle, "utf8"));
    const pushHouse = new URL("../supabase/migrations/20261023090000_booking_push_house_id.sql", import.meta.url);
    if (existsSync(pushHouse)) sql(readFileSync(pushHouse, "utf8"));
    const filters = readFileSync(new URL("../supabase/migrations/20261026090000_notification_inbox_filters.sql", import.meta.url), "utf8");
    sql(filters);
    sql(filters); // Reapplying the function definition is safe.
    const cursorMigration = new URL("../supabase/migrations/20261026100000_notification_cursor_feed.sql", import.meta.url);
    if (existsSync(cursorMigration)) sql(readFileSync(cursorMigration, "utf8"));
    assert.equal(sql("select count(*) from booking_notifications;"), "0", "migration must not backfill existing bookings");
  });
  after(() => {
    if (pgBin && fixtureDirectory) {
      const stopped = spawnSync(join(pgBin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl"), ["-D", join(fixtureDirectory,"data"), "-w", "stop"], { encoding: "utf8", timeout: 30_000, windowsHide: true });
      assert.equal(stopped.status, 0, stopped.stderr);
      const absoluteFixture = resolve(fixtureDirectory);
      assert.equal(dirname(absoluteFixture), resolve(tmpdir()));
      assert.ok(basename(absoluteFixture).startsWith("webook-notification-db-"));
      rmSync(absoluteFixture,{ recursive: true, force: true });
    } else if (!pgBin) spawnSync("docker", ["rm", "-f", container], { encoding: "utf8", timeout: 30_000, windowsHide: true });
  });
  beforeEach(() => {
    sql(`truncate bookings,users,listings,auth.users,booking_notifications,push_subscriptions,booking_push_deliveries restart identity cascade;
      insert into auth.users values('${admin}'),('${owner}'),('${other}'),('${denied}'),('${admin2}');
      insert into users(uid,role_id,dv_id) values('${admin}',1,null),('${owner}',3,100),('${other}',3,101),('${denied}',3,0),('${admin2}',1,100),(null,1,100);
      insert into listings values('${house}',100,'Fixture house');`);
  });

  it("captures only new waiting/confirmed internal and iCal bookings for all admins and matching DV owners", () => {
    subscribe();
    insert(); insert(2, "waiting", "'00000000-0000-4000-8000-000000000020'");
    insert(3, "repair"); insert(4, "cancelled"); insert(5, "confirmed", "null", 101);
    sql("update bookings set status='confirmed' where id=3; insert into bookings(id,status) values(1,'confirmed') on conflict do nothing;");
    assert.equal(sql("select count(*) from booking_notifications;"), "8");
    assert.equal(inbox(admin).total, 3);
    assert.equal(inbox(admin2).total, 3, "matching admin is not duplicated");
    assert.equal(inbox(other).total, 0, "houseid alone cannot substitute a listing's DV");
    assert.deepEqual(inbox().items.map(item => [item.bookingId, item.propertyId, item.title, item.source]), [["2", "100", "Fixture house", "ical"], ["1", "100", "Fixture house", "internal"]]);
    assert.equal(sql("select count(*) from booking_push_deliveries;"), "2");
    assert.ok(Number.isFinite(Date.parse(inbox().items[0].bookingUpdatedAt)), "null booking revision falls back to event creation time");
    sql("update bookings set updated_at='2026-09-30T18:00:00Z' where id=2;");
    assert.equal(new Date(inbox().items[0].bookingUpdatedAt).toISOString(), "2026-09-30T18:00:00.000Z");
    assert.match(sql(`select booking_notification_list('${denied}',1,null);`, false), /notification_forbidden/);
    assert.match(sql("select booking_notification_list('00000000-0000-4000-8000-000000000099',1,null);", false), /notification_forbidden/);
  });

  it("rolls back notifications and jobs together with a booking", () => {
    subscribe(); sql(`begin; insert into bookings(id,listing_id,houseid,status) values(1,'${house}',100,'waiting'); rollback;`);
    assert.equal(sql("select count(*) from bookings;"), "0");
    assert.equal(sql("select count(*) from booking_notifications;"), "0");
    assert.equal(sql("select count(*) from booking_push_deliveries;"), "0");
  });

  it("filters before pagination while preserving global unread counts and current scope", () => {
    sql(`insert into bookings(id,listing_id,houseid,status,check_in,check_out)
      select n,'${house}',100,'waiting','2026-10-23','2026-10-24' from generate_series(1,25) n;
      update bookings set status='confirmed';`);
    const filtered = (filter: string, page = 1): Inbox => JSON.parse(sql(`set role service_role; select booking_notification_list_filtered('${owner}',${page},'${filter}');`)) as Inbox;
    const first = filtered("booking");
    const second = filtered("booking", 2);
    assert.equal(first.total, 25);
    assert.equal(first.unreadCount, 50);
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 5);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 25);
    assert.ok([...first.items, ...second.items].every(item => item.eventType === "booking_created"));
    assert.equal(filtered("payment").total, 25);
    assert.ok(filtered("payment").items.every(item => item.eventType === "payment_succeeded"));
    assert.equal(filtered("cancelled").total, 0);
    assert.equal(filtered("cancelled").unreadCount, 50);
    assert.match(sql(`set role service_role; select booking_notification_list_filtered('${owner}',1,'unknown');`, false), /notification_invalid_input/);
    for (const role of ["anon", "authenticated"]) assert.match(sql(`set role ${role}; select booking_notification_list_filtered('${owner}',1,'all');`, false), /permission denied/);
    sql(`update users set dv_id=101 where uid='${owner}';`);
    assert.equal(filtered("payment").total, 0);
    assert.equal(filtered("payment").unreadCount, 0);
  });

  it("cursor feeds preserve timestamp ties, detect new rows and revalidate loaded access", () => {
    interface Cursor { createdAt: string; id: string }
    interface Feed extends Inbox { nextCursor: Cursor | null; hasNew: boolean; retained: { id: string; readAt: string | null }[] | null }
    const feed = (filter = "booking", cursor: Cursor | null = null, head: Cursor | null = null, tail: Cursor | null = null): Feed => {
      const arg = (value: Cursor | null) => value ? `'${JSON.stringify(value)}'::jsonb` : "null";
      return JSON.parse(sql(`set role service_role; select booking_notification_feed('${owner}','${filter}',${arg(cursor)},${arg(head)},${arg(tail)});`)) as Feed;
    };
    sql(`insert into bookings(id,listing_id,houseid,status,check_in,check_out)
      select n,'${house}',100,'waiting','2026-10-23','2026-10-24' from generate_series(1,25) n;
      update booking_notifications set created_at='2026-10-25T01:00:00.123456Z';`);
    const first = feed();
    assert.equal(first.items.length, 20);
    assert.match(first.nextCursor!.createdAt, /123456/);
    insert(26, "waiting");
    const second = feed("booking", first.nextCursor);
    assert.equal(second.items.length, 5);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 25);
    assert.ok(second.items.every(item => item.bookingId !== "26"));
    const head = { createdAt: first.items[0].createdAt, id: first.items[0].id };
    const last = second.items.at(-1)!;
    const tail = { createdAt: last.createdAt, id: last.id };
    assert.equal(feed("booking", null, head, tail).hasNew, true);
    sql(`update booking_notifications set read_at=clock_timestamp() where id='${head.id}';`);
    assert.ok(feed("booking", null, head, tail).retained!.find(item => item.id === head.id)!.readAt);
    sql(`delete from bookings where id=${first.items[0].bookingId};`);
    assert.ok(!feed("booking", null, head, tail).retained!.some(item => item.id === head.id));
    sql("update bookings set status='confirmed';");
    assert.equal(feed("payment").total, 25);
    assert.ok(feed("payment").items.every(item => item.eventType === "payment_succeeded"));
    for (const role of ["anon", "authenticated"]) assert.match(sql(`set role ${role}; select booking_notification_feed('${owner}');`, false), /permission denied/);
    assert.match(sql(`set role service_role; select booking_notification_feed('${owner}','bad');`, false), /notification_invalid_input/);
    sql(`update users set dv_id=101 where uid='${owner}';`);
    assert.equal(feed("booking", null, head, tail).retained!.length, 0);
    assert.equal(feed().unreadCount, 0);
  });

  it("bounds retained-history responses to 100 rows with a continuation cursor", () => {
    sql(`insert into bookings(id,listing_id,houseid,status,check_in,check_out)
      select n,'${house}',100,'waiting','2026-10-23','2026-10-24' from generate_series(1,125) n;
      update booking_notifications set created_at='2026-10-25T01:00:00.123456Z';`);
    const head = JSON.stringify({ createdAt: "9999-01-01T00:00:00Z", id: "ffffffff-ffff-ffff-ffff-ffffffffffff" });
    const tail = JSON.stringify({ createdAt: "0001-01-01T00:00:00Z", id: "00000000-0000-0000-0000-000000000000" });
    interface Window { items: { id: string }[]; retained: { id: string }[]; retainedCursor: { createdAt: string; id: string } | null }
    const get = (cursor = "null"): Window => JSON.parse(sql(`set role service_role; select booking_notification_feed('${owner}','all',null,'${head}','${tail}',${cursor});`)) as Window;
    const first = get();
    assert.equal(first.items.length, 20);
    assert.equal(first.retained.length, 100);
    assert.ok(first.retainedCursor);
    const second = get(`'${JSON.stringify(first.retainedCursor)}'::jsonb`);
    assert.equal(second.retained.length, 25);
    assert.equal(second.retainedCursor, null);
    assert.equal(new Set([...first.retained, ...second.retained].map(item => item.id)).size, 125);
  });

  it("notifies all admins and only matching owners when waiting becomes confirmed, without duplicate saves", () => {
    subscribe(); subscribe(admin, "https://fcm.googleapis.com/admin"); subscribe(admin2, "https://fcm.googleapis.com/admin2"); subscribe(other, "https://fcm.googleapis.com/other");
    insert(1, "waiting");
    sql("update bookings set status='confirmed',payment_expires_at=null,updated_at=clock_timestamp() where id=1; update bookings set status='confirmed',updated_at=clock_timestamp() where id=1;");
    for (const actor of [admin, admin2, owner]) assert.deepEqual(inbox(actor).items.map(item => item.eventType), ["payment_succeeded", "booking_created"]);
    assert.equal(inbox(other).total, 0);
    const jobs = claim(); assert.equal(jobs.length, 6);
    assert.ok(jobs.every(job => job.propertyId === "100"), "claimed Push jobs must carry the captured house DV as text");
    assert.equal(jobs.filter(job => job.eventType === "payment_succeeded").length, 3);
    sql("update bookings set status='waiting' where id=1; update bookings set status='confirmed' where id=1;");
    assert.equal(inbox().items.filter(item => item.eventType === "payment_succeeded").length, 2, "a later real transition is a new event");
  });

  it("keeps manual cancellation distinct from automatic expiry, including a passed deadline", () => {
    insert(1, "waiting"); insert(2, "confirmed"); insert(3, "repair");
    sql("update bookings set payment_expires_at=now()-interval '1 minute' where id=1; update bookings set status='cancelled',payment_expires_at=null where id in (1,2,3); update bookings set status='cancelled' where id=1;");
    for (const actor of [admin, admin2, owner]) assert.equal(inbox(actor).items.filter(item => item.eventType === "booking_cancelled").length, 2);
    assert.equal(inbox(other).total, 0);
    assert.equal(inbox().items.filter(item => item.eventType === "payment_expired").length, 0);
    assert.equal(sql("select count(*) from bookings where cancellation_reason='manual';"), "2");
  });

  it("expiry sweep emits only payment_expired once and clears provenance on reopening", () => {
    subscribe(); insert(1, "waiting"); insert(2, "confirmed"); insert(3, "waiting");
    sql("update bookings set payment_expires_at=now()-interval '1 minute'; update bookings set payment_expires_at=now()+interval '1 hour' where id=3;");
    assert.equal(sql("set role service_role; select admin_expire_waiting_bookings(500);"), "1");
    assert.equal(sql("set role service_role; select admin_expire_waiting_bookings(500);"), "0");
    for (const actor of [admin, admin2, owner]) assert.equal(inbox(actor).items.filter(item => item.eventType === "payment_expired").length, 1);
    assert.equal(inbox(other).total, 0);
    assert.equal(inbox().items.filter(item => item.eventType === "booking_cancelled").length, 0);
    assert.equal(claim().filter(job => job.eventType === "payment_expired").length, 1);
    sql("update bookings set status='waiting',payment_expires_at=now()+interval '1 hour' where id=1; update bookings set status='cancelled',payment_expires_at=null where id=1;");
    assert.equal(inbox().items.filter(item => item.eventType === "booking_cancelled").length, 1);
    assert.equal(sql("select cancellation_reason from bookings where id=1;"), "manual");
  });

  it("rollback removes lifecycle events and confirmed inserts never imply another payment event", () => {
    subscribe(); insert(1, "confirmed");
    sql("begin; update bookings set status='cancelled' where id=1; rollback;");
    assert.deepEqual(inbox().items.map(item => item.eventType), ["booking_created"]);
    assert.equal(claim().length, 1);
    insert(2, "waiting", "'00000000-0000-4000-8000-000000000020'");
    sql("update bookings set status='confirmed' where id=2;");
    assert.equal(inbox().items.filter(item => item.eventType === "payment_succeeded").length, 0, "iCal status updates are not payment confirmation");
  });

  it("a later device receives only the new transition, without backfilling earlier event pushes", () => {
    insert(1, "waiting"); subscribe();
    sql("update bookings set status='confirmed' where id=1;");
    assert.deepEqual(claim().map(job => job.eventType), ["payment_succeeded"]);
    assert.equal(inbox().total, 2, "earlier inbox history remains visible");
  });

  it("keeps pagination, ownership and a read-all snapshot cutoff idempotent", () => {
    insert();
    const snapshot = inbox();
    const id = snapshot.items[0].id;
    assert.equal(snapshot.pageSize, 20);
    assert.equal(snapshot.unreadCount, 1);
    insert(2);
    sql(`set role service_role; select booking_notification_read('${owner}',null,'${snapshot.asOf}'); select booking_notification_read('${owner}',null,'${snapshot.asOf}');`);
    assert.equal(inbox().unreadCount, 1, "newly arriving notifications remain unread");
    const readAt = inbox(owner, 1, id).items[0].readAt;
    sql(`set role service_role; select booking_notification_read('${owner}','${id}',null);`);
    assert.equal(inbox(owner, 1, id).items[0].readAt, readAt);
    assert.equal(inbox(other, 1, id).items.length, 0);
    sql(`select booking_notification_read('${other}','${id}',null);`);
    assert.equal(inbox().unreadCount, 1);
    sql(`insert into bookings(id,listing_id,houseid,status) select i,'${house}',100,'waiting' from generate_series(3,23)i;`);
    assert.equal(inbox().total, 23);
    assert.equal(inbox().items.length, 20);
    assert.equal(inbox(owner, 2).items.length, 3);
  });

  it("revokes list, read and delivery scope when DV or role changes after capture", () => {
    subscribe(); subscribe(admin, "https://fcm.googleapis.com/fcm/send/admin"); insert();
    const id = inbox().items[0].id;
    sql(`update users set dv_id=101 where uid='${owner}'; update users set role_id=3,dv_id=101 where uid='${admin}';`);
    assert.equal(inbox().total, 0); assert.equal(inbox(admin).total, 0);
    sql(`select booking_notification_read('${owner}','${id}',null);`);
    assert.equal(sql(`select read_at is null from booking_notifications where id='${id}';`), "t");
    assert.deepEqual(claim(), []);
    sql(`update users set dv_id=0 where uid='${owner}';`);
    assert.match(sql(`select booking_notification_read('${owner}',null,now());`, false), /notification_forbidden/);
  });

  it("denies browser table access and every RPC while service RPC grants are explicit", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["booking_notifications", "push_subscriptions", "booking_push_deliveries"]) {
        assert.match(sql(`set role ${role}; select * from ${table};`, false), /permission denied/);
      }
      const calls = [
        "admin_expire_waiting_bookings(500)", "booking_cancellation_provenance()",
        `booking_notification_list('${owner}',1,null)`, `booking_notification_read('${owner}',null,now())`,
        `booking_push_subscribe('${owner}','https://fcm.googleapis.com/fcm/send/a','key','key')`,
        `booking_push_unsubscribe('${owner}',null,null)`, "booking_push_claim(50)",
        `booking_push_authorize('${owner}','${owner}')`,
        `booking_push_complete('${owner}','${owner}','sent',null,null)`,
      ];
      for (const call of calls) assert.match(sql(`set role ${role}; select ${call};`, false), /permission denied/);
    }
    assert.equal(sql("select bool_and(relrowsecurity) from pg_class where oid in ('booking_notifications'::regclass,'push_subscriptions'::regclass,'booking_push_deliveries'::regclass);"), "t");
    assert.equal(inbox().total, 0, "authorized empty inbox is distinct from forbidden");
  });

  it("isolates devices, makes subscribe idempotent and invalidates jobs after an endpoint changes owner", () => {
    const first = subscribe(); assert.equal(subscribe(), first);
    subscribe(owner, "https://fcm.googleapis.com/fcm/send/second"); insert();
    assert.equal(subscribe(other), first, "endpoint transfer keeps its unique record");
    sql(`select booking_push_unsubscribe('${owner}','https://fcm.googleapis.com/fcm/send/fixture',null);`);
    assert.equal(sql(`select recipient_uid from push_subscriptions where id='${first}';`), other, "former owner cannot unsubscribe transferred endpoint");
    const jobs = claim(); assert.equal(jobs.length, 1); assert.notEqual(jobs[0].subscriptionId, first);
    sql(`select booking_push_unsubscribe('${owner}',null,'${jobs[0].subscriptionId}');`);
    assert.equal(sql(`select count(*) from push_subscriptions where recipient_uid='${owner}';`), "0");
    assert.equal(complete(jobs[0], "sent"), "f", "unsubscribe invalidates an existing lease");
  });

  it("uses bounded exclusive claims and reclaims expired leases with fresh tokens", async () => {
    subscribe(); sql(`insert into bookings(id,listing_id,houseid,status) select i,'${house}',100,'waiting' from generate_series(1,60)i;`);
    const batches = await Promise.all([
      concurrentSql("begin; set role service_role; select booking_push_claim(1000); select pg_sleep(1); commit;"),
      concurrentSql("set role service_role; select booking_push_claim(1000);"),
    ]);
    const jobs = batches.flatMap(output => JSON.parse(output.split(/\r?\n/)[0]) as Delivery[]);
    assert.equal(jobs.length, 60);
    assert.equal(new Set(jobs.map(job => job.id)).size, 60);
    assert.ok(batches.every(output => (JSON.parse(output.split(/\r?\n/)[0]) as Delivery[]).length <= 50));
    assert.deepEqual(claim(), []);
    const job = jobs[0];
    sql(`update booking_push_deliveries set lease_expires_at=now()-interval '1 second' where id='${job.id}';`);
    assert.equal(complete(job, "sent"), "f", "expired lease cannot acknowledge");
    const next = claim()[0]; assert.equal(next.id, job.id); assert.equal(next.attempt, 2); assert.notEqual(next.leaseToken, job.leaseToken);
    assert.equal(complete(job, "sent"), "f"); assert.equal(complete(next, "sent"), "t"); assert.equal(complete(next, "sent"), "f");
  });

  it("enforces five attempts, retry time and 24-hour expiry without replay", () => {
    subscribe(); insert();
    let job = claim()[0];
    complete(job, "retry", "'push_network'", "now()+interval '10 minutes'");
    assert.deepEqual(claim(), []);
    for (let attempt = 2; attempt <= 5; attempt++) {
      sql("update booking_push_deliveries set next_attempt_at=now()-interval '1 second';");
      job = claim()[0]; assert.equal(job.attempt, attempt);
      complete(job, "retry", "'push_network'", "now()");
    }
    assert.deepEqual(claim(), []);
    insert(2); sql("update booking_notifications set created_at=now()-interval '25 hours' where booking_id=2;");
    assert.deepEqual(claim(), []);
    assert.equal(sql("select count(*) from booking_push_deliveries where status in ('pending','retry','sending');"), "0");
    insert(3); job = claim()[0]; complete(job, "failed", "'push_configuration'");
    assert.equal(sql("select count(*) from push_subscriptions;"), "1", "configuration error does not retire a device");
  });

  it("retires an expired subscription and all its jobs, retaining other devices", () => {
    const expired = subscribe(); const active = subscribe(owner, "https://fcm.googleapis.com/fcm/send/other");
    insert(); insert(2);
    const jobs = claim(); const job = jobs.find(value => value.subscriptionId === expired); assert.ok(job);
    complete(job, "expired", "'push_expired'");
    assert.equal(sql(`select count(*) from push_subscriptions where id='${expired}';`), "0");
    assert.equal(sql(`select count(*) from push_subscriptions where id='${active}';`), "1");
    assert.equal(sql(`select count(*) from booking_push_deliveries where subscription_id='${expired}' and status='sending';`), "0");
    const activeJob = jobs.find(value => value.subscriptionId === active); assert.ok(activeJob);
    assert.equal(complete(activeJob, "sent"), "t");
  });

  it("keeps positive-DV owners with a null role consistent with dashboard authorization", () => {
    sql(`update users set role_id=null where uid='${owner}';`);
    subscribe(); insert();
    assert.equal(inbox().total, 1);
    assert.equal(claim().length, 1);
  });

  it("ignores an orphan Auth UID rather than aborting a valid booking transaction", () => {
    const orphan = "00000000-0000-4000-8000-000000000099";
    // Model an inconsistent legacy mapping even though this fixture normally enforces its Auth FK.
    sql(`alter table users drop constraint users_uid_fkey; insert into users(uid,role_id) values('${orphan}',1);`);
    try {
      insert();
      assert.equal(inbox().total, 1);
      assert.equal(sql(`select count(*) from booking_notifications where recipient_uid='${orphan}';`), "0");
    } finally {
      sql(`delete from users where uid='${orphan}'; alter table users add constraint users_uid_fkey foreign key(uid) references auth.users(id);`);
    }
  });

  it("bounds invalid-job maintenance while withholding every revoked delivery", () => {
    subscribe();
    sql(`insert into bookings(id,listing_id,houseid,status) select i,'${house}',100,'waiting' from generate_series(1,600)i; update users set dv_id=101 where uid='${owner}';`);
    assert.deepEqual(claim(), []);
    assert.equal(sql("select count(*) from booking_push_deliveries where status='pending';"), "100");
    assert.deepEqual(claim(), []);
    assert.equal(sql("select count(*) from booking_push_deliveries where status='pending';"), "0");
  });

  it("rechecks lease, current permissions, device ownership and event age immediately before sending", () => {
    subscribe(); insert(); const job = claim()[0];
    const authorize = () => sql(`set role service_role; select booking_push_authorize('${job.id}','${job.leaseToken}');`);
    assert.equal(authorize(), "t");
    assert.equal(sql(`set role service_role; select booking_push_authorize('${job.id}','${owner}');`), "f");
    sql(`update users set dv_id=101 where uid='${owner}';`); assert.equal(authorize(), "f");
    sql(`update users set dv_id=100 where uid='${owner}';`);
    sql(`update booking_push_deliveries set lease_expires_at=now()-interval '1 second' where id='${job.id}';`); assert.equal(authorize(), "f");
    sql(`update booking_push_deliveries set lease_expires_at=now()+interval '3 minutes' where id='${job.id}'; update booking_notifications set created_at=now()-interval '25 hours' where id='${job.notificationId}';`); assert.equal(authorize(), "f");
    sql(`update booking_notifications set created_at=now() where id='${job.notificationId}';`);
    subscribe(other); assert.equal(authorize(), "f");
  });
});
