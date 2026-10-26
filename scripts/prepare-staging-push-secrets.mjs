import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { pushConfig } from "../server/notifications/web-push.ts";

const secretFile = ".env.staging-worker-secrets.json";

/**
 * Create an ignored runtime upload file; never inject these values into builds.
 * @param {string} directory
 * @param {import("../server/notifications/web-push.ts").PushBindings & { GITHUB_ACTIONS?: string; NEXT_PUBLIC_SUPABASE_URL?: string }} environment
 */
export function prepareStagingPushSecrets(directory = process.cwd(), environment = process.env) {
  try {
    const target = JSON.parse(readFileSync(join(directory, "wrangler.staging.jsonc"), "utf8"));
    const config = pushConfig(environment);
    if (environment.GITHUB_ACTIONS !== "true" || target.account_id !== "0df55f166fa309dcc904e992c43f86db"
      || target.name !== "webook-staging" || environment.NEXT_PUBLIC_SUPABASE_URL !== "https://sxvkhzhqtrpxgzumsswl.supabase.co"
      || !config) throw new Error("invalid_configuration");
    const legacy = join(directory, ".env.ical-staging");
    const secrets = {
      ...(existsSync(legacy) ? parseEnv(readFileSync(legacy, "utf8")) : {}),
      VAPID_PUBLIC_KEY: config.publicKey,
      VAPID_PRIVATE_KEY: config.privateKey,
      VAPID_SUBJECT: config.subject,
    };
    const path = join(directory, secretFile);
    writeFileSync(path, JSON.stringify(secrets), { flag: "wx", mode: 0o600 });
    return path;
  } catch { throw new Error("Staging Push configuration could not be prepared; check the CI target and required environment secrets."); }
}

export function cleanupStagingPushSecrets(directory = process.cwd()) {
  const path = join(directory, secretFile);
  if (existsSync(path)) unlinkSync(path);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Staging Push setup may run only in GitHub Actions.");
    if (process.argv[2] === "cleanup") cleanupStagingPushSecrets();
    else prepareStagingPushSecrets();
    console.log("Staging Push runtime secret file prepared/cleaned; no values printed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging Push setup failed.");
    process.exitCode = 1;
  }
}
