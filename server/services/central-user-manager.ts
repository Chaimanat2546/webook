import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getAgentHealth,
  logAgentOutboundDiagnostic,
  sendAgentOperation,
  type AgentHealthCallResult,
  type AgentOperationCallResult,
} from "../central-user-manager/agent-client.ts";
import type { AgentOperationRequest } from "../central-user-manager/contracts.ts";
import {
  hashCentralOperationBinding,
  toCentralOperationBinding,
  type CentralOperationBinding,
} from "../central-user-manager/request-hash.ts";
import {
  createSafeCentralUserError,
  type SafeCentralUserError,
  type SafeCentralUserErrorCode,
} from "../central-user-manager/safe-errors.ts";
import {
  findActiveCustomerProject,
  recordCustomerProjectVerification,
  type ActiveCustomerProject,
  type CustomerProjectHealthProof,
} from "../repositories/customer-projects.ts";
import {
  beginCentralUserDispatch,
  claimCentralUserOperation,
  CentralUserOperationConflictError,
  finalizeCentralUserOperation,
  type CentralUserAgentStage,
  type CentralUserFinalizationInput,
  type CentralUserOperationBinding,
  type CentralUserOperationClaim,
  type CentralUserOperationStatus,
  type CentralUserSafeResult,
} from "../repositories/user-management-operations.ts";

export interface CentralUserManagerServiceDependencies {
  findActiveProject(tenantId: string): Promise<ActiveCustomerProject | null>;
  hashBinding(binding: CentralOperationBinding): Promise<string>;
  claimOperation(
    binding: CentralUserOperationBinding,
  ): Promise<CentralUserOperationClaim>;
  beginDispatch(operationId: string, requestHash: string): Promise<boolean>;
  sendOperation(
    project: ActiveCustomerProject,
    request: AgentOperationRequest,
  ): Promise<AgentOperationCallResult>;
  finalizeOperation(input: CentralUserFinalizationInput): Promise<boolean>;
  randomUuid(): string;
}

export interface CentralUserManagerHealthDependencies {
  findActiveProject(tenantId: string): Promise<ActiveCustomerProject | null>;
  getHealth(project: ActiveCustomerProject): Promise<AgentHealthCallResult>;
  recordVerification(input: {
    tenantId: string;
    tokenVersion: number;
    check: "health";
    succeeded: boolean;
    safeErrorCode: string | null;
    health: CustomerProjectHealthProof | null;
  }): Promise<boolean>;
}

export interface CentralUserHealthSummary {
  tenantId: string;
  status: "healthy" | "unhealthy";
  agentVersion: string | null;
  schemaVersion: string | null;
  authAttestationVersion: string | null;
  authAttestationCheckedAt: string | null;
}

export type CentralUserHealthResult =
  | { ok: true; health: CentralUserHealthSummary }
  | { ok: false; error: SafeCentralUserError };

export interface CentralUserManagerOperationResult {
  operationId: string;
  status: CentralUserOperationStatus;
  agentStage: CentralUserAgentStage | null;
  safeResult: CentralUserSafeResult | null;
  safeErrorCode: SafeCentralUserErrorCode | null;
  temporaryPassword?: string;
}

export type CentralUserManagerServiceResult =
  | { ok: true; operation: CentralUserManagerOperationResult }
  | { ok: false; error: SafeCentralUserError };

interface DispatchFinalization {
  input: Omit<
    CentralUserFinalizationInput,
    "operationId" | "requestHash" | "eventId" | "expectedStatus" | "metadata"
  >;
  temporaryPassword?: string;
}

function failure(
  code: SafeCentralUserErrorCode,
): CentralUserManagerServiceResult {
  return { ok: false, error: createSafeCentralUserError(code) };
}

function targetEmail(request: AgentOperationRequest): string | null {
  return request.action === "list_users" ? null : request.payload.email;
}

function operationFromClaim(
  operationId: string,
  claim: Extract<CentralUserOperationClaim, { outcome: "retry" }>,
): CentralUserManagerServiceResult {
  return {
    ok: true,
    operation: {
      operationId,
      status: claim.status,
      agentStage: claim.agentStage,
      safeResult: claim.safeResult,
      safeErrorCode: claim.safeErrorCode,
    },
  };
}

function safeCodeForAgentError(
  agentErrorCode: string | undefined,
): SafeCentralUserErrorCode {
  return agentErrorCode === "operation_conflict" ||
    agentErrorCode === "user_exists"
    ? "operation_conflict"
    : agentErrorCode === "provider_ambiguous" ||
        agentErrorCode === "lease_conflict" ||
        agentErrorCode === "lease_lost"
      ? "operation_ambiguous"
      : "provider_failure";
}

function mapAgentResult(
  result: AgentOperationCallResult,
): DispatchFinalization {
  if (result.kind === "ambiguous") {
    return {
      input: {
        nextStatus: "needs_review",
        agentStage: null,
        safeResult: null,
        safeErrorCode: "operation_ambiguous",
      },
    };
  }

  if (result.kind === "failure") {
    return {
      input: {
        nextStatus: "failed_safe",
        agentStage: null,
        safeResult: null,
        safeErrorCode: result.error.code,
      },
    };
  }

  if (
    result.status === "completed" &&
    result.safeResult === null &&
    result.agentErrorCode === "create_compensated"
  ) {
    return {
      input: {
        nextStatus: "failed_safe",
        agentStage: result.stage,
        safeResult: null,
        safeErrorCode: "provider_failure",
      },
    };
  }

  if (result.status === "completed" && result.safeResult !== null) {
    return {
      input: {
        nextStatus: "completed",
        agentStage: result.stage,
        safeResult: result.safeResult,
        safeErrorCode:
          result.agentErrorCode === "user_exists"
            ? "operation_conflict"
            : null,
      },
      ...(result.temporaryPassword
        ? { temporaryPassword: result.temporaryPassword }
        : {}),
    };
  }

  return {
    input: {
      nextStatus: result.status,
      agentStage: result.stage,
      safeResult: null,
      safeErrorCode: safeCodeForAgentError(result.agentErrorCode),
    },
  };
}

function operationFromFinalization(
  operationId: string,
  finalization: DispatchFinalization,
  includeTemporaryPassword: boolean,
): CentralUserManagerServiceResult {
  return {
    ok: true,
    operation: {
      operationId,
      status: finalization.input.nextStatus,
      agentStage: finalization.input.agentStage,
      safeResult: finalization.input.safeResult,
      safeErrorCode: finalization.input.safeErrorCode,
      ...(includeTemporaryPassword && finalization.temporaryPassword
        ? { temporaryPassword: finalization.temporaryPassword }
        : {}),
    },
  };
}

async function claim(
  request: AgentOperationRequest,
  requestHash: string,
  dependencies: CentralUserManagerServiceDependencies,
): Promise<CentralUserOperationClaim> {
  return dependencies.claimOperation({
    operationId: request.operationId,
    tenantId: request.tenantId,
    actorUid: request.actorUid,
    action: request.action,
    targetEmailNormalized: targetEmail(request),
    requestHash,
  });
}

async function bestEffortMarkNeedsReview(
  request: AgentOperationRequest,
  requestHash: string,
  dependencies: CentralUserManagerServiceDependencies,
  disposition: "first" | "retry",
): Promise<boolean> {
  try {
    return await dependencies.finalizeOperation({
      operationId: request.operationId,
      requestHash,
      eventId: dependencies.randomUuid(),
      expectedStatus: "dispatching",
      nextStatus: "needs_review",
      agentStage: null,
      safeResult: null,
      safeErrorCode: "operation_ambiguous",
      metadata: { disposition },
    });
  } catch {
    return false;
  }
}

async function finalizeDispatch(
  request: AgentOperationRequest,
  requestHash: string,
  dependencies: CentralUserManagerServiceDependencies,
  finalization: DispatchFinalization,
  disposition: "first" | "retry",
): Promise<CentralUserManagerServiceResult> {
  let persisted = false;
  try {
    persisted = await dependencies.finalizeOperation({
      operationId: request.operationId,
      requestHash,
      eventId: dependencies.randomUuid(),
      expectedStatus: "dispatching",
      ...finalization.input,
      metadata: { disposition },
    } as CentralUserFinalizationInput);
  } catch {
    persisted = false;
  }

  if (persisted) {
    return operationFromFinalization(
      request.operationId,
      finalization,
      true,
    );
  }

  if (
    await bestEffortMarkNeedsReview(
      request,
      requestHash,
      dependencies,
      disposition,
    )
  ) {
    return {
      ok: true,
      operation: {
        operationId: request.operationId,
        status: "needs_review",
        agentStage: null,
        safeResult: null,
        safeErrorCode: "operation_ambiguous",
      },
    };
  }

  return failure("operation_ambiguous");
}

async function prepare(
  request: AgentOperationRequest,
  dependencies: CentralUserManagerServiceDependencies,
): Promise<
  | {
      ok: true;
      project: ActiveCustomerProject;
      requestHash: string;
      claim: CentralUserOperationClaim;
    }
  | { ok: false; result: CentralUserManagerServiceResult }
> {
  let project: ActiveCustomerProject | null;
  try {
    project = await dependencies.findActiveProject(request.tenantId);
  } catch {
    return { ok: false, result: failure("project_unavailable") };
  }
  if (!project) {
    return { ok: false, result: failure("project_unavailable") };
  }

  let requestHash: string;
  let operationClaim: CentralUserOperationClaim;
  try {
    requestHash = await dependencies.hashBinding(
      toCentralOperationBinding(request),
    );
    operationClaim = await claim(request, requestHash, dependencies);
  } catch (error) {
    return {
      ok: false,
      result: failure(
        error instanceof CentralUserOperationConflictError
          ? "operation_conflict"
          : "provider_failure",
      ),
    };
  }
  return { ok: true, project, requestHash, claim: operationClaim };
}

export async function executeCentralUserOperation(
  request: AgentOperationRequest,
  dependencies: CentralUserManagerServiceDependencies,
): Promise<CentralUserManagerServiceResult> {
  const prepared = await prepare(request, dependencies);
  if (!prepared.ok) {
    return prepared.result;
  }

  let operationClaim = prepared.claim;
  if (operationClaim.outcome === "retry" && operationClaim.status !== "received") {
    return operationFromClaim(request.operationId, operationClaim);
  }
  const disposition = operationClaim.outcome === "claimed" ? "first" : "retry";

  let beganDispatch: boolean;
  try {
    beganDispatch = await dependencies.beginDispatch(
      request.operationId,
      prepared.requestHash,
    );
  } catch {
    return failure("provider_failure");
  }
  if (!beganDispatch) {
    try {
      operationClaim = await claim(
        request,
        prepared.requestHash,
        dependencies,
      );
    } catch (error) {
      return failure(
        error instanceof CentralUserOperationConflictError
          ? "operation_conflict"
          : "provider_failure",
      );
    }
    return operationClaim.outcome === "retry"
      ? operationFromClaim(request.operationId, operationClaim)
      : failure("operation_ambiguous");
  }

  let agentResult: AgentOperationCallResult;
  try {
    agentResult = await dependencies.sendOperation(prepared.project, request);
  } catch {
    agentResult = {
      kind: "ambiguous",
      error: createSafeCentralUserError("operation_ambiguous"),
    };
  }
  return finalizeDispatch(
    request,
    prepared.requestHash,
    dependencies,
    mapAgentResult(agentResult),
    disposition,
  );
}

export async function reconcileCentralUserOperation(
  request: AgentOperationRequest,
  dependencies: CentralUserManagerServiceDependencies,
): Promise<CentralUserManagerServiceResult> {
  const prepared = await prepare(request, dependencies);
  if (!prepared.ok) {
    return prepared.result;
  }
  if (prepared.claim.outcome !== "retry") {
    return failure("operation_conflict");
  }
  if (prepared.claim.status === "received") {
    return operationFromClaim(request.operationId, prepared.claim);
  }
  if (
    prepared.claim.status === "completed" ||
    prepared.claim.status === "failed_safe"
  ) {
    return operationFromClaim(request.operationId, prepared.claim);
  }

  let agentResult: AgentOperationCallResult;
  try {
    agentResult = await dependencies.sendOperation(prepared.project, request);
  } catch {
    return operationFromClaim(request.operationId, prepared.claim);
  }
  if (agentResult.kind !== "response") {
    return operationFromClaim(request.operationId, prepared.claim);
  }

  const finalization = mapAgentResult(agentResult);
  const isTerminalReconciliation =
    finalization.input.nextStatus === "completed" ||
    finalization.input.nextStatus === "failed_safe" ||
    finalization.input.nextStatus === "quarantined";
  const isRecoveredDispatchState =
    prepared.claim.status === "dispatching" &&
    (finalization.input.nextStatus === "in_progress" ||
      finalization.input.nextStatus === "needs_review");
  if (!isTerminalReconciliation && !isRecoveredDispatchState) {
    return operationFromClaim(request.operationId, prepared.claim);
  }

  let persisted = false;
  try {
    persisted = await dependencies.finalizeOperation({
      operationId: request.operationId,
      requestHash: prepared.requestHash,
      eventId: dependencies.randomUuid(),
      expectedStatus: prepared.claim.status,
      ...finalization.input,
      metadata: { disposition: "reconciled" },
    } as CentralUserFinalizationInput);
  } catch {
    persisted = false;
  }
  return persisted
    ? operationFromFinalization(request.operationId, finalization, false)
    : operationFromClaim(request.operationId, prepared.claim);
}

export async function checkCentralUserManagerHealth(
  tenantId: string,
  dependencies: CentralUserManagerHealthDependencies,
): Promise<CentralUserHealthResult> {
  let project: ActiveCustomerProject | null;
  try {
    project = await dependencies.findActiveProject(tenantId);
  } catch {
    return { ok: false, error: createSafeCentralUserError("project_unavailable") };
  }
  if (!project) {
    return { ok: false, error: createSafeCentralUserError("project_unavailable") };
  }

  let result: AgentHealthCallResult;
  try {
    result = await dependencies.getHealth(project);
  } catch {
    result = {
      kind: "failure",
      error: createSafeCentralUserError("provider_failure"),
    };
  }

  const health = result.kind === "success" ? result.data : null;
  let recorded = false;
  try {
    recorded = await dependencies.recordVerification({
      tenantId,
      tokenVersion: project.bearerTokenVersion,
      check: "health",
      succeeded: result.kind === "success",
      safeErrorCode: result.kind === "failure" ? result.error.code : null,
      health,
    });
  } catch {
    recorded = false;
  }
  if (!recorded) {
    return { ok: false, error: createSafeCentralUserError("provider_failure") };
  }
  if (result.kind === "failure") {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    health: {
      tenantId: result.data.tenantId,
      status: "healthy",
      agentVersion: result.data.agentVersion,
      schemaVersion: result.data.schemaVersion,
      authAttestationVersion: result.data.authAttestationVersion,
      authAttestationCheckedAt: result.data.authAttestationCheckedAt,
    },
  };
}

export function createCentralUserManagerServiceDependencies(
  client: SupabaseClient,
): CentralUserManagerServiceDependencies {
  return {
    findActiveProject: (tenantId) =>
      findActiveCustomerProject(client, tenantId),
    hashBinding: hashCentralOperationBinding,
    claimOperation: (binding) =>
      claimCentralUserOperation(client, binding),
    beginDispatch: (operationId, requestHash) =>
      beginCentralUserDispatch(client, operationId, requestHash),
    sendOperation: (project, request) =>
      sendAgentOperation(project, request, {
        diagnostic: logAgentOutboundDiagnostic,
      }),
    finalizeOperation: (input) =>
      finalizeCentralUserOperation(client, input),
    randomUuid: () => crypto.randomUUID(),
  };
}

export function createCentralUserManagerHealthDependencies(
  client: SupabaseClient,
): CentralUserManagerHealthDependencies {
  return {
    findActiveProject: (tenantId) =>
      findActiveCustomerProject(client, tenantId),
    getHealth: (project) =>
      getAgentHealth(project, {
        diagnostic: logAgentOutboundDiagnostic,
      }),
    recordVerification: (input) =>
      recordCustomerProjectVerification(client, input),
  };
}
