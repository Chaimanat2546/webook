import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getQuotationAssetEnv } from "../../lib/env";

export interface QuotationAssetRuntimeEnv {
  workerSecret: string;
  workerUrl: string;
}

interface QuotationAssetBindings {
  ADVERTISEMENT_IMAGE_WORKER_SECRET?: unknown;
  ADVERTISEMENT_IMAGE_WORKER_URL?: unknown;
}

/**
 * Read media credentials from the Worker binding when deployed.  OpenNext's
 * process.env shim can retain a build-time value for a Server Action, while
 * the binding always contains the currently configured Cloudflare secret.
 */
export async function getQuotationAssetRuntimeEnv(): Promise<QuotationAssetRuntimeEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bindings = env as unknown as QuotationAssetBindings;
    const workerSecret = typeof bindings.ADVERTISEMENT_IMAGE_WORKER_SECRET === "string"
      ? bindings.ADVERTISEMENT_IMAGE_WORKER_SECRET.trim()
      : "";
    const workerUrl = typeof bindings.ADVERTISEMENT_IMAGE_WORKER_URL === "string"
      ? bindings.ADVERTISEMENT_IMAGE_WORKER_URL.trim()
      : "";
    if (workerSecret && workerUrl) return { workerSecret, workerUrl };
  } catch {
    // Local Node tests and `next dev` do not always have a Cloudflare context.
  }
  return getQuotationAssetEnv();
}
