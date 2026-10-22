import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

interface EventValue {
  data?: { json: () => unknown };
  notification?: { data: unknown; close: () => void };
  waitUntil: (work: Promise<unknown>) => void;
}

async function runtime(clientUrl = "https://webook.test/admin", openedClientAvailable = true) {
  const bundle = await build({ entryPoints: ["worker/pwa-sw.js"], bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"', "self.__WB_MANIFEST": "[]" } });
  const listeners = new Map<string, (event: EventValue) => void>();
  const shown: Array<{ title: string; options: NotificationOptions }> = [];
  const navigated: string[] = [];
  const opened: string[] = [];
  let focused = 0;
  let openedFocused = 0;
  let matched = 0;
  const location = new URL("https://webook.test/sw.js");
  runInNewContext(bundle.outputFiles[0].text, {
    URL, Request, Response, Headers, setTimeout, clearTimeout, location,
    self: { location, registration: { scope: "https://webook.test/", showNotification: async (title: string, options: NotificationOptions) => { shown.push({ title, options }); } },
      addEventListener: (type: string, listener: (event: EventValue) => void) => { listeners.set(type, listener); },
      clients: { matchAll: async () => { matched++; return [{ url: clientUrl, navigate: async (url: string) => { navigated.push(url); }, focus: async () => { focused++; } }]; }, openWindow: async (url: string) => { opened.push(url); return openedClientAvailable ? { focus: async () => { openedFocused++; } } : null; } } },
  });
  async function dispatch(type: string, fields: Partial<EventValue>) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ ...fields, waitUntil: (work) => { pending.push(work); } });
    await Promise.all(pending);
  }
  return { shown, navigated, opened, focused: () => focused, openedFocused: () => openedFocused, matched: () => matched, dispatch };
}

const id = "ce540198-3482-4d2c-a5e0-9af9bf87cd86";

test("legacy push keeps the WeBooks title and displays its event without a missing DV", async () => {
  const worker = await runtime();
  await worker.dispatch("push", { data: { json: () => ({ notificationId: id, title: "private guest", url: "https://evil.test" }) } });
  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, "WeBooks");
  assert.equal(worker.shown[0].options.body, "มี booking ใหม่");
  assert.equal(worker.shown[0].options.tag, id);
  assert.equal(worker.shown[0].options.icon, "/pwa/icon-192.png");
  assert.deepEqual(JSON.parse(JSON.stringify(worker.shown[0].options.data)), { notificationId: id });
});

test("malformed push payloads never show a notification", async () => {
  const worker = await runtime();
  for (const value of [null, {}, { notificationId: "../../login" }, { notificationId: "https://evil.test" }, { notificationId: id, eventType: "private text" }]) {
    await worker.dispatch("push", { data: { json: () => value } });
  }
  for (const propertyId of [null, 100, "0", "-1", "001", "house name", "../100", "100\n", "9223372036854775808"]) {
    await worker.dispatch("push", { data: { json: () => ({ notificationId: id, propertyId }) } });
  }
  await worker.dispatch("push", { data: { json: () => { throw new Error("invalid JSON"); } } });
  assert.equal(worker.shown.length, 0);
});

test("pushes use one app title and show only the event and validated house DV in the body", async () => {
  const worker = await runtime();
  for (const [eventType, expected] of [["booking_created", "มี booking ใหม่ • DV 99882204"], ["payment_succeeded", "ชำระเงิน booking สำเร็จ • DV 99882204"], ["booking_cancelled", "ยกเลิก booking • DV 99882204"], ["payment_expired", "booking หมดเวลาชำระเงิน • DV 99882204"]]) {
    await worker.dispatch("push", { data: { json: () => ({ notificationId: id, eventType, propertyId: "99882204", title: "private customer", body: "private amount" }) } });
    const shown = worker.shown.at(-1)!;
    assert.equal(shown.title, "WeBooks");
    assert.equal(shown.options.body, expected);
    assert.deepEqual(JSON.parse(JSON.stringify(shown.options.data)), { notificationId: id });
  }
  await worker.dispatch("push", { data: { json: () => ({ notificationId: id, eventType: "payment_succeeded", propertyId: "9007199254740993" }) } });
  assert.equal(worker.shown.at(-1)!.options.body, "ชำระเงิน booking สำเร็จ • DV 9007199254740993");
  await worker.dispatch("push", { data: { json: () => ({ notificationId: id, eventType: "payment_expired" }) } });
  assert.equal(worker.shown.at(-1)!.options.body, "booking หมดเวลาชำระเงิน");
});

test("notification clicks use the app launch API instead of navigating a same-origin Safari tab", async () => {
  const worker = await runtime();
  let closed = false;
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: id, url: "https://evil.test" }, close: () => { closed = true; } } });
  assert.equal(closed, true);
  assert.deepEqual(worker.navigated, []);
  assert.equal(worker.focused(), 0);
  assert.equal(worker.matched(), 0);
  assert.deepEqual(worker.opened, [`https://webook.test/admin/notifications/${id}`]);
  assert.equal(worker.openedFocused(), 1);
});

test("a platform app launch without a returned WindowClient never falls back to Safari", async () => {
  const worker = await runtime("https://webook.test/admin", false);
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: id }, close: () => {} } });
  assert.deepEqual(worker.opened, [`https://webook.test/admin/notifications/${id}`]);
  assert.deepEqual(worker.navigated, []);
  assert.equal(worker.focused(), 0);
  assert.equal(worker.matched(), 0);
  assert.equal(worker.openedFocused(), 0);
});

test("external clients are ignored and invalid click IDs cannot open windows", async () => {
  const worker = await runtime("https://evil.test/admin");
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: id }, close: () => {} } });
  assert.deepEqual(worker.opened, [`https://webook.test/admin/notifications/${id}`]);
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: "/admin/../login" }, close: () => {} } });
  assert.equal(worker.opened.length, 1);
});
