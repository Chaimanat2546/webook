import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseProvisionArguments } from "../scripts/central-user-manager/provisioning/config.mjs";
import {
  readCanonicalTenantToken,
  readTenantToken,
} from "../scripts/central-user-manager/provisioning/token-input.mjs";
import {
  buildTargetBuildEnvironment,
  buildTargetChildEnvironment,
  installTargetTokenAndDeploy,
  sanitizeTargetCompiledEnvironment,
  validateTargetRepository,
  verifyCloudflareTarget,
} from "../scripts/central-user-manager/provisioning/target-deploy.mjs";
import { fetchAuthAttestation } from "../scripts/central-user-manager/provisioning/attestation.mjs";
import { provisionTenant } from "../scripts/central-user-manager/provision-tenant.mjs";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATOR_UID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const TARGET_REPO = "C:\\work\\tenant-agent";

const requiredArguments = [
  "--tenant-id", TENANT_ID,
  "--display-name", "Tenant One",
  "--target-project-ref", "abcdefghijklmnopqrst",
  "--agent-origin", "https://agent.example.com",
  "--wrangler-environment", "production",
  "--target-repo", TARGET_REPO,
  "--operator-uid", OPERATOR_UID,
  "--agent-version", "1.0.0",
  "--schema-version", "1.0.0",
  "--cloudflare-account-id", "a".repeat(32),
  "--worker-name", "tenant-worker",
];

describe("Central User Manager provisioning", () => {
  it("defaults to a validation-only dry run and rejects token argv input", () => {
    const config = parseProvisionArguments(requiredArguments, {
      resolveTargetRepo: (value: string) => value,
    });
    assert.equal(config.apply, false);
    assert.equal(config.mode, "onboard");
    assert.throws(
      () => parseProvisionArguments([...requiredArguments, "--token", TOKEN]),
      /invalid provisioning arguments/i,
    );
    assert.throws(
      () => parseProvisionArguments([...requiredArguments, "--bearer-token", TOKEN]),
      /invalid provisioning arguments/i,
    );
    assert.throws(
      () => parseProvisionArguments([
        ...requiredArguments,
        "--rotate",
        "--expected-token-version",
        "0",
      ], {
        resolveTargetRepo: (value: string) => value,
      }),
      /invalid provisioning arguments/i,
    );
  });

  it("accepts only an exact canonical 256-bit token from bounded input", () => {
    assert.equal(readCanonicalTenantToken(`${TOKEN}\r\n`), TOKEN);
    assert.throws(() => readCanonicalTenantToken("A".repeat(42)), /invalid tenant token/i);
    assert.throws(() => readCanonicalTenantToken(`${TOKEN} extra`), /invalid tenant token/i);
    assert.throws(() => readCanonicalTenantToken("A".repeat(5000)), /invalid tenant token/i);
  });

  it("finishes hidden TTY entry on carriage return without echoing the token", async () => {
    class FakeTty extends EventEmitter {
      isTTY = true;
      rawModes: boolean[] = [];
      setEncoding() {}
      setRawMode(value: boolean) { this.rawModes.push(value); }
      resume() {}
      pause() {}
    }
    const stdin = new FakeTty();
    let prompt = "";
    const reading = readTenantToken({
      stdin: stdin as never,
      stderr: {
        write(value: string) {
          prompt += value;
          return true;
        },
      } as never,
    });
    queueMicrotask(() => stdin.emit("data", `${TOKEN}\r`));
    assert.equal(await reading, TOKEN);
    assert.deepEqual(stdin.rawModes, [true, false]);
    assert.equal(prompt.includes(TOKEN), false);
  });

  it("pipes the token only to target Wrangler stdin and never deploys webook", async () => {
    const calls: Array<{
      command: string;
      args: string[];
      input?: string;
      cwd: string;
      env?: Record<string, string>;
    }> = [];
    await installTargetTokenAndDeploy(
      {
        targetRepo: TARGET_REPO,
        wranglerEnvironment: "production",
        cloudflareAccountId: "a".repeat(32),
      },
      TOKEN,
      {
        environment: {
          NODE_ENV: "test",
          CLOUDFLARE_API_TOKEN: "cloudflare-only",
          CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
          SUPABASE_PUBLISHABLE_KEY: "target-server-publishable-key",
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY:
            "target-publishable-key",
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "target-turnstile-site-key",
          SUPABASE_SERVICE_ROLE_KEY: "central-secret",
        },
        resolveTool: (_repo: string, tool: string) => `${TARGET_REPO}\\${tool}`,
        run: async (
          command: string,
          args: string[],
          options: {
            input?: string;
            cwd: string;
            env?: Record<string, string>;
          },
        ) => {
          calls.push({
            command,
            args,
            input: options.input,
            cwd: options.cwd,
            env: options.env,
          });
        },
        sanitizeCompiledEnvironment: async () => {},
      },
    );
    assert.equal(calls.length, 3);
    assert.equal(calls[0]?.input, `${TOKEN}\n`);
    assert.equal(calls.slice(1).every((call) => call.input === undefined), true);
    assert.equal(calls.every((call) => call.cwd === TARGET_REPO), true);
    assert.equal(JSON.stringify(calls.map((call) => call.args)).includes(TOKEN), false);
    assert.equal(JSON.stringify(calls).includes("webook"), false);
    assert.equal(calls[0]?.env?.CLOUDFLARE_API_TOKEN, "cloudflare-only");
    assert.equal(calls[1]?.env?.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(calls[2]?.env?.CLOUDFLARE_API_TOKEN, "cloudflare-only");
    assert.equal(calls.every((call) => !("SUPABASE_SERVICE_ROLE_KEY" in (call.env ?? {}))), true);
  });

  it("does not expose central credentials to target child processes", () => {
    const child = buildTargetChildEnvironment(
      {
        NODE_ENV: "test",
        PATH: "safe-path",
        SystemRoot: "safe-root",
        CLOUDFLARE_API_TOKEN: "cloudflare-only",
        CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
        SUPABASE_SERVICE_ROLE_KEY: "central-service-secret",
        SUPABASE_ACCESS_TOKEN: "central-management-secret",
        CENTRAL_USER_MANAGER_TOKEN_KEK: "central-kek-secret",
      },
      "a".repeat(32),
    );
    assert.equal(child.PATH, "safe-path");
    assert.equal(child.CLOUDFLARE_API_TOKEN, "cloudflare-only");
    assert.equal(child.CLOUDFLARE_ACCOUNT_ID, "a".repeat(32));
    assert.equal("SUPABASE_SERVICE_ROLE_KEY" in child, false);
    assert.equal("SUPABASE_ACCESS_TOKEN" in child, false);
    assert.equal("CENTRAL_USER_MANAGER_TOKEN_KEK" in child, false);
    const build = buildTargetBuildEnvironment({
      NODE_ENV: "test",
      PATH: "safe-path",
      CLOUDFLARE_API_TOKEN: "cloudflare-only",
      NEXT_PUBLIC_SITE_URL: "https://central.example.com",
      NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL:
        "https://centralprojectref.supabase.co",
      NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY:
        "target-publishable-key",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "target-turnstile-site-key",
      SUPABASE_PUBLISHABLE_KEY: "target-server-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "central-service-secret",
      SUPABASE_ACCESS_TOKEN: "central-management-secret",
      CENTRAL_USER_MANAGER_TOKEN_KEK: "central-kek-secret",
    }, {
      agentOrigin: "https://tenant-agent.example.com",
      targetSupabaseProjectRef: "abcdefghijklmnopqrst",
    });
    assert.equal(build.PATH, "safe-path");
    assert.equal(
      build.NEXT_PUBLIC_SITE_URL,
      "https://tenant-agent.example.com",
    );
    assert.equal(
      build.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL,
      "https://abcdefghijklmnopqrst.supabase.co",
    );
    assert.equal(
      build.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY,
      "target-publishable-key",
    );
    assert.equal(
      build.SUPABASE_PUBLISHABLE_KEY,
      "target-server-publishable-key",
    );
    assert.equal("CLOUDFLARE_API_TOKEN" in build, false);
    assert.equal("SUPABASE_SERVICE_ROLE_KEY" in build, false);
    assert.equal("SUPABASE_ACCESS_TOKEN" in build, false);
    assert.equal("CENTRAL_USER_MANAGER_TOKEN_KEK" in build, false);
  });

  it("fails closed instead of loading missing target public values from a default env file", () => {
    assert.throws(
      () =>
        buildTargetBuildEnvironment(
          {
            NODE_ENV: "test",
            PATH: "safe-path",
            NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY:
              "target-publishable-key",
          },
          {
            agentOrigin: "https://tenant-agent.example.com",
            targetSupabaseProjectRef: "abcdefghijklmnopqrst",
          },
        ),
      /Target deployment failed at target_build_environment/,
    );
  });

  it("replaces OpenNext env fallbacks with public staging values only", async () => {
    const target = await mkdtemp(join(tmpdir(), "cum-env-isolation-"));
    const compiledDirectory = join(target, ".open-next", "cloudflare");
    const compiledPath = join(compiledDirectory, "next-env.mjs");
    const productionSecret = "production-secret-must-not-survive";
    try {
      await mkdir(compiledDirectory, { recursive: true });
      await writeFile(
        compiledPath,
        `export const production = ${JSON.stringify({
          CALENDAR_INTERNAL_API_TOKEN: productionSecret,
          NEXT_PUBLIC_SITE_URL: "https://production.example.com",
        })};\n`,
        "utf8",
      );

      await sanitizeTargetCompiledEnvironment(
        { targetRepo: target },
        {
          NEXT_PUBLIC_SITE_URL: "https://staging.example.com",
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL:
            "https://abcdefghijklmnopqrst.supabase.co",
          NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY:
            "staging-public-key",
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "staging-site-key",
          SUPABASE_SERVICE_ROLE_KEY: "central-secret",
        },
      );

      const compiled = await readFile(compiledPath, "utf8");
      assert.equal(compiled.includes(productionSecret), false);
      assert.equal(compiled.includes("CALENDAR_INTERNAL_API_TOKEN"), false);
      assert.equal(compiled.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
      assert.equal(compiled.includes("https://staging.example.com"), true);
      assert.equal(compiled.includes("staging-public-key"), true);
      assert.equal(
        (compiled.match(/export const (?:production|development|test) =/g) ?? [])
          .length,
        3,
      );
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });

  it("binds the target account and worker before secret mutation", async () => {
    const requests: string[] = [];
    await verifyCloudflareTarget(
      { cloudflareAccountId: "a".repeat(32), workerName: "tenant-worker" },
      { NODE_ENV: "test", CLOUDFLARE_API_TOKEN: "cloudflare-only" },
      {
        fetch: async (url: string) => {
          requests.push(url);
          return new Response("", { status: 200 });
        },
      },
    );
    assert.deepEqual(requests, [
      `https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/workers/scripts/tenant-worker`,
    ]);
  });

  it("returns the exact embedded target attestation for provisioning reuse", async () => {
    const target = await mkdtemp(join(tmpdir(), "cum-target-"));
    const attestation = {
      version: "v1",
      digest: "a".repeat(64),
      checkedAt: "2026-07-30T00:00:00.000Z",
    };
    try {
      await mkdir(
        join(target, "app", "(admin)", "api", "internal", "central-user-manager", "v1", "health"),
        { recursive: true },
      );
      await mkdir(
        join(target, "app", "(admin)", "api", "internal", "central-user-manager", "v1", "operations"),
        { recursive: true },
      );
      await writeFile(join(target, "package.json"), JSON.stringify({ name: "tenant-agent" }));
      await writeFile(
        join(target, "app", "(admin)", "api", "internal", "central-user-manager", "v1", "health", "route.ts"),
        "",
      );
      await writeFile(
        join(target, "app", "(admin)", "api", "internal", "central-user-manager", "v1", "operations", "route.ts"),
        "",
      );
      await writeFile(
        join(target, "wrangler.jsonc"),
        JSON.stringify({
          env: {
            staging: {
              name: "tenant-worker",
              vars: {
                CENTRAL_USER_MANAGER_AGENT_ENABLED: "true",
                CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED: "true",
                CENTRAL_USER_MANAGER_TENANT_ID: TENANT_ID,
                CENTRAL_USER_MANAGER_PROJECT_REF: "abcdefghijklmnopqrst",
                CENTRAL_USER_MANAGER_AGENT_VERSION: "1.0.0",
                CENTRAL_USER_MANAGER_SCHEMA_VERSION: "1.0.0",
                CENTRAL_USER_MANAGER_TOKEN_VERSION: "1",
                CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION: attestation.version,
                CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST: attestation.digest,
                CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT: attestation.checkedAt,
              },
            },
          },
        }),
      );
      const result = await validateTargetRepository({
        targetRepo: target,
        wranglerEnvironment: "staging",
        workerName: "tenant-worker",
        tenantId: TENANT_ID,
        targetSupabaseProjectRef: "abcdefghijklmnopqrst",
        expectedAgentVersion: "1.0.0",
        expectedSchemaVersion: "1.0.0",
        nextTokenVersion: 1,
      });
      assert.deepEqual(result, attestation);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });

  it("requires the exact approved Supabase Auth policy and binds every field", async () => {
    const response = {
      disable_signup: true,
      external_anonymous_users_enabled: false,
      password_min_length: 8,
      password_required_characters:
        "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~",
      password_hibp_enabled: true,
      security_update_password_require_reauthentication: false,
    };
    const attestation = await fetchAuthAttestation(
      "abcdefghijklmnopqrst",
      { NODE_ENV: "test", SUPABASE_ACCESS_TOKEN: "management-only" },
      {
        clock: () => new Date("2026-07-30T00:00:00.000Z"),
        fetch: async () => new Response(JSON.stringify(response), { status: 200 }),
      },
    );
    assert.match(attestation.digest, /^[0-9a-f]{64}$/);
    await assert.rejects(
      () => fetchAuthAttestation(
        "abcdefghijklmnopqrst",
        { NODE_ENV: "test", SUPABASE_ACCESS_TOKEN: "management-only" },
        {
          clock: () => new Date("2026-07-30T00:00:00.000Z"),
          fetch: async () => new Response(
            JSON.stringify({ ...response, password_min_length: 9 }),
            { status: 200 },
          ),
        },
      ),
      /attestation failed/i,
    );
  });

  it("runs onboarding in the fail-closed order and activates only after both checks", async () => {
    const steps: string[] = [];
    const embeddedAttestation = {
      version: "v1",
      digest: "a".repeat(64),
      checkedAt: "2026-07-30T00:00:00.000Z",
    };
    const config = { ...parseProvisionArguments([...requiredArguments, "--apply"], {
      resolveTargetRepo: (value: string) => value,
    }), apply: true };
    await provisionTenant(config, {
      readToken: async () => TOKEN,
      prepare: async () => ({ phase: "new", attestation: null, token: null }),
      readTargetAttestation: async () => {
        steps.push("target-attestation");
        return embeddedAttestation;
      },
      attest: async (_project: string, expected: unknown) => {
        steps.push("attest");
        assert.deepEqual(expected, embeddedAttestation);
        return embeddedAttestation;
      },
      verifyOperator: async () => steps.push("operator"),
      registerInactive: async () => steps.push("register"),
      installTargetSecret: async () => steps.push("target-secret"),
      storeEncryptedToken: async () => steps.push("central-token"),
      deployTarget: async () => steps.push("target-deploy"),
      checkHealth: async () => {
        steps.push("health");
        return true;
      },
      checkListUsers: async () => {
        steps.push("list");
        return true;
      },
      activate: async () => steps.push("activate"),
    });
    assert.deepEqual(steps, [
      "operator",
      "target-attestation",
      "attest",
      "register",
      "target-secret",
      "central-token",
      "target-deploy",
      "health",
      "list",
      "activate",
    ]);
  });

  it("performs no mutation in dry run and leaves the Tenant inactive on verification failure", async () => {
    let calls = 0;
    const dependencies = {
      readToken: async () => { calls += 1; return TOKEN; },
      prepare: async () => ({ phase: "new", attestation: null, token: null }),
      readTargetAttestation: async () => {
        calls += 1;
        return {
          version: "v1",
          digest: "a".repeat(64),
          checkedAt: "2026-07-30T00:00:00.000Z",
        };
      },
      attest: async () => { calls += 1; return {}; },
      verifyOperator: async () => { calls += 1; },
      registerInactive: async () => { calls += 1; },
      installTargetSecret: async () => { calls += 1; },
      storeEncryptedToken: async () => { calls += 1; },
      deployTarget: async () => { calls += 1; },
      checkHealth: async () => false,
      checkListUsers: async () => true,
      activate: async () => { calls += 100; },
    };
    const dryRun = parseProvisionArguments(requiredArguments, {
      resolveTargetRepo: (value: string) => value,
    });
    await provisionTenant(dryRun, dependencies);
    assert.equal(calls, 0);

    const apply = { ...dryRun, apply: true };
    await assert.rejects(() => provisionTenant(apply, dependencies), /provisioning failed/i);
    assert.equal(calls < 100, true);
  });

  it("gates and quarantines rotation before reading or installing the next token", async () => {
    const steps: string[] = [];
    const config = parseProvisionArguments([
      ...requiredArguments,
      "--rotate",
      "--expected-token-version",
      "7",
      "--apply",
    ], { resolveTargetRepo: (value: string) => value });
    await provisionTenant(config, {
      verifyOperator: async () => steps.push("operator"),
      prepare: async () => {
        steps.push("prepare-rotation");
        return {
          phase: "active_expected",
          attestation: { version: "v1", digest: "a".repeat(64), checkedAt: "2026-07-30T00:00:00.000Z" },
          token: null,
        };
      },
      attest: async () => {
        steps.push("attest");
        return { version: "v1", digest: "a".repeat(64), checkedAt: "2026-07-30T00:00:00.000Z" };
      },
      beginRotation: async () => steps.push("rotation-gate"),
      readToken: async () => {
        steps.push("read-token");
        return TOKEN;
      },
      installTargetSecret: async () => steps.push("target-secret"),
      storeEncryptedToken: async () => steps.push("central-token"),
      deployTarget: async () => steps.push("target-deploy"),
      checkHealth: async () => true,
      checkListUsers: async () => true,
      activate: async () => steps.push("activate"),
    });
    assert.deepEqual(steps.slice(0, 5), [
      "operator",
      "prepare-rotation",
      "attest",
      "rotation-gate",
      "read-token",
    ]);
  });

  it("resumes an inactive stored version without rotating or requesting the token again", async () => {
    const steps: string[] = [];
    const config = parseProvisionArguments([...requiredArguments, "--apply"], {
      resolveTargetRepo: (value: string) => value,
    });
    await provisionTenant(config, {
      verifyOperator: async () => {},
      prepare: async () => ({
        phase: "stored",
        attestation: { version: "v1", digest: "a".repeat(64), checkedAt: "2026-07-30T00:00:00.000Z" },
        token: TOKEN,
      }),
      attest: async (_project: string, expected: unknown) => expected,
      registerInactive: async () => steps.push("register"),
      readToken: async () => steps.push("read-token") as never,
      installTargetSecret: async () => steps.push("target-secret"),
      storeEncryptedToken: async () => steps.push("central-token"),
      deployTarget: async () => steps.push("target-deploy"),
      checkHealth: async () => true,
      checkListUsers: async () => true,
      activate: async () => steps.push("activate"),
    });
    assert.deepEqual(steps, ["target-secret", "target-deploy", "activate"]);
  });

  it("treats an exact completed phase as success without repeating target mutations", async () => {
    const steps: string[] = [];
    const config = parseProvisionArguments([...requiredArguments, "--apply"], {
      resolveTargetRepo: (value: string) => value,
    });
    const result = await provisionTenant(config, {
      verifyOperator: async () => steps.push("operator"),
      prepare: async () => ({
        phase: "completed",
        attestation: {
          version: "v1",
          digest: "a".repeat(64),
          checkedAt: "2026-07-30T00:00:00.000Z",
        },
        token: null,
      }),
      attest: async (_project: string, expected: unknown) => {
        steps.push("attest");
        return expected;
      },
      readToken: async () => steps.push("read-token") as never,
      installTargetSecret: async () => steps.push("target-secret"),
      deployTarget: async () => steps.push("target-deploy"),
      checkHealth: async () => true,
      checkListUsers: async () => true,
      activate: async () => steps.push("activate"),
    });
    assert.deepEqual(steps, ["operator", "attest"]);
    assert.deepEqual(result, { applied: true, mode: "onboard" });
  });

  it("adds an atomic rotation gate before any target token change", () => {
    const migrations = readFileSync(
      new URL("../supabase/migrations/20260730063310_central_user_manager_token_rotation_gate.sql", import.meta.url),
      "utf8",
    );
    assert.match(migrations, /begin_customer_project_token_rotation/);
    assert.match(migrations, /for update/);
    assert.match(migrations, /p_expected_token_version/);
    assert.match(migrations, /is_active = true/);
    assert.match(migrations, /for share/);
    assert.match(migrations, /remainingDispatchableCount/);
    assert.match(migrations, /status = 'quarantined'/);
    assert.match(migrations, /status = 'failed_safe'/);
    assert.match(migrations, /central_user_audit_events/);
    assert.match(migrations, /require_central_user_service_role/);
    assert.match(migrations, /provisioning_state = 'rotation_gated'/);
    assert.match(migrations, /provisioning_state = 'token_stored'/);
    assert.match(migrations, /provisioning_state = 'completed'/);
  });

  it("stores and activates provisioning state with its audit event atomically", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/20260730063310_central_user_manager_token_rotation_gate.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(
      migration,
      /private\.store_customer_project_bearer_for_provisioning[\s\S]*private\.rotate_customer_project_bearer[\s\S]*'rotate_token'/i,
    );
    assert.match(
      migration,
      /private\.activate_customer_project_for_provisioning[\s\S]*private\.activate_customer_project[\s\S]*'activate_project'/i,
    );
    assert.match(
      migration,
      /grant execute on function public\.store_customer_project_bearer_for_provisioning[\s\S]*to service_role/i,
    );
    assert.match(
      migration,
      /grant execute on function public\.activate_customer_project_for_provisioning[\s\S]*to service_role/i,
    );
    assert.match(
      migration,
      /revoke all on function public\.rotate_customer_project_bearer[\s\S]*from public, anon, authenticated, service_role/i,
    );
    assert.match(
      migration,
      /revoke all on function public\.activate_customer_project\(uuid, integer\)[\s\S]*from public, anon, authenticated, service_role/i,
    );
    assert.match(
      migration,
      /revoke all on function public\.register_customer_project\([\s\S]*timestamp with time zone[\s\S]*from public, anon, authenticated, service_role/i,
    );
  });
});
