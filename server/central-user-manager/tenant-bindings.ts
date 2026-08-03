import "server-only";

import { isCanonicalUuid } from "./contracts.ts";

const CENTRAL_USER_TENANTS = [{
  key: "baanparty",
  id: "a7f10ab9-db3a-400f-8185-03aabe8041db",
  displayName: "Baan Party Pattaya",
  environment: "Production",
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
