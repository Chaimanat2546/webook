import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createLoginHistoryRepository } from "../server/repositories/login-history.ts";
import { LoginHistoryError } from "../lib/login-history.ts";
const actor = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "30000000-0000-4000-8000-000000000001" };
const row = { id: "40000000-0000-4000-8000-000000000001", user_id: actor.userId, session_id: actor.sessionId, logged_in_at: "2026-10-26T10:00:00Z", os: "Linux", browser: "Chrome", device_type: "desktop", location_status: "pending", ip_address: null };
test("record and attach send trusted actor and return a DTO without session or credentials", async () => {
  const requests: string[] = [];
  const client = createClient("https://example.supabase.co", "test", { global: { fetch: async (input, init) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!; requests.push(name);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.p_user, actor.userId); assert.equal(payload.p_session, actor.sessionId);
    if (name === "login_history_attach") {
      assert.equal(payload.p_history, row.id); assert.equal(payload.p_latitude, null); assert.equal(payload.p_status, "skipped");
    }
    return Response.json(row);
  } } });
  const repo = createLoginHistoryRepository(client);
  const record = await repo.record({ ...actor, loggedInAt: row.logged_in_at, os: "Linux", browser: "Chrome", deviceType: "desktop", ipAddress: null });
  assert.equal(record.id, row.id); assert.ok(!("sessionId" in record)); assert.ok(!("session_id" in record));
  await repo.attach(actor, { historyId: row.id, status: "skipped" });
  assert.deepEqual(requests, ["login_history_record", "login_history_attach"]);
});
test("repository maps private SQL errors to bounded HTTP errors", async () => {
  for (const [code, status] of [["28000",401],["42501",403],["P0002",404],["P0001",409],["23514",400],["40001",503]]) {
    const client = createClient("https://example.supabase.co", "test", { global: { fetch: async () => Response.json({ code, message: "sensitive postgres detail" },{status:400}) } });
    await assert.rejects(() => createLoginHistoryRepository(client).attach(actor, { historyId: row.id, status: "skipped" }), error => error instanceof LoginHistoryError && error.status === status && !error.message.includes("sensitive"));
  }
});
test("list rejects attempts to pass search through a self-only scope before database access", async () => {
  const client = createClient("https://example.supabase.co", "test", { global: { fetch: async () => { throw new Error("must not access network"); } } });
  await assert.rejects(() => createLoginHistoryRepository(client).list({kind:"self",userId:actor.userId}, {search:"B",from:null,to:null,page:1,pageSize:25}), error => error instanceof LoginHistoryError && error.status===403);
});
