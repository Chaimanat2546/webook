import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyMetrics } from "../lib/website-analytics.ts";

async function siteSummarySkeleton() {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary-skeleton.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  return loaded.exports.WebsiteSiteSummarySkeleton as ComponentType<Record<string, unknown>>;
}

test("website summary preserves selected site/month and distinguishes failure from zero", async () => {
  const bundle = await build({ entryPoints: ["components/admin/dashboard/website-analytics/site-summary.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Component = loaded.exports.WebsiteSiteSummary as ComponentType<Record<string, unknown>>;
  const sites = ["partial", "unavailable", "not_configured"].map((status, index) => ({ key: `site${index}`, displayName: `Website ${index}`, origin: `https://site${index}.test`, status, coverage: null, totals: index === 0 ? { ...emptyMetrics(), page_views: 123 } : null }));
  const html = renderToStaticMarkup(createElement(Component, { sites, month: "2026-10" }));
  for (const value of ["โหลดสำเร็จ", "โหลดไม่ได้", "ยังไม่ได้ตั้งค่า", "123", "site0.test", "month=2026-10&amp;site=site0", "month=2026-10&amp;site=site1"]) assert.ok(html.includes(value), value);
  // Both responsive layouts preserve unavailable values rather than reporting zero.
  assert.equal((html.match(/—/g) ?? []).length, 24);
  assert.equal((html.match(/<details/g) ?? []).length, sites.length);
  assert.ok(html.includes('aria-label="สถิติแยกเว็บไซต์บนมือถือ"'));
  for (const site of sites) {
    assert.ok(html.includes(`ช่องทางติดต่อ<span class="sr-only"> ${site.displayName}</span>`));
  }
  assert.ok(!html.includes("ข้อมูลไม่ครบ"));
});

test("dashboard uses a shaped loading skeleton for the website summary", () => {
  const source = readFileSync(new URL("../app/admin/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(source, /fallback={<WebsiteSiteSummarySkeleton/);
});

test("website summary skeleton reserves the responsive eight-column table", async () => {
  const html = renderToStaticMarkup(createElement(await siteSummarySkeleton()));

  assert.match(html, /data-loading-section="analytics-loading-site-summary"/);
  assert.match(html, /role="status"/);
  assert.match(html, /กำลังโหลดสถิติแยกเว็บไซต์/);
  assert.match(html, /data-loading-site-summary-desktop/);
  assert.equal((html.match(/data-loading-site-summary-column/g) ?? []).length, 40);
});
