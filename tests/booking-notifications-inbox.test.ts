import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationCountLabel, shouldRefreshNotifications, visibleNotificationPage } from "../components/admin/notifications/inbox-state.ts";
import type { NotificationPage } from "../lib/booking-notifications.ts";

test("cursors retain database precision and reject malformed or unbounded input", async () => {
  const { notificationCursor } = await import("../lib/booking-notifications.ts");
  const cursor = { createdAt: "2026-10-26T08:00:00.123456+00:00", id: "00000000-0000-4000-8000-000000000001" };
  assert.deepEqual(notificationCursor(JSON.stringify(cursor)), cursor);
  assert.equal(notificationCursor(null), null);
  for (const invalid of ["oops", "x".repeat(1000), {}, { ...cursor, createdAt: "2026-02-30T08:00:00Z" }, { ...cursor, id: "bad" }]) assert.throws(() => notificationCursor(invalid), /notification_invalid_input/);
});

test("notification filters reject arbitrary values and dates use Bangkok boundaries", async () => {
  const { notificationFilter, notificationDay } = await import("../lib/booking-notifications.ts");
  assert.equal(notificationFilter(null), "all");
  for (const filter of ["all", "booking", "payment", "cancelled"]) assert.equal(notificationFilter(filter), filter);
  assert.throws(() => notificationFilter("unknown"), /notification_invalid_input/);
  assert.equal(notificationDay("2026-10-25T18:00:00Z"), "2026-10-26");
});

test("unknown counts stay unknown and unread badges cap at 99+", () => {
  assert.equal(notificationCountLabel(null), null);
  assert.equal(notificationCountLabel(0), null);
  assert.equal(notificationCountLabel(12), "12");
  assert.equal(notificationCountLabel(100), "99+");
});

test("polling pauses for hidden or offline tabs", () => {
  assert.equal(shouldRefreshNotifications("visible", true), true);
  assert.equal(shouldRefreshNotifications("hidden", true), false);
  assert.equal(shouldRefreshNotifications("visible", false), false);
});

test("a newly authenticated actor cannot see the previous actor inbox", () => {
  const page = { actorId: "first" } as NotificationPage;
  assert.equal(visibleNotificationPage(page, "second"), null);
  assert.equal(visibleNotificationPage(page, "first"), page);
});
