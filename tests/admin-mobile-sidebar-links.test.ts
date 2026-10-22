import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import type { MobileNavigationPermissions } from "../lib/mobile-navigation.ts";

const none: MobileNavigationPermissions = { canUseDashboard: false, canUseBooking: false, canAccessHouses: false, canUseAccommodation: false, canUseQuotation: false, canManageCentralUsers: false, canManageWebookUsers: false };

async function sidebar(permissions: MobileNavigationPermissions, pathname: string) {
  const bundle = await build({ entryPoints: ["components/layout/admin-mobile-sidebar-links.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "sidebar-fixture", setup(builder) { builder.onResolve({ filter: /ui\/sidebar$/ }, () => ({ path: "sidebar-fixture", external: true })); } }] });
  const loaded = { exports: {} as Record<string, unknown> }, require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((id: string) => {
    if (id === "sidebar-fixture") return { SidebarMenuItem: ({ children }: { children: ReactNode }) => createElement("li", null, children), SidebarMenuButton: ({ children }: { children: ReactNode }) => createElement("div", null, children) };
    return require(id);
  }, loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.AdminMobileSidebarLinks as ComponentType<Record<string, unknown>>, { permissions, pathname, onNavigate() {} }));
}

test("a quotation-only user can return from customers despite having no dock", async () => {
  const html = await sidebar({ ...none, canUseQuotation: true }, "/admin/quotations/customers");
  assert.match(html, /href="\/admin\/quotations"/);
  assert.match(html, /href="\/admin\/quotations\/customers"/);
  assert.doesNotMatch(html, /href="\/admin\/(?:users|user-manager|houses|bookings)"/);
});

test("mobile hamburger contains overflow in priority order and keeps user modules separate", async () => {
  const all = Object.fromEntries(Object.keys(none).map(key => [key, true])) as unknown as MobileNavigationPermissions;
  const html = await sidebar(all, "/admin/advertisements");
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(links, ["/admin/advertisements", "/admin/quotations", "/admin/user-manager", "/admin/users", "/admin/quotations/customers"]);
  assert.equal(await sidebar(none, "/admin/dashboard"), "");
});
