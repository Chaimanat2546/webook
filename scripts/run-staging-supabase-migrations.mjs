import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertStagingProjectRef, STAGING_SUPABASE_PROJECT_REF } from "./assert-staging-supabase-target.mjs";

function requireEnvironment(name) {
  if (!process.env[name]) throw new Error(`Missing ${name} for Staging migration.`);
}

function runSupabase(args) {
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["supabase", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function runStagingMigrations() {
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Staging migrations may run only in GitHub Actions.");
  }
  requireEnvironment("SUPABASE_ACCESS_TOKEN");
  requireEnvironment("SUPABASE_DB_PASSWORD");
  runSupabase(["link", "--project-ref", STAGING_SUPABASE_PROJECT_REF]);
  assertStagingProjectRef(readFileSync("supabase/.temp/project-ref", "utf8").trim());
  runSupabase(["db", "push", "--dry-run"]);
  runSupabase(["db", "push"]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runStagingMigrations();
