import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createWebookUsersRepository } from "../server/repositories/webook-users.ts";

const actor = "10000000-0000-4000-8000-000000000001";
const target = "20000000-0000-4000-8000-000000000001";
test("user update rejects missing verified actor before network access", async () => {
  let requests = 0;
  const client = createClient("https://example.supabase.co", "test", { global: { fetch: async () => {
    requests++;
    return Response.json({ id: target });
  } } });
  await assert.rejects(() => createWebookUsersRepository(client).updateUser(target, { name: "A", roleId: 1 }, ""), /actor/i);
  assert.equal(requests, 0);
});
test("user update uses the atomic role guard and passes server actor only", async () => {
  const client = createClient("https://example.supabase.co", "test", { global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/rpc/webook_update_user_guarded")) {
      assert.deepEqual(JSON.parse(String(init?.body)), { p_actor: actor, p_target: target, p_fields: { name: "A", role_id: 1 } });
      return Response.json(target);
    }
    assert.equal(url.pathname, "/rest/v1/webook_user_management_list");
    return Response.json({ id: target, name: "A", role_id: 1 });
  } } });
  const result = await createWebookUsersRepository(client).updateUser(target, { name: "A", roleId: 1 }, actor);
  assert.equal(result?.roleId, 1);
});
