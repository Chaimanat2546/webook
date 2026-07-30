import {
  createCentralUserManagerMethodNotAllowedHandler,
  createCentralUserReconcileHandler,
} from "@/server/central-user-manager/api-response";
import { requireCentralUserManagerAdmin } from "@/server/auth/central-user-manager-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createCentralUserManagerServiceDependencies,
  reconcileCentralUserOperation,
} from "@/server/services/central-user-manager";

export const dynamic = "force-dynamic";

const handlePost = createCentralUserReconcileHandler({
  authorize: requireCentralUserManagerAdmin,
  async reconcile(request) {
    const client = createSupabaseAdminClient();
    if (!client) {
      throw new Error("Central User Manager service client is unavailable");
    }
    return reconcileCentralUserOperation(
      request,
      createCentralUserManagerServiceDependencies(client),
    );
  },
});

export function POST(
  request: Request,
  { params }: { params: Promise<{ operationId: string }> },
): Promise<Response> {
  return handlePost(request, params);
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
