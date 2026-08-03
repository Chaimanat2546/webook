import "server-only";

import type { CentralUserRpcRequest } from "./contracts.ts";
import { getCentralUserBinding } from "./cloudflare-bindings.ts";
import { parseTenantCentralUserRpcResult, type TenantCentralUserRpcResult } from "./tenant-result.ts";

export async function callTenantAgent(
  request: CentralUserRpcRequest,
  binding?: Awaited<ReturnType<typeof getCentralUserBinding>>,
): Promise<TenantCentralUserRpcResult> {
  try {
    const resolvedBinding = binding ?? await getCentralUserBinding(request.tenantId);
    return parseTenantCentralUserRpcResult(await resolvedBinding.executeOperation(request), request);
  } catch {
    return { ok: false, error: { code: "agent_unavailable", message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } };
  }
}
