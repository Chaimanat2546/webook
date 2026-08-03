import { getCloudflareContext } from "@opennextjs/cloudflare";

import { CentralUserManagerError } from "./contracts.ts";
import { resolveCentralUserTenantById } from "./tenant-bindings.ts";

export async function getCentralUserBinding(tenantId: string) {
  const tenant = resolveCentralUserTenantById(tenantId);
  if (!tenant || !tenant.enabled) {
    throw new CentralUserManagerError("tenant_unavailable");
  }

  const { env } = await getCloudflareContext({ async: true });
  if (tenant.key === "baanparty" && env.CUM_BAANPARTY) {
    return env.CUM_BAANPARTY;
  }
  if (!env.CUM_BAANPARTY) {
    throw new CentralUserManagerError("tenant_unavailable");
  }
  throw new CentralUserManagerError("tenant_unavailable");
}
