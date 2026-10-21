import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const permissions = { canAccessHouses: true, canUseBooking: true, canUseQuotation: true, canUseAccommodation: true, canManageCentralUsers: false, canManageWebookUsers: false };

async function navigation(pathname: string, allowed = permissions) {
  const bundle = await build({ entryPoints: ["components/layout/admin-mobile-navigation.tsx"], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", plugins: [{
    name: "sidebar-fixture",
    setup(builder) { builder.onResolve({ filter: /ui\/sidebar$/ }, () => ({ path: "sidebar-fixture", external: true })); },
  }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => {
    if (id === "next/navigation") return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams("month=2026-10") };
    if (id === "sidebar-fixture") return { useSidebar: () => ({ openMobile: false, setOpenMobile() {} }) };
    return require(id);
  }, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.AdminMobileNavigation as ComponentType<typeof permissions>, allowed));
}

test("overview and booking reports use the same shared mobile menu as other admin pages", async () => {
  const reference = await navigation("/admin/houses");
  const destinations = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  for (const route of ["/admin/dashboard", "/admin/dashboard/bookings", "/admin/dashboard/bookings/9"]) {
    const html = await navigation(route);
    assert.deepEqual(destinations(html), destinations(reference));
    assert.equal((html.match(/<nav /g) ?? []).length, 1);
    assert.match(html, /aria-label="เมนูหลักบนมือถือ"/);
    assert.match(html, /md:hidden print:hidden/);
    assert.match(html, /เพิ่มเติม/);
    if (route.includes("/bookings")) assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/admin\/bookings"/);
  }
});

test("shared dashboard menu preserves permissions and workspace exclusions", async () => {
  const html = await navigation("/admin/dashboard", { ...permissions, canUseQuotation: false, canUseAccommodation: false, canAccessHouses: false });
  assert.match(html, /href="\/admin\/bookings"/);
  assert.doesNotMatch(html, /href="\/admin\/(?:houses|quotations|advertisements)"/);
  assert.equal(await navigation("/admin/houses/9"), "");
});
