import "server-only";

import { isCanonicalUuid } from "./contracts.ts";

export const STAGING_TENANT_ID = "2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb";

const CENTRAL_USER_TENANTS = [{
  key: "baan-pool-villa-staging",
  id: STAGING_TENANT_ID,
  displayName: "Baan Pool Villa",
  environment: "Staging",
  enabled: true,
}] as const;

export type CentralUserTenant = (typeof CENTRAL_USER_TENANTS)[number];

export function listCentralUserTenants() {
  return CENTRAL_USER_TENANTS.map(({ key, displayName, environment, enabled }) => ({ key, displayName, environment, enabled }));
}

export function resolveCentralUserTenant(key: unknown): CentralUserTenant | null {
  return typeof key === "string"
    ? CENTRAL_USER_TENANTS.find((tenant) => tenant.key === key) ?? null
    : null;
}

export function resolveCentralUserTenantById(tenantId: unknown): CentralUserTenant | null {
  return isCanonicalUuid(tenantId)
    ? CENTRAL_USER_TENANTS.find((tenant) => tenant.id === tenantId) ?? null
    : null;
}
