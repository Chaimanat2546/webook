import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BookingNotification } from "../lib/booking-notifications.ts";

test("previous house-calendar links forward to the existing gallery and reject invalid IDs", async () => {
  const bundle = await build({ entryPoints: ["app/admin/houses/[propertyId]/bookings/page.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external" });
  const require = createRequire(import.meta.url);
  const loaded = { exports: {} as { default: (props: { params: Promise<{ propertyId: string }> }) => Promise<never> } };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => {
    if (name === "next/navigation") return {
      redirect: (href: string) => { throw new Error("redirect:" + href); },
      notFound: () => { throw new Error("notFound"); },
    };
    return require(name);
  }, loaded, loaded.exports);
  await assert.rejects(loaded.exports.default({ params: Promise.resolve({ propertyId: "990001" }) }), { message: "redirect:/admin/bookings?search=990001&searchMode=dv" });
  for (const propertyId of ["bad", "0", "9223372036854775808", "https://example.com"]) {
    await assert.rejects(loaded.exports.default({ params: Promise.resolve({ propertyId }) }), { message: "notFound" });
  }
});

test("existing Push URLs authorize before forwarding and GET never marks read", async () => {
  const bundle = await build({ entryPoints: ["app/admin/notifications/[notificationId]/page.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "destination-boundaries", setup(b) {
    for (const filter of [/server\/auth\/notifications$/, /server\/services\/booking-notifications$/, /notification-read-marker$/, /ui\/button$/]) b.onResolve({ filter }, args => ({ path: args.path, external: true }));
  } }] });
  const require = createRequire(import.meta.url);
  const loaded = { exports: {} as { default: (props: { params: Promise<{ notificationId: string }> }) => Promise<ReturnType<typeof createElement>> } };
  const id = "6df32bd9-69c4-4445-84ac-7e8399593674";
  let item: BookingNotification | null = { id, bookingId: "722", propertyId: "99202627", title: "House", checkIn: "2026-10-28", checkOut: "2026-10-29", status: "cancelled", eventType: "payment_expired", source: "internal", createdAt: "2026-10-26T00:00:00Z", bookingUpdatedAt: "2026-10-26T00:00:00Z", readAt: null };
  class AccessError extends Error { readonly status: number; constructor(status: number) { super("access"); this.status = status; } }
  let denied: number | null = null;
  let calendarPermission = false;
  let reads = 0;
  let lookups = 0;
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => {
    if (name.endsWith("server/auth/notifications")) return { NotificationAccessError: AccessError, notificationSession: async () => {
      if (denied) throw new AccessError(denied);
      return { actorId: "actor", repository: {}, canUseBooking: calendarPermission };
    } };
    if (name.endsWith("server/services/booking-notifications")) return { getBookingNotification: async (_repo: unknown, actorId: string, notificationId: string) => {
      assert.equal(actorId, "actor"); assert.equal(notificationId, id); lookups++; return item;
    }, readBookingNotifications: () => { reads++; } };
    if (name.endsWith("notification-read-marker")) return { NotificationReadMarker: ({ href, actorId }: { href?: string; actorId: string }) => createElement("span", { "data-destination": href, "data-actor": actorId }) };
    if (name.endsWith("ui/button")) return { buttonVariants: () => "button" };
    if (name === "next/navigation") return { redirect: (href: string) => { throw new Error("redirect:" + href); } };
    return require(name);
  }, loaded, loaded.exports);
  const page = async () => renderToStaticMarkup(await loaded.exports.default({ params: Promise.resolve({ notificationId: id }) }));
  assert.match(await page(), /data-destination="\/admin\/dashboard\/bookings\/722\?month=2026-10&amp;status=all"/);
  assert.equal(reads, 0);
  item = { ...item, source: "ical" };
  assert.doesNotMatch(await page(), /data-destination=/);
  calendarPermission = true;
  assert.match(await page(), /data-destination="\/admin\/bookings\?search=99202627&amp;searchMode=dv"/);
  item = null;
  assert.match(await page(), /ไม่พบรายการแจ้งเตือนนี้/);
  const before = lookups;
  denied = 403;
  assert.match(await page(), /ไม่สามารถเปิดรายการแจ้งเตือนนี้ได้/);
  assert.equal(lookups, before, "unauthorized requests must not look up notification data");
  denied = 401;
  await assert.rejects(page, /redirect:\/login/);
  assert.equal(reads, 0);
});
