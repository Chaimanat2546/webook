import "server-only";

import { isCanonicalUuid } from "./contracts.ts";

const CENTRAL_USER_TENANTS = [{
  key: "baanparty",
  id: "a7f10ab9-db3a-400f-8185-03aabe8041db",
  displayName: "Baan Party Pattaya",
  environment: "Production",
  enabled: true,
}, {
  key: "poolvillapattaya",
  id: "9fd7c645-563a-4cce-85ac-20ffb8f3bfc0",
  displayName: "Poolvillapattaya",
  environment: "Production",
  enabled: true,
}, {
  key: "baanpmhee",
  id: "93b00ab0-df98-4a1d-9411-0b96750e7191",
  displayName: "baanPMhee",
  environment: "Production",
  enabled: true,
}, {
  key: "fluknasapoolvilla",
  id: "ce440408-3844-4a06-a5ae-56a4fac8acf8",
  displayName: "Fluk Nasa Poolvilla",
  environment: "Production",
  enabled: true,
}, {
  key: "villamediapoolvilla",
  id: "f216699f-30cc-4076-822c-88657ca4efda",
  displayName: "Villa Media Poolvilla",
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
