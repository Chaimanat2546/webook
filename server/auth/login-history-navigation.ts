import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createLoginHistoryRepository } from "../repositories/login-history";
import { requireAdmin } from "./admin";

export const canViewLoginHistory = cache(async (): Promise<boolean> => {
  try {
    const { user } = await requireAdmin();
    const client = createSupabaseAdminClient();
    if (!client) return false;
    return (await createLoginHistoryRepository(client).scope({ userId: user.id, sessionId: "" })).kind === "root-admin";
  } catch { return false; }
});
