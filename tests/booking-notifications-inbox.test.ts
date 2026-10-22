import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationCountLabel, shouldRefreshNotifications, visibleNotificationPage } from "../components/admin/notifications/inbox-state.ts";
import type { NotificationPage } from "../lib/booking-notifications.ts";

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
