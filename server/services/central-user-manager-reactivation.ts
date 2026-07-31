import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getAgentHealth,
  logAgentOutboundDiagnostic,
  sendAgentOperation,
  type AgentHealthCallResult,
  type AgentOperationCallResult,
} from "../central-user-manager/agent-client.ts";
import {
  createSafeCentralUserError,
  type SafeCentralUserError,
} from "../central-user-manager/safe-errors.ts";
import {
  activateCustomerProjectAfterReverification,
  beginCustomerProjectReactivation,
  findCustomerProjectForReactivation,
  recordCustomerProjectReactivationVerification,
  type ActiveCustomerProject,
  type CustomerProjectHealthProof,
  type CustomerProjectReactivationAttempt,
} from "../repositories/customer-projects.ts";
import type { AgentOperationRequest } from "../central-user-manager/contracts.ts";

export interface CentralUserManagerReactivationDependencies {
  findProject(tenantId: string): Promise<ActiveCustomerProject | null>;
  begin(input: {
    tenantId: string;
    attemptId: string;
    expectedTokenVersion: number;
    actorUid: string;
    eventId: string;
  }): Promise<CustomerProjectReactivationAttempt>;
  getHealth(project: ActiveCustomerProject): Promise<AgentHealthCallResult>;
  recordVerification(input: {
    tenantId: string;
    attemptId: string;
    tokenVersion: number;
    check: "health" | "list_users";
    succeeded: boolean;
    safeErrorCode: string | null;
    health: CustomerProjectHealthProof | null;
  }): Promise<boolean>;
  sendOperation(
    project: ActiveCustomerProject,
    request: AgentOperationRequest,
  ): Promise<AgentOperationCallResult>;
  activate(input: {
    tenantId: string;
    attemptId: string;
    expectedTokenVersion: number;
    actorUid: string;
    eventId: string;
  }): Promise<boolean>;
  randomUuid(): string;
}

export interface CentralUserManagerReactivationHealth {
  tenantId: string;
  status: "healthy";
  agentVersion: string;
  schemaVersion: string;
  authAttestationVersion: string;
  authAttestationCheckedAt: string;
}

export type CentralUserManagerReactivationResult =
  | { ok: true; health: CentralUserManagerReactivationHealth }
  | { ok: false; error: SafeCentralUserError };

function failure(
  code: "project_unavailable" | "provider_failure" | "operation_conflict",
): CentralUserManagerReactivationResult {
  return { ok: false, error: createSafeCentralUserError(code) };
}

async function record(
  dependencies: CentralUserManagerReactivationDependencies,
  input: Parameters<
    CentralUserManagerReactivationDependencies["recordVerification"]
  >[0],
): Promise<boolean> {
  try {
    return await dependencies.recordVerification(input);
  } catch {
    return false;
  }
}

export async function reactivateCentralUserManagerTenant(
  input: { tenantId: string; actorUid: string },
  dependencies: CentralUserManagerReactivationDependencies,
): Promise<CentralUserManagerReactivationResult> {
  let project: ActiveCustomerProject | null;
  try {
    project = await dependencies.findProject(input.tenantId);
  } catch {
    return failure("project_unavailable");
  }
  if (!project) return failure("project_unavailable");

  let attempt: CustomerProjectReactivationAttempt;
  const attemptId = dependencies.randomUuid();
  try {
    attempt = await dependencies.begin({
      tenantId: input.tenantId,
      attemptId,
      expectedTokenVersion: project.bearerTokenVersion,
      actorUid: input.actorUid,
      eventId: dependencies.randomUuid(),
    });
  } catch {
    return failure("project_unavailable");
  }
  if (attempt.outcome === "conflict") {
    return failure("operation_conflict");
  }
  if (
    attempt.tokenVersion !== project.bearerTokenVersion ||
    attempt.attemptId.length === 0
  ) {
    return failure("project_unavailable");
  }

  let healthResult: AgentHealthCallResult;
  try {
    healthResult = await dependencies.getHealth(project);
  } catch {
    healthResult = {
      kind: "failure",
      error: createSafeCentralUserError("provider_failure"),
    };
  }
  const healthRecorded = await record(dependencies, {
    tenantId: input.tenantId,
    attemptId: attempt.attemptId,
    tokenVersion: attempt.tokenVersion,
    check: "health",
    succeeded: healthResult.kind === "success",
    safeErrorCode:
      healthResult.kind === "failure" ? healthResult.error.code : null,
    health: healthResult.kind === "success" ? healthResult.data : null,
  });
  if (!healthRecorded) return failure("provider_failure");
  if (healthResult.kind === "failure") {
    return {
      ok: false,
      error: createSafeCentralUserError(
        healthResult.error.code === "project_unavailable"
          ? "project_unavailable"
          : "provider_failure",
      ),
    };
  }

  const operationId = dependencies.randomUuid();
  let listResult: AgentOperationCallResult;
  try {
    listResult = await dependencies.sendOperation(project, {
      tenantId: input.tenantId,
      operationId,
      actorUid: input.actorUid,
      action: "list_users",
      payload: { page: 1, pageSize: 1 },
    });
  } catch {
    listResult = {
      kind: "failure",
      error: createSafeCentralUserError("provider_failure"),
    };
  }
  const listSucceeded =
    listResult.kind === "response" &&
    listResult.operationId === operationId &&
    listResult.status === "completed" &&
    listResult.stage === "listed" &&
    listResult.safeResult !== null &&
    "users" in listResult.safeResult;
  const listRecorded = await record(dependencies, {
    tenantId: input.tenantId,
    attemptId: attempt.attemptId,
    tokenVersion: attempt.tokenVersion,
    check: "list_users",
    succeeded: listSucceeded,
    safeErrorCode: listSucceeded ? null : "provider_failure",
    health: null,
  });
  if (!listRecorded || !listSucceeded) return failure("provider_failure");

  let activated = false;
  try {
    activated = await dependencies.activate({
      tenantId: input.tenantId,
      attemptId: attempt.attemptId,
      expectedTokenVersion: attempt.tokenVersion,
      actorUid: input.actorUid,
      eventId: dependencies.randomUuid(),
    });
  } catch {
    activated = false;
  }
  if (!activated) return failure("provider_failure");

  return {
    ok: true,
    health: {
      tenantId: healthResult.data.tenantId,
      status: "healthy",
      agentVersion: healthResult.data.agentVersion,
      schemaVersion: healthResult.data.schemaVersion,
      authAttestationVersion: healthResult.data.authAttestationVersion,
      authAttestationCheckedAt: healthResult.data.authAttestationCheckedAt,
    },
  };
}

export function createCentralUserManagerReactivationDependencies(
  client: SupabaseClient,
): CentralUserManagerReactivationDependencies {
  return {
    findProject: (tenantId) =>
      findCustomerProjectForReactivation(client, tenantId),
    begin: (input) => beginCustomerProjectReactivation(client, input),
    getHealth: (project) =>
      getAgentHealth(project, {
        diagnostic: logAgentOutboundDiagnostic,
      }),
    recordVerification: (input) =>
      recordCustomerProjectReactivationVerification(client, input),
    sendOperation: (project, request) =>
      sendAgentOperation(project, request, {
        diagnostic: logAgentOutboundDiagnostic,
      }),
    activate: (input) =>
      activateCustomerProjectAfterReverification(client, input),
    randomUuid: () => crypto.randomUUID(),
  };
}
