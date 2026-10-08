import "server-only";
import { resolveCentralUserTenant } from "../central-user-manager/tenant-bindings.ts";
import type { AnalyticsSite } from "../../lib/website-analytics.ts";

const ORIGINS = [
  ["baanparty", "https://www.baanpartypattaya.com"],
  ["poolvillapattaya", "https://www.poolvillapattaya.co.th"],
  ["baanpmhee", "https://www.pmheevilla.com"],
  ["fluknasapoolvilla", "https://nasapoolvilla.com"],
  ["villamediapoolvilla", "https://pukmoodpoolvilla.com"],
] as const;
export function listAnalyticsSites(): AnalyticsSite[] {
  return ORIGINS.flatMap(([key, origin]) => {
    const tenant = resolveCentralUserTenant(key);
    return tenant?.enabled ? [{ key, origin, siteId: tenant.id, displayName: tenant.displayName }] : [];
  });
}
export function resolveAnalyticsSite(key: string): AnalyticsSite | null {
  return listAnalyticsSites().find(site => site.key === key) ?? null;
}
