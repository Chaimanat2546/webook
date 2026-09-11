import assert from "node:assert/strict";
import { test } from "node:test";
import { activateUpdate, observeUpdates, type UpdateWorker } from "../lib/pwa/updates.ts";

class Worker extends EventTarget implements UpdateWorker {
  state = "installed";
  messages: { type: string }[] = [];
  postMessage(message: { type: string }) { this.messages.push(message); }
}

test("existing and newly installed waiting workers are shown without activation", () => {
  const old = new Worker();
  const fresh = new Worker();
  const registration = Object.assign(new EventTarget(), { waiting: fresh as Worker | null, installing: null as Worker | null });
  const container = Object.assign(new EventTarget(), { controller: old });
  const seen: Worker[] = [];
  const stop = observeUpdates(registration, container, (w) => seen.push(w as Worker), () => {});
  assert.deepEqual(seen, [fresh]);
  assert.deepEqual(fresh.messages, []);
  const newer = new Worker();
  registration.waiting = null;
  registration.installing = newer;
  registration.dispatchEvent(new Event("updatefound"));
  registration.waiting = newer;
  newer.dispatchEvent(new Event("statechange"));
  assert.equal(seen.at(-1), newer);
  stop();
});

test("only the confirming window requests activation; other windows get a notice", async () => {
  const old = new Worker();
  const fresh = new Worker();
  const container = Object.assign(new EventTarget(), { controller: old });
  const registration = Object.assign(new EventTarget(), { waiting: fresh, installing: null });
  let notices = 0;
  const stop = observeUpdates(registration, container, () => {}, () => { notices++; });
  const activation = activateUpdate(container, fresh);
  assert.deepEqual(fresh.messages, [{ type: "WEBOOK_ACTIVATE_UPDATE" }]);
  container.controller = fresh;
  container.dispatchEvent(new Event("controllerchange"));
  await activation;
  assert.equal(notices, 1);
  stop();
  container.controller = new Worker();
  container.dispatchEvent(new Event("controllerchange"));
  assert.equal(notices, 1);
});

test("first installation does not request a reload", () => {
  const container = Object.assign(new EventTarget(), { controller: null as Worker | null });
  const registration = Object.assign(new EventTarget(), { waiting: new Worker(), installing: null });
  let notices = 0;
  const stop = observeUpdates(registration, container, () => { notices++; }, () => { notices++; });
  container.controller = registration.waiting;
  container.dispatchEvent(new Event("controllerchange"));
  assert.equal(notices, 0);
  stop();
});

test("old workers that do not understand the message time out instead of reloading", async () => {
  const container = Object.assign(new EventTarget(), { controller: new Worker() });
  await assert.rejects(activateUpdate(container, new Worker(), 5), /timed out/);
});
