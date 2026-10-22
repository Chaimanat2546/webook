import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";

interface Element { props?: { children?: unknown; onClick?: () => void }; }
async function mount(options: { offlineConfig?: boolean; failedDisable?: boolean; initialOff?: boolean } = {}) {
  const actor = "00000000-0000-4000-8000-000000000001";
  const states: unknown[] = [];
  const effectSlots: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  const pending: Array<() => void> = [];
  const writes: unknown[] = [];
  let index = 0, effectIndex = 0, dirty = false, refreshes = 0;
  let marker: string | null = options.initialOff ? null : actor;
  let revision: string | null = null;
  let exists = !options.initialOff;
  let tree: unknown;
  let finish!: (value: { ok: boolean }) => void;
  let finishDisable!: () => void;
  const disableResult = new Promise<void>((resolve) => { finishDisable = resolve; });
  const result = new Promise<{ ok: boolean }>((resolve) => { finish = resolve; });
  const bundle = await build({ entryPoints: ["components/admin/notifications/push-settings.tsx"], bundle: true, write: false, platform: "browser", format: "cjs", packages: "external", plugins: [{ name: "settings-boundaries", setup(builder) {
    for (const [pattern, path] of [[/notifications\/actions$/, "action-fixture"], [/pwa\/pwa-provider$/, "pwa-fixture"], [/notifications-context$/, "context-fixture"], [/ui\/button$/, "button-fixture"]] as const) builder.onResolve({ filter: pattern }, () => ({ path, external: true }));
  } }] });
  const loaded: { exports: { PushSettings?: () => unknown } } = { exports: {} };
  const require = createRequire(import.meta.url);
  const subscription = { endpoint: "https://fcm.googleapis.com/fixture", toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fixture", keys: {} }), unsubscribe: async () => { if (options.failedDisable) { await disableResult; return false; } exists = false; return true; } };
  const manager = { getSubscription: async () => exists ? subscription : null, subscribe: async () => { exists = true; return subscription; } };
  runInNewContext(bundle.outputFiles[0].text, {
    module: loaded, exports: loaded.exports, setTimeout, clearTimeout, atob,
    require(name: string) {
      if (name === "react") return {
        useState(initial: unknown) { const current = index++; if (!(current in states)) states[current] = initial; return [states[current], (value: unknown) => { const next = typeof value === "function" ? value(states[current]) : value; if (!Object.is(next, states[current])) { states[current] = next; dirty = true; } }]; },
        useEffect(effect: () => void | (() => void), deps: unknown[]) { const slot = effectIndex++; const old = effectSlots[slot]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) pending.push(() => { old?.cleanup?.(); const cleanup = effect(); effectSlots[slot] = { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined }; }); },
        useRef(value: unknown) { return { current: value }; },
      };
      if (name === "sonner") return { toast: { success() {}, error() {} } };
      if (name === "action-fixture") return { subscribePush: async (...args: unknown[]) => { writes.push(args); return await result; }, unsubscribePush: async () => ({ ok: !options.failedDisable }) };
      if (name === "pwa-fixture") return { usePwa: () => ({ installed: true }) };
      if (name === "context-fixture") return { useNotifications: () => ({ actorId: actor, data: options.offlineConfig ? null : { pushPublicKey: "AQ" }, error: options.offlineConfig ? "offline" : null, refresh: async () => { refreshes++; } }) };
      if (name === "button-fixture") return { Button: () => null };
      return require(name);
    },
    window: { isSecureContext: true, Notification: {}, PushManager: {}, addEventListener() {}, removeEventListener() {} },
    navigator: { userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 1, serviceWorker: {
      getRegistration: async () => ({ pushManager: manager }), ready: Promise.resolve({ pushManager: manager }),
      addEventListener() {}, removeEventListener() {},
    } },
    Notification: { permission: "granted", requestPermission: async () => "granted" }, localStorage: { getItem: (key: string) => key === "webook-push-actor" ? marker : revision, setItem: (key: string, value: string) => { if (key === "webook-push-actor") marker = value; else revision = value; }, removeItem: () => { marker = null; } },
  });
  function render() { index = 0; effectIndex = 0; dirty = false; tree = loaded.exports.PushSettings?.(); for (const effect of pending.splice(0)) effect(); }
  render();
  async function flush() { for (let count = 0; count < 15; count++) { await new Promise<void>((resolve) => setImmediate(resolve)); if (dirty) render(); } }
  function button(label: string): Element | undefined {
    function find(value: unknown): Element | undefined {
      if (Array.isArray(value)) { for (const item of value) { const found = find(item); if (found) return found; } return; }
      if (!value || typeof value !== "object") return;
      const element = value as Element;
      if (element.props?.onClick && element.props.children === label) return element;
      return find(element.props?.children);
    }
    return find(tree);
  }
  return { states, writes, finish, finishDisable, flush, button, refreshes: () => refreshes, revoke: () => { marker = null; revision = "revoked"; }, marker: () => marker, exists: () => exists };
}

test("Push settings waits for server confirmation before reporting an existing device enabled", async () => {
  const state = await mount();
  await state.flush();
  assert.equal(state.states[0], "checking");
  assert.equal(state.writes.length, 1);
  state.finish({ ok: true });
  await state.flush();
  assert.equal(state.states[0], "enabled");
});

test("Push settings reports registration unavailable when local permission exists but server repair fails", async () => {
  const state = await mount();
  state.finish({ ok: false });
  await state.flush();
  assert.equal(state.states[0], "unavailable");
  assert.ok(state.button("ปิดแจ้งเตือนบนอุปกรณ์นี้"), "opt-out stays available during network failure");
});

test("failed opt-out remains cleanup-failed after the busy-state rerender", async () => {
  const state = await mount({ failedDisable: true });
  state.finish({ ok: true }); await state.flush();
  state.button("ปิดแจ้งเตือนบนอุปกรณ์นี้")?.props?.onClick?.();
  await state.flush();
  state.finishDisable();
  await state.flush();
  assert.equal(state.states[0], "cleanup-failed");
});

test("retry reloads missing configuration instead of remaining unavailable", async () => {
  const state = await mount({ offlineConfig: true });
  await state.flush();
  assert.equal(state.states[0], "unavailable");
  state.button("ลองเชื่อมต่ออีกครั้ง")?.props?.onClick?.();
  await state.flush();
  assert.equal(state.refreshes(), 1);
});

test("explicit enable finishing after another context revoked consent cannot restore opt-in", async () => {
  const state = await mount({ initialOff: true });
  await state.flush();
  state.button("เปิดแจ้งเตือนบนอุปกรณ์นี้")?.props?.onClick?.();
  await state.flush();
  assert.equal(state.writes.length, 1);
  state.revoke(); state.finish({ ok: true }); await state.flush();
  assert.equal(state.marker(), null);
  assert.equal(state.exists(), false);
});
