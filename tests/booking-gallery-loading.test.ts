import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function loadComponent(file: string, name: string) {
  const output = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false,
    format: "cjs", platform: "node", packages: "external", loader: { ".css": "empty" } });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string, unknown>>;
}

test("loading house card keeps status visible and replaces dates with an accessible skeleton", async () => {
  const Card = await loadComponent("../components/admin/bookings/booking-gallery-card.tsx", "BookingGalleryCard");
  for (const [active, label] of [[true, "เปิดใช้งาน"], [false, "ปิดใช้งาน"], [null, "ไม่ทราบสถานะ"]] as const) {
    const html = renderToStaticMarkup(createElement(Card, { house: { id: "listing-2", property_id: "2", title: "บ้านสอง", is_active: active },
      card: null, month: "2026-09", today: "2026-09-01", loading: true, error: "" }));
    assert.ok(html.includes(label));
    assert.ok(html.includes('aria-busy="true"'));
    assert.ok(html.includes('role="status"'));
    assert.equal((html.match(/data-slot="skeleton"/g) ?? []).length, 50);
    assert.ok(html.includes("motion-reduce:animate-none"));
  }
});

test("gallery page skeleton reserves six cards without interactive fake dates", async () => {
  const Skeleton = await loadComponent("../components/admin/bookings/booking-gallery-skeleton.tsx", "BookingGallerySkeleton");
  const html = renderToStaticMarkup(createElement(Skeleton));
  assert.equal((html.match(/data-slot="card"/g) ?? []).length, 6);
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes("grid-cols-1"));
  assert.ok(html.includes("xl:grid-cols-3"));
  assert.ok(!html.includes("<button"));
});
