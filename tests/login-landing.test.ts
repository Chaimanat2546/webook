import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation.js";
import * as adminAuth from "../server/auth/admin.ts";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function loadEntry(file: string, fixtures: Record<string, unknown>) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "auth-io", setup(builder) {
    builder.onResolve({ filter: /^\.\/admin$/ }, args => ["/server/auth/bookings.ts", "/server/auth/dashboard.ts", "/server/auth/admin-navigation.ts"].some(path => args.importer.replaceAll("\\", "/").endsWith(path)) ? { path: "fixture-session", external: true } : undefined);
    builder.onResolve({ filter: /(?:server\/auth\/admin|lib\/supabase\/(?:admin|server))$/ }, args => ({ path: args.path.endsWith("auth/admin") ? "fixture-session" : args.path.endsWith("supabase/admin") ? "fixture-admin-client" : "fixture-server-client", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name in fixtures ? fixtures[name] : name === "fixture-server-client" ? { createSupabaseServerClient: () => assert.fail("unexpected auth client call") } : name === "server-only" ? {} : require(name), loaded, loaded.exports);
  return loaded.exports;
}

async function expectRedirect(work: () => Promise<unknown>, destination: string) {
  await assert.rejects(async () => await work(), error => error instanceof Error && "digest" in error && String(error.digest).split(";")[2] === destination);
}

test("home selects the first authorized module and never assumes house access", async () => {
  for (const [row, destination] of [
    [{ allow_tools: { allow_booking: true }, role_id: 1 }, "/admin/dashboard"],
    [{ allow_tools: { allow_booking: true }, role_id: 2, dv_id: null }, "/admin/bookings"],
    [{ allow_tools: { allow_price: true }, role_id: 2, dv_id: null }, "/admin/houses"],
    [{ allow_tools: { allow_accommodation: true }, role_id: 2, dv_id: null }, "/admin/houses"],
    [{ allow_tools: { allow_quotation: true }, role_id: 2, dv_id: null }, "/admin/quotations"],
    [{ allow_tools: { allow_members: true }, role_id: 2, dv_id: null }, "/admin/user-manager"],
    [{ allow_tools: {}, role_id: 2, dv_id: 101 }, "/admin/dashboard"],
  ] as const) {
    let reads = 0;
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/users");
      assert.equal(url.searchParams.get("uid"), "eq.verified-user");
      assert.equal(url.searchParams.has("email"), false);
      reads++;
      return new Response(JSON.stringify([row]), { headers: { "Content-Type": "application/json" } });
    } } });
    const entry = await loadEntry("../app/page.tsx", {
      "fixture-session": { ...adminAuth, requireAdmin: async () => ({ user: { id: "verified-user" }, adminUser: row }) },
      "fixture-admin-client": { createSupabaseAdminClient: () => client },
    });
    await expectRedirect(entry.default as () => Promise<unknown>, destination);
    assert.equal(reads, 2);
  }
});

test("home shows an authenticated no-access state instead of redirecting into a forbidden module", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => new Response("[]", { headers: { "Content-Type": "application/json" } }) } });
  const entry = await loadEntry("../app/page.tsx", {
    "fixture-session": { ...adminAuth, requireAdmin: async () => ({ user: { id: "verified-user" }, adminUser: null }) },
    "fixture-admin-client": { createSupabaseAdminClient: () => client },
  });
  const result = await (entry.default as () => Promise<unknown>)();
  assert.ok(isValidElement(result));
  const html = renderToStaticMarkup(result);
  assert.match(html, /บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน/);
  assert.match(html, /ออกจากระบบ/);
  assert.deepEqual([...html.matchAll(/href="(\/admin[^"]*)"/g)].map(match=>match[1]), ["/admin/login-history"]);
});

test("module entry redirects forbidden links to the permission-aware home", async () => {
  const row = { role_id: 2, dv_id: null, allow_tools: { allow_quotation: true } };
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => new Response(JSON.stringify([row]), { headers: { "Content-Type": "application/json" } }) } });
  const entry = await loadEntry("../server/auth/admin-navigation.ts", {
    "fixture-session": { ...adminAuth, requireAdmin: async () => ({ user: { id: "verified-user" }, adminUser: row }) },
    "fixture-admin-client": { createSupabaseAdminClient: () => client },
  });
  const guard = entry.requireAdminModule as (module: string) => Promise<void>;
  await guard("quotations");
  for (const moduleId of ["overview", "bookings", "houses", "advertisements", "centralUsers", "webookUsers"]) await expectRedirect(() => guard(moduleId), "/");
});

test("an email-only booking flag cannot grant verified booking-module access", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async () => new Response("[]", { headers: { "Content-Type": "application/json" } }) } });
  const entry = await loadEntry("../server/auth/admin-navigation.ts", {
    "fixture-session": { ...adminAuth, requireAdmin: async () => ({ user: { id: "verified-user" }, adminUser: { role_id: 2, allow_tools: { allow_booking: true } } }) },
    "fixture-admin-client": { createSupabaseAdminClient: () => client },
  });
  const permissions = await (entry.getAdminNavigationPermissions as () => Promise<{ canUseBooking: boolean }>)();
  assert.equal(permissions.canUseBooking, false);
  await expectRedirect(() => (entry.requireAdminModule as (module: string) => Promise<void>)("bookings"), "/");
});

test("home keeps unauthenticated users at login", async () => {
  const entry = await loadEntry("../app/page.tsx", {
    "fixture-session": { ...adminAuth, requireAdmin: async () => redirect("/login") },
    "fixture-admin-client": { createSupabaseAdminClient: () => { assert.fail("must authenticate first"); } },
  });
  await expectRedirect(entry.default as () => Promise<unknown>, "/login");
});

test("successful login enters the permission-aware home and invalid login does not", async () => {
  for (const invalid of [false, true]) {
    const entry = await loadEntry("../app/login/actions.ts", {
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "fixture-admin-client": { createSupabaseAdminClient: () => null },
      "fixture-server-client": { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async (credentials: unknown) => {
        assert.deepEqual(credentials, { email: "test@example.com", password: "test-password" });
        return { data: { user: invalid ? null : { id: "signed-in-user" } }, error: invalid ? { message: "invalid" } : null };
      } } }) },
    });
    const form = new FormData();
    form.set("identifier", "TEST@example.com");
    form.set("adminCredential", "test-password");
    await expectRedirect(() => (entry.signIn as (form: FormData) => Promise<unknown>)(form), invalid ? "/login?error=invalid" : "/");
  }
});

test("login retires only the previous browser binding on a successful account switch", async () => {
  for (const invalid of [false, true]) {
    let retired = 0, cleared = 0;
    const subscriptionId = "00000000-0000-4000-8000-000000000001";
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/rest/v1/rpc/booking_push_unsubscribe");
      assert.deepEqual(JSON.parse(String(init?.body)), { p_actor: "previous-auth-user", p_endpoint: null, p_subscription: subscriptionId });
      retired++;
      return new Response("true", { headers: { "Content-Type": "application/json" } });
    } } });
    const entry = await loadEntry("../app/login/actions.ts", {
      "next/headers": { cookies: async () => ({ get: () => ({ value: subscriptionId }), delete: (name: string) => { assert.equal(name, "webook_push_subscription"); cleared++; } }) },
      "fixture-admin-client": { createSupabaseAdminClient: () => client },
      "fixture-server-client": { createSupabaseServerClient: async () => ({ auth: {
        getUser: async () => ({ data: { user: { id: "previous-auth-user" } } }),
        signInWithPassword: async () => ({ data: { user: invalid ? null : { id: "new-user-without-module-access" } }, error: invalid ? { message: "invalid" } : null }),
      } }) },
    });
    const form = new FormData();
    form.set("identifier", "test@example.com"); form.set("adminCredential", "password");
    await expectRedirect(() => (entry.signIn as (input: FormData) => Promise<unknown>)(form), invalid ? "/login?error=invalid" : "/");
    assert.equal(retired, invalid ? 0 : 1);
    assert.equal(cleared, invalid ? 0 : 1);
  }
});
