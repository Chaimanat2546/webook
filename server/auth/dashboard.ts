import "server-only";
import { cache } from "react";
import { requireAdmin } from "./admin";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createDashboardRepository } from "../repositories/dashboard";

export const dashboardSession = cache(async () => {
  const session = await requireAdmin();
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("dashboard_unavailable");
  return { actorId: session.user.id, repository: createDashboardRepository(client) };
});

export async function canOpenDashboard(): Promise<boolean> {
  try {
    const { actorId, repository } = await dashboardSession();
    return (await repository.access(actorId)) !== null;
  } catch {
    return false;
  }
}
