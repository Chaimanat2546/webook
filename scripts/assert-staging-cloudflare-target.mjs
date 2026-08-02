import { readFileSync } from "node:fs";

const expectedAccountId = "0df55f166fa309dcc904e992c43f86db";
const config = JSON.parse(readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8"));
const binding = config.services?.[0];

if (
  config.account_id !== expectedAccountId ||
  config.name !== "webook-staging" ||
  config.workers_dev !== true ||
  config.services?.length !== 1 ||
  binding?.binding !== "CUM_BAAN_POOL_VILLA_STAGING" ||
  binding?.service !== "baan-pool-villa-staging" ||
  binding?.entrypoint !== "CentralUserManagerEntrypoint"
) {
  throw new Error("Invalid webook Staging Cloudflare target configuration.");
}

if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== expectedAccountId) {
  throw new Error("Refusing Staging deployment outside chaymanus2003.");
}
