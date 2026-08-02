import { getCloudflareContext } from "@opennextjs/cloudflare";

import { CentralUserManagerError } from "./contracts.ts";
import { resolveCentralUserTenantById } from "./tenant-bindings.ts";

export async function getCentralUserBinding(tenantId: string) {
  const tenant = resolveCentralUserTenantById(tenantId);
  if (!tenant || !tenant.enabled) {
    throw new CentralUserManagerError("tenant_unavailable");
  }

  const { env } = await getCloudflareContext({ async: true });
  if (tenant.key === "baan-pool-villa-staging" && env.CUM_BAAN_POOL_VILLA_STAGING) {
    return env.CUM_BAAN_POOL_VILLA_STAGING;
  }
  if (!env.CUM_BAAN_POOL_VILLA_STAGING) {
    throw new CentralUserManagerError("tenant_unavailable");
  }
  throw new CentralUserManagerError("tenant_unavailable");
}
