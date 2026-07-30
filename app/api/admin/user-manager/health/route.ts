import {
  createCentralUserManagerMethodNotAllowedHandler,
  createCentralUserHealthHandler,
} from "@/server/central-user-manager/api-response";
import { requireCentralUserManagerAdmin } from "@/server/auth/central-user-manager-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  checkCentralUserManagerHealth,
  createCentralUserManagerHealthDependencies,
} from "@/server/services/central-user-manager";

export const dynamic = "force-dynamic";

const handleGet = createCentralUserHealthHandler({
  authorize: requireCentralUserManagerAdmin,
  async checkHealth(tenantId) {
    const client = createSupabaseAdminClient();
    if (!client) {
      throw new Error("Central User Manager service client is unavailable");
    }
    return checkCentralUserManagerHealth(
      tenantId,
      createCentralUserManagerHealthDependencies(client),
    );
  },
});

export function GET(request: Request): Promise<Response> {
  return handleGet(request);
}

const rejectMethod = createCentralUserManagerMethodNotAllowedHandler(
  { authorize: requireCentralUserManagerAdmin },
  "GET",
);

export const POST = rejectMethod;
export const PUT = rejectMethod;
export const PATCH = rejectMethod;
export const DELETE = rejectMethod;
export const HEAD = rejectMethod;
export const OPTIONS = rejectMethod;
