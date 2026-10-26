import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pushConfig } from "../server/notifications/web-push.ts";

const projectRef = "rqizfiayvcbozlzuvbok";
const secretFile = ".env.production-worker-secrets.json";

/** @param {{ GITHUB_ACTIONS?: string; NEXT_PUBLIC_SUPABASE_URL?: string }} environment */
export function assertProductionTarget(directory = process.cwd(), environment = process.env) {
  const target = JSON.parse(readFileSync(join(directory, "wrangler.jsonc"), "utf8"));
  if (environment.GITHUB_ACTIONS !== "true"
    || environment.NEXT_PUBLIC_SUPABASE_URL !== `https://${projectRef}.supabase.co`
    || target.account_id !== "7c1d945e149fc6fad2124176124d8f33" || target.name !== "webook-admin") {
    throw new Error("Production target does not match the approved configuration.");
  }
}

/** @param {import('../server/notifications/web-push.ts').PushBindings & { GITHUB_ACTIONS?: string; NEXT_PUBLIC_SUPABASE_URL?: string }} environment */
export function prepareProductionPushSecrets(directory = process.cwd(), environment = process.env) {
  assertProductionTarget(directory, environment);
  const config = pushConfig(environment);
  if (!config) throw new Error("Production Push configuration is missing or invalid.");
  const path = join(directory, secretFile);
  writeFileSync(path, JSON.stringify({ VAPID_PUBLIC_KEY: config.publicKey, VAPID_PRIVATE_KEY: config.privateKey, VAPID_SUBJECT: config.subject }), { flag: "wx", mode: 0o600 });
  return path;
}

export function cleanupProductionPushSecrets(directory = process.cwd()) {
  const path = join(directory, secretFile);
  if (existsSync(path)) unlinkSync(path);
}

export function prepareProductionMigrationWorkspace(source, destination) {
  const migrations = join(destination, "supabase/migrations");
  mkdirSync(migrations, { recursive: true });
  writeFileSync(join(destination, "supabase/config.toml"), 'project_id = "webook-production-notifications"\n');
  for (const file of readdirSync(join(source, "supabase/migrations"))) {
    // Preflight found this unrelated Dashboard migration still pending in Production.
    // Leave its source/history untouched; this release applies notification schema only.
    if (file === "20261019120000_dashboard_time_windows.sql" || !file.endsWith(".sql")) continue;
    copyFileSync(join(source, "supabase/migrations", file), join(migrations, file));
  }
}

function migrate() {
  assertProductionTarget();
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error("Missing Production migration credentials.");
  const workspace = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "webook-production-notifications-"));
  prepareProductionMigrationWorkspace(process.cwd(), workspace);
  const run = args => {
    const result = spawnSync(process.execPath, [join(process.cwd(), "node_modules/supabase/dist/supabase.js"), ...args, "--workdir", workspace], { stdio: "inherit", env: process.env });
    if (result.error || result.status !== 0) throw new Error("Production migration command failed.");
  };
  run(["link", "--project-ref", projectRef]);
  if (readFileSync(join(workspace, "supabase/.temp/project-ref"), "utf8").trim() !== projectRef) throw new Error("Unexpected linked Production project.");
  run(["db", "push", "--dry-run"]);
  run(["db", "push"]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "cleanup") cleanupProductionPushSecrets();
  else if (process.argv[2] === "assert") assertProductionTarget();
  else if (process.argv[2] === "migrate") migrate();
  else if (process.argv[2] === "push") prepareProductionPushSecrets();
  else throw new Error("Expected assert, migrate, push or cleanup.");
}
