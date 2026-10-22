import assert from "node:assert/strict";
import { test } from "node:test";
import * as notifications from "../server/services/booking-notifications.ts";

test("successful account switching retires the previous actor's cookie binding before a no-access redirect", async () => {
  const removed: unknown[] = [];
  const repo = { async unsubscribe(actorId: string, selector: unknown) { removed.push({ actorId, selector }); } };
  const id = "00000000-0000-4000-8000-000000000001";
  await notifications.retirePushBindingOnAccountChange(repo, "old-auth-uid", "new-auth-uid", id);
  assert.deepEqual(removed, [{ actorId: "old-auth-uid", selector: { subscriptionId: id } }]);
  await notifications.retirePushBindingOnAccountChange(repo, "old-auth-uid", "old-auth-uid", id);
  await notifications.retirePushBindingOnAccountChange(repo, null, "new-auth-uid", id);
  assert.equal(removed.length, 1);
});
