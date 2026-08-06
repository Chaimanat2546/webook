import { readFileSync } from "node:fs";

const expectedAccountId = "0df55f166fa309dcc904e992c43f86db";
const config = JSON.parse(readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8"));

if (
  config.account_id !== expectedAccountId ||
  config.name !== "webook-staging" ||
  config.workers_dev !== true ||
  Object.hasOwn(config, "services")
) {
  throw new Error("Invalid webook Staging Cloudflare target configuration.");
}

if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== expectedAccountId) {
  throw new Error("Refusing Staging deployment outside chaymanus2003.");
}
