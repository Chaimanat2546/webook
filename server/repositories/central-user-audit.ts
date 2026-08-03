import "server-only";

import { createSupabaseAdminClient } from "../../lib/supabase/admin.ts";
import type { CentralUserAction, CentralUserOperationStatus } from "../central-user-manager/contracts.ts";

export interface CentralAuditStart {
  operationId: string;
  tenantId: string;
  actorUid: string;
  action: CentralUserAction;
}

export interface CentralAuditFinish {
  operationId: string;
  status: CentralUserOperationStatus;
  safeErrorCode?: string;
}

function getAuditClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Central user audit is unavailable");
  return client;
}

export async function startCentralUserAudit(input: CentralAuditStart) {
  const client = getAuditClient();
  const { data, error } = await client
    .from("central_user_audit_events")
    .insert({
      operation_id: input.operationId,
      tenant_id: input.tenantId,
      actor_uid: input.actorUid,
      action: input.action,
      status: "started",
    })
    .select("operation_id, tenant_id, actor_uid, action, status")
    .maybeSingle();

  if (!error) return data;
  if (error.code !== "23505") throw new Error("Central user audit is unavailable");

  const existing = await client
    .from("central_user_audit_events")
    .select("operation_id, tenant_id, actor_uid, action, status")
    .eq("operation_id", input.operationId)
    .maybeSingle();
  if (existing.error || !existing.data || existing.data.tenant_id !== input.tenantId || existing.data.actor_uid !== input.actorUid || existing.data.action !== input.action) {
    throw new Error("Central user audit operation conflict");
  }
  return existing.data;
}

export async function finishCentralUserAudit(input: CentralAuditFinish) {
  const client = getAuditClient();
  const safeErrorCode = input.safeErrorCode?.slice(0, 64) ?? null;
  const terminal = input.status !== "in_progress";
  const { error } = await client
    .from("central_user_audit_events")
    .update({ status: input.status, safe_error_code: input.status === "failed" ? safeErrorCode : null, completed_at: terminal ? new Date().toISOString() : null })
    .eq("operation_id", input.operationId)
    .in("status", ["started", "in_progress"]);
  if (error) throw new Error("Central user audit is unavailable");
}
