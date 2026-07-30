import {
  createCentralUserManagerMethodNotAllowedHandler,
  createCentralUserOperationsHandler,
} from "@/server/central-user-manager/api-response";
import { requireCentralUserManagerAdmin } from "@/server/auth/central-user-manager-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createCentralUserManagerServiceDependencies,
  executeCentralUserOperation,
} from "@/server/services/central-user-manager";

export const dynamic = "force-dynamic";

const handlePost = createCentralUserOperationsHandler({
  authorize: requireCentralUserManagerAdmin,
  async execute(request) {
    const client = createSupabaseAdminClient();
    if (!client) {
      throw new Error("Central User Manager service client is unavailable");
    }
    return executeCentralUserOperation(
      request,
      createCentralUserManagerServiceDependencies(client),
    );
  },
});

export function POST(request: Request): Promise<Response> {
  return handlePost(request);
}

const rejectMethod = createCentralUserManagerMethodNotAllowedHandler(
  { authorize: requireCentralUserManagerAdmin },
  "POST",
);

export const GET = rejectMethod;
export const PUT = rejectMethod;
export const PATCH = rejectMethod;
export const DELETE = rejectMethod;
export const HEAD = rejectMethod;
export const OPTIONS = rejectMethod;
