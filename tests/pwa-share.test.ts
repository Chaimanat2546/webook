import assert from "node:assert/strict";
import { test } from "node:test";
import { shareLink } from "../lib/pwa/share.ts";

const link = { title: "ใบเสนอราคา", url: "https://example.test/q/existing-token" };

test("native sharing sends the existing link and does not also copy it", async () => {
  let shared: unknown;
  let copies = 0;
  const result = await shareLink(link, {
    share: async (value) => { shared = value; },
    copy: async () => { copies += 1; },
  });
  assert.equal(result, "shared");
  assert.deepEqual(shared, link);
  assert.equal(copies, 0);
});

test("cancelling native share never copies the link", async () => {
  let copies = 0;
  const result = await shareLink(link, {
    share: async () => { throw new DOMException("Cancelled", "AbortError"); },
    copy: async () => { copies += 1; },
  });
  assert.equal(result, "cancelled");
  assert.equal(copies, 0);
});

test("unsupported native payload uses clipboard with the original URL", async () => {
  let copied = "";
  let shares = 0;
  const result = await shareLink(link, {
    canShare: () => false,
    share: async () => { shares += 1; },
    copy: async (value) => { copied = value; },
  });
  assert.equal(result, "copied");
  assert.equal(copied, "https://example.test/q/existing-token");
  assert.equal(shares, 0);
});

test("clipboard-only browser can copy the link", async () => {
  let copied = "";
  assert.equal(await shareLink(link, { copy: async (value) => { copied = value; } }), "copied");
  assert.equal(copied, link.url);
});

test("share permission failure falls back to clipboard", async () => {
  assert.equal(await shareLink(link, {
    share: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    copy: async () => {},
  }), "copied");
});

test("unavailable or denied clipboard exposes manual-copy outcome", async () => {
  assert.equal(await shareLink(link, {}), "manual");
  assert.equal(await shareLink(link, {
    copy: async () => { throw new Error("Clipboard denied"); },
  }), "manual");
});
