import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CommandExitError, withProductionEnvironmentExcluded } from "./staging-build-environment.mjs";

/** @param {Pick<NodeJS.ProcessEnv, "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY">} environment */
export function stagingPublicEnvironment(environment = process.env) {
  const fromEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  if (fromEnvironment.NEXT_PUBLIC_SUPABASE_URL && fromEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY) return fromEnvironment;
  const path = join(process.cwd(), ".env.staging");
  if (!existsSync(path)) throw new Error("Missing .env.staging for Staging build");
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY))\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const rawValue = match[2];
    const value = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue;
    values[match[1]] = value;
  }
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Staging Supabase public environment variables");
  }
  return values;
}

function run(executable, args, env) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env,
    shell: process.platform === "win32" && executable.endsWith(".cmd"),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new CommandExitError(result.status ?? 1, `${executable} exited with status ${result.status ?? 1}`);
}

export async function runStagingCloudflare(command) {
  if (command !== "deploy" && command !== "upload") throw new Error("Usage: node scripts/run-staging-cloudflare.mjs <deploy|upload>");
  const env = { ...process.env, ...stagingPublicEnvironment(), OPEN_NEXT_DEPLOY: "true" };
  const openNextCli = join(process.cwd(), "node_modules", "@opennextjs", "cloudflare", "dist", "cli", "index.js");
  const wranglerCli = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  try {
    await withProductionEnvironmentExcluded(process.cwd(), async () => {
      run(process.execPath, [openNextCli, "build"], env);
    });
    run(wranglerCli, [command, "-c", "wrangler.staging.jsonc", "--keep-vars"], env);
  } catch (error) {
    if (error instanceof CommandExitError) process.exitCode = error.exitCode;
    else throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runStagingCloudflare(process.argv[2]);
