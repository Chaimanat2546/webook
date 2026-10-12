import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation.js";
import { canUseBooking } from "../server/auth/admin.ts";

async function loadEntry(file: string, fixtures: Record<string, unknown>) {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "auth-io", setup(builder) {
    builder.onResolve({ filter: /^\.\/admin$/ }, args => args.importer.replaceAll("\\", "/").endsWith("/server/auth/bookings.ts") ? { path: "fixture-session", external: true } : undefined);
    builder.onResolve({ filter: /(?:server\/auth\/admin|lib\/supabase\/(?:admin|server))$/ }, args => ({ path: args.path.endsWith("auth/admin") ? "fixture-session" : args.path.endsWith("supabase/admin") ? "fixture-admin-client" : "fixture-server-client", external: true }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", bundle.outputFiles[0].text)((name: string) => name in fixtures ? fixtures[name] : name === "server-only" ? {} : require(name), loaded, loaded.exports);
  return loaded.exports;
}

async function expectRedirect(work: () => Promise<unknown>, destination: string) {
  await assert.rejects(async () => await work(), error => error instanceof Error && "digest" in error && String(error.digest).split(";")[2] === destination);
}

test("home uses verified UID booking access rather than email-only permissions", async () => {
  for (const [row, destination] of [
    [{ allow_tools: { allow_booking: true }, role_id: 1 }, "/admin/bookings"],
    [{ allow_tools: { allow_booking: false }, role_id: 1 }, "/admin/houses"],
    [null, "/admin/houses"],
  ] as const) {
    let reads = 0;
    const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/users");
      assert.equal(url.searchParams.get("uid"), "eq.verified-user");
      assert.equal(url.searchParams.has("email"), false);
      reads++;
      return new Response(JSON.stringify(row ? [row] : []), { headers: { "Content-Type": "application/json" } });
    } } });
    const entry = await loadEntry("../app/page.tsx", {
      "fixture-session": { canUseBooking, requireAdmin: async () => ({ user: { id: "verified-user" }, adminUser: { allow_tools: { allow_booking: true } } }) },
      "fixture-admin-client": { createSupabaseAdminClient: () => client },
    });
    await expectRedirect(entry.default as () => Promise<unknown>, destination);
    assert.equal(reads, 1);
  }
});

test("home keeps unauthenticated users at login", async () => {
  const entry = await loadEntry("../app/page.tsx", {
    "fixture-session": { canUseBooking, requireAdmin: async () => redirect("/login") },
    "fixture-admin-client": { createSupabaseAdminClient: () => { assert.fail("must authenticate first"); } },
  });
  await expectRedirect(entry.default as () => Promise<unknown>, "/login");
});

test("successful login enters the permission-aware home and invalid login does not", async () => {
  for (const invalid of [false, true]) {
    const entry = await loadEntry("../app/login/actions.ts", {
      "fixture-admin-client": { createSupabaseAdminClient: () => null },
      "fixture-server-client": { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async (credentials: unknown) => {
        assert.deepEqual(credentials, { email: "test@example.com", password: "test-password" });
        return { error: invalid ? { message: "invalid" } : null };
      } } }) },
    });
    const form = new FormData();
    form.set("identifier", "TEST@example.com");
    form.set("adminCredential", "test-password");
    await expectRedirect(() => (entry.signIn as (form: FormData) => Promise<unknown>)(form), invalid ? "/login?error=invalid" : "/");
  }
});
