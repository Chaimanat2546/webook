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
  if (tenant.key === "poolvillapattaya" && env.CUM_POOLVILLAPATTAYA) {
    return env.CUM_POOLVILLAPATTAYA;
  }
  if (tenant.key === "baanpmhee" && env.CUM_BAANPMHEE) {
    return env.CUM_BAANPMHEE;
  }
  if (tenant.key === "fluknasapoolvilla" && env.CUM_FLUK_NASA_POOLVILLA) {
    return env.CUM_FLUK_NASA_POOLVILLA;
  }
  if (tenant.key === "villamediapoolvilla" && env.CUM_VILLA_MEDIA_POOLVILLA) {
    return env.CUM_VILLA_MEDIA_POOLVILLA;
  }
  throw new CentralUserManagerError("tenant_unavailable");
}
