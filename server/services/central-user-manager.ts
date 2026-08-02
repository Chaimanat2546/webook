import "server-only";

import { requireCentralUserManagerAdmin } from "../auth/admin.ts";
import { callTenantAgent } from "../central-user-manager/agent-client.ts";
import {
  parseCentralUserRpcRequest,
  type CentralUserAction,
  type CentralUserPayload,
} from "../central-user-manager/contracts.ts";
import { finishCentralUserAudit, startCentralUserAudit } from "../repositories/central-user-audit.ts";
import { projectBrowserCentralUserResult, type BrowserCentralUserRpcResult } from "../central-user-manager/tenant-result.ts";

export interface RunCentralUserOperationInput {
  tenantId: string;
  operationId: string;
  action: CentralUserAction;
  payload: CentralUserPayload;
}

export async function runCentralUserOperation(input: RunCentralUserOperationInput): Promise<BrowserCentralUserRpcResult> {
  const session = await requireCentralUserManagerAdmin();
  const request = parseCentralUserRpcRequest({
    protocolVersion: 1,
    tenantId: input.tenantId,
    operationId: input.operationId,
    actorUid: session.user.id,
    action: input.action,
    payload: input.payload,
  });

  await startCentralUserAudit({
    operationId: request.operationId,
    tenantId: request.tenantId,
    actorUid: request.actorUid,
    action: request.action,
  });
  const result = await callTenantAgent(request);
  await finishCentralUserAudit({
    operationId: request.operationId,
    status: result.ok ? result.operation.status : "failed",
    safeErrorCode: result.ok ? undefined : result.error.code,
  });
  return projectBrowserCentralUserResult(result);
}
