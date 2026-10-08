import "server-only";
import { WebsiteAnalyticsError } from "../../lib/website-analytics.ts";
import type { DashboardScope } from "../../lib/dashboard.ts";

interface AccessDependencies {
  identity: () => Promise<string | null>;
  access: (uid: string) => Promise<DashboardScope | null>;
}
const defaults: AccessDependencies = {
  async identity() {
    const { createSupabaseServerClient } = await import("../../lib/supabase/server");
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user?.id ?? null;
  },
  async access(uid) {
    const { createSupabaseAdminClient } = await import("../../lib/supabase/admin");
    const { createDashboardRepository } = await import("../repositories/dashboard.ts");
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("unavailable");
    return createDashboardRepository(client).access(uid);
  },
};
export async function requireWebsiteAnalyticsAccess(dependencies: AccessDependencies = defaults): Promise<void> {
  try {
    const uid = await dependencies.identity();
    if (!uid) throw new WebsiteAnalyticsError("unauthenticated", 401);
    const scope = await dependencies.access(uid);
    if (scope?.kind !== "admin") throw new WebsiteAnalyticsError("forbidden", 403);
  } catch (error) {
    if (error instanceof WebsiteAnalyticsError) throw error;
    throw new WebsiteAnalyticsError("unavailable", 503);
  }
}
