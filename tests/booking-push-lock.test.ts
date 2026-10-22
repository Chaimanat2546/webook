import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

test("independent app contexts serialize device mutations through the same browser lock", async () => {
  const bundle = await build({ entryPoints: ["components/admin/notifications/push-device.ts"], bundle: true, write: false, format: "cjs", platform: "browser" });
  let tail = Promise.resolve();
  const names: string[] = [];
  const locks = { async request<T>(name: string, operation: () => Promise<T>) {
    names.push(name);
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  } };
  function context() {
    const loaded: { exports: { withPushDeviceLock?: <T>(operation: () => Promise<T>) => Promise<T> } } = { exports: {} };
    runInNewContext(bundle.outputFiles[0].text, { module: loaded, exports: loaded.exports, navigator: { locks } });
    return loaded.exports.withPushDeviceLock!;
  }
  const pwa = context(), tab = context();
  const calls: string[] = [];
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const first = pwa(async () => { calls.push("subscribe"); await pending; calls.push("registered"); });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const second = tab(async () => { calls.push("unsubscribe"); });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["subscribe"]);
  finish(); await first; await second;
  assert.deepEqual(calls, ["subscribe", "registered", "unsubscribe"]);
  assert.deepEqual(names, ["webook-push-device", "webook-push-device"]);
});
