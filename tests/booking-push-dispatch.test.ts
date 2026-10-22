import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatchBookingPush } from "../server/services/booking-notifications.ts";
import { runBookingMaintenance } from "../server/notifications/maintenance.ts";
import type { NotificationRepository, PushDelivery } from "../server/repositories/booking-notifications.ts";

const config = { publicKey: "unused", privateKey: "unused", subject: "mailto:test@example.test" };
function repository(jobs: PushDelivery[], completed: string[]): NotificationRepository {
  return {
    async inbox() { throw new Error("not used"); }, async read() {}, async subscribe() { return ""; }, async unsubscribe() {},
    async claim() { return jobs; }, async canSend() { return true; }, async complete(job, outcome) { completed.push(`${job.id}:${outcome.status}`); },
  };
}

test("dispatcher limits in-flight delivery work and acknowledges per-job outcomes", async () => {
  const jobs = Array.from({ length: 12 }, (_, index) => ({ id: String(index), leaseToken: "lease", subscriptionId: "device", notificationId: "notification", endpoint: "unused", keys: { p256dh: "unused", auth: "unused" }, attempt: 1 }));
  const completed: string[] = [];
  let active = 0, maxActive = 0;
  const report = await dispatchBookingPush(repository(jobs, completed), config, async job => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    if (job.id === "0") throw new Error("transport crashed");
    return { status: job.id === "1" ? "retry" : "sent", error: null, retryAt: null };
  });
  assert.equal(maxActive, 5);
  assert.equal(completed.length, 11);
  assert.deepEqual(report, { sent: 10, failed: 0, deferred: 2 });
});

test("missing VAPID does not claim jobs or consume attempts", async () => {
  let claimed = false;
  const repo = repository([], []);
  repo.claim = async () => { claimed = true; return []; };
  assert.deepEqual(await dispatchBookingPush(repo, null), { sent: 0, failed: 0, deferred: 0 });
  assert.equal(claimed, false);
});

test("revocation after claim prevents provider submission even for an already leased job", async () => {
  const jobs = [{ id: "job", leaseToken: "lease", subscriptionId: "device", notificationId: "notification", endpoint: "unused", keys: { p256dh: "unused", auth: "unused" }, attempt: 1 }];
  const repo = Object.assign(repository(jobs, []), { canSend: async () => false });
  let sent = 0;
  const result = await dispatchBookingPush(repo, config, async () => { sent++; return { status: "sent", error: null, retryAt: null }; });
  assert.equal(sent, 0);
  assert.deepEqual(result, { sent: 0, failed: 1, deferred: 0 });
});

test("booking expiry and notification maintenance run independently and report safe failures", async () => {
  for (const failed of ["expiry", "push"]) {
    const ran: string[] = [];
    await assert.rejects(runBookingMaintenance(async () => { ran.push("expiry"); if (failed === "expiry") throw new Error("private database failure"); }, async () => { ran.push("push"); if (failed === "push") throw new Error("secret endpoint"); }), error => error instanceof Error && error.message === "booking_maintenance_failed");
    assert.deepEqual(ran.sort(), ["expiry", "push"]);
  }
});
