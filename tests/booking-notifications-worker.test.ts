import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

interface EventValue {
  data?: { json: () => unknown };
  notification?: { data: unknown; close: () => void };
  waitUntil: (work: Promise<unknown>) => void;
}

async function runtime(clientUrl = "https://webook.test/admin") {
  const bundle = await build({ entryPoints: ["worker/pwa-sw.js"], bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"', "self.__WB_MANIFEST": "[]" } });
  const listeners = new Map<string, (event: EventValue) => void>();
  const shown: Array<{ title: string; options: NotificationOptions }> = [];
  const navigated: string[] = [];
  const opened: string[] = [];
  let focused = 0;
  const location = new URL("https://webook.test/sw.js");
  runInNewContext(bundle.outputFiles[0].text, {
    URL, Request, Response, Headers, setTimeout, clearTimeout, location,
    self: { location, registration: { scope: "https://webook.test/", showNotification: async (title: string, options: NotificationOptions) => { shown.push({ title, options }); } },
      addEventListener: (type: string, listener: (event: EventValue) => void) => { listeners.set(type, listener); },
      clients: { matchAll: async () => [{ url: clientUrl, navigate: async (url: string) => { navigated.push(url); }, focus: async () => { focused++; } }], openWindow: async (url: string) => { opened.push(url); } } },
  });
  async function dispatch(type: string, fields: Partial<EventValue>) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ ...fields, waitUntil: (work) => { pending.push(work); } });
    await Promise.all(pending);
  }
  return { shown, navigated, opened, focused: () => focused, dispatch };
}

const id = "ce540198-3482-4d2c-a5e0-9af9bf87cd86";

test("push displays only generic text and a validated notification identifier", async () => {
  const worker = await runtime();
  await worker.dispatch("push", { data: { json: () => ({ notificationId: id, title: "private guest", url: "https://evil.test" }) } });
  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].title, "WeBooks: มี booking ใหม่");
  assert.equal(worker.shown[0].options.body, "เปิด WeBooks เพื่อดูรายละเอียด");
  assert.equal(worker.shown[0].options.tag, id);
  assert.equal(worker.shown[0].options.icon, "/pwa/icon-192.png");
  assert.deepEqual(JSON.parse(JSON.stringify(worker.shown[0].options.data)), { notificationId: id });
});

test("malformed push payloads never show a notification", async () => {
  const worker = await runtime();
  for (const value of [null, {}, { notificationId: "../../login" }, { notificationId: "https://evil.test" }]) {
    await worker.dispatch("push", { data: { json: () => value } });
  }
  await worker.dispatch("push", { data: { json: () => { throw new Error("invalid JSON"); } } });
  assert.equal(worker.shown.length, 0);
});

test("notification clicks route to same-origin detail and focus an existing app", async () => {
  const worker = await runtime();
  let closed = false;
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: id, url: "https://evil.test" }, close: () => { closed = true; } } });
  assert.equal(closed, true);
  assert.deepEqual(worker.navigated, [`https://webook.test/admin/notifications/${id}`]);
  assert.equal(worker.focused(), 1);
  assert.deepEqual(worker.opened, []);
});

test("external clients are ignored and invalid click IDs cannot open windows", async () => {
  const worker = await runtime("https://evil.test/admin");
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: id }, close: () => {} } });
  assert.deepEqual(worker.opened, [`https://webook.test/admin/notifications/${id}`]);
  await worker.dispatch("notificationclick", { notification: { data: { notificationId: "/admin/../login" }, close: () => {} } });
  assert.equal(worker.opened.length, 1);
});
