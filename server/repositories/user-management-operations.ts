import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CentralUserAction,
} from "../central-user-manager/contracts.ts";
import {
  SAFE_CENTRAL_USER_ERROR_CATALOG,
  type SafeCentralUserErrorCode,
} from "../central-user-manager/safe-errors.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const SAFE_CODE = /^[a-z0-9_]{1,64}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SQL_INTEGER = 2_147_483_647;
const OPERATION_STATUSES = new Set<CentralUserOperationStatus>([
  "received",
  "dispatching",
  "completed",
  "in_progress",
  "needs_review",
  "quarantined",
  "failed_safe",
]);
const USER_STATUSES = new Set<CentralManagedUserStatus>([
  "active",
  "password_change_required",
  "suspended",
  "abnormal",
]);
const ACTIONS = new Set<CentralUserAction>([
  "list_users",
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
]);
const SAFE_ERROR_CODES = new Set<SafeCentralUserErrorCode>(
  Object.keys(
    SAFE_CENTRAL_USER_ERROR_CATALOG,
  ) as SafeCentralUserErrorCode[],
);
const AGENT_STAGES = new Set<CentralUserAgentStage>([
  "list",
  "listed",
  "claimed",
  "completed",
  "needs_review",
  "quarantined",
  "late_fence",
  "provider_intent",
  "provider_outcome",
  "profile_created",
  "compensation_ready",
  "profile_advanced",
  "profile_activated",
  "auth_create_intent",
  "auth_create_succeeded",
  "auth_create_rejected",
  "auth_delete_intent",
  "auth_delete_succeeded",
  "auth_delete_rejected",
  "auth_update_intent",
  "auth_update_succeeded",
  "auth_update_rejected",
  "password_verify_intent",
  "password_verify_succeeded",
  "password_verify_rejected",
  "global_signout_intent",
  "global_signout_succeeded",
  "global_signout_rejected",
]);

export type CentralUserOperationStatus =
  | "received"
  | "dispatching"
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined"
  | "failed_safe";

export type CentralManagedUserStatus =
  | "active"
  | "password_change_required"
  | "suspended"
  | "abnormal";

export type CentralUserAgentStage =
  | "list"
  | "listed"
  | "claimed"
  | "completed"
  | "needs_review"
  | "quarantined"
  | "late_fence"
  | "provider_intent"
  | "provider_outcome"
  | "profile_created"
  | "compensation_ready"
  | "profile_advanced"
  | "profile_activated"
  | "auth_create_intent"
  | "auth_create_succeeded"
  | "auth_create_rejected"
  | "auth_delete_intent"
  | "auth_delete_succeeded"
  | "auth_delete_rejected"
  | "auth_update_intent"
  | "auth_update_succeeded"
  | "auth_update_rejected"
  | "password_verify_intent"
  | "password_verify_succeeded"
  | "password_verify_rejected"
  | "global_signout_intent"
  | "global_signout_succeeded"
  | "global_signout_rejected";

export interface CentralManagedUser {
  userId: string;
  email: string;
  status: CentralManagedUserStatus;
  createdAt: string | null;
  lastSignInAt: string | null;
  credentialVersion: number | null;
  authCredentialVersion: number | null;
}

export type CentralUserSafeResult =
  | { user: CentralManagedUser }
  | {
      users: CentralManagedUser[];
      pagination: { page: number; pageSize: number; hasMore: boolean };
    };

export interface CentralUserOperationBinding {
  operationId: string;
  tenantId: string;
  actorUid: string;
  action: CentralUserAction;
  targetEmailNormalized: string | null;
  requestHash: string;
}

export type CentralUserFinalizationInput = {
  operationId: string;
  requestHash: string;
  eventId: string;
  expectedStatus:
    | "dispatching"
    | "in_progress"
    | "needs_review"
    | "quarantined";
  agentStage: CentralUserAgentStage | null;
  metadata: {
    disposition: "first" | "retry" | "reconciled";
  } | null;
} & (
  | {
      nextStatus: "completed";
      safeResult: CentralUserSafeResult;
      safeErrorCode: "operation_conflict" | null;
    }
  | {
      nextStatus:
        | "failed_safe"
        | "in_progress"
        | "needs_review"
        | "quarantined";
      safeResult: null;
      safeErrorCode: SafeCentralUserErrorCode;
    }
);

export type CentralUserOperationClaim =
  | { outcome: "claimed"; status: "received" }
  | {
      outcome: "retry";
      status: CentralUserOperationStatus;
      agentStage: CentralUserAgentStage | null;
      safeResult: CentralUserSafeResult | null;
      safeErrorCode: SafeCentralUserErrorCode | null;
    };

export class CentralUserOperationRepositoryError extends Error {
  constructor() {
    super("Central User Manager operation repository failed");
    this.name = "CentralUserOperationRepositoryError";
  }
}

export class CentralUserOperationConflictError extends Error {
  readonly code = "operation_conflict";

  constructor() {
    super("Central User Manager operation conflicts with an existing request");
    this.name = "CentralUserOperationConflictError";
  }
}

function repositoryFailure(): never {
  throw new CentralUserOperationRepositoryError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => keys.includes(key))
  );
}

function readString(value: unknown, pattern: RegExp, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    !pattern.test(value)
  ) {
    return repositoryFailure();
  }
  return value;
}

function readUuid(value: unknown): string {
  return readString(value, UUID, 36);
}

function readHash(value: unknown): string {
  return readString(value, HASH, 64);
}

function readSafeCode(value: unknown): SafeCentralUserErrorCode | null {
  if (value === null) {
    return null;
  }
  const code = readString(value, SAFE_CODE, 64) as SafeCentralUserErrorCode;
  if (!SAFE_ERROR_CODES.has(code)) {
    return repositoryFailure();
  }
  return code;
}

function readTimestamp(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  ) {
    return repositoryFailure();
  }
  return value;
}

function readNullablePositiveInteger(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_SQL_INTEGER
  ) {
    return repositoryFailure();
  }
  return value;
}

function readManagedUser(value: unknown): CentralManagedUser {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "userId",
      "email",
      "status",
      "createdAt",
      "lastSignInAt",
      "credentialVersion",
      "authCredentialVersion",
    ])
  ) {
    return repositoryFailure();
  }

  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  if (
    email !== value.email ||
    email.length > 254 ||
    !SIMPLE_EMAIL.test(email)
  ) {
    return repositoryFailure();
  }

  if (
    typeof value.status !== "string" ||
    !USER_STATUSES.has(value.status as CentralManagedUserStatus)
  ) {
    return repositoryFailure();
  }

  return {
    userId: readUuid(value.userId),
    email,
    status: value.status as CentralManagedUserStatus,
    createdAt: readTimestamp(value.createdAt),
    lastSignInAt: readTimestamp(value.lastSignInAt),
    credentialVersion: readNullablePositiveInteger(value.credentialVersion),
    authCredentialVersion: readNullablePositiveInteger(
      value.authCredentialVersion,
    ),
  };
}

function readSafeResult(value: unknown): CentralUserSafeResult | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return repositoryFailure();
  }

  if (hasExactKeys(value, ["user"])) {
    return { user: readManagedUser(value.user) };
  }

  if (
    hasExactKeys(value, ["users", "pagination"]) &&
    Array.isArray(value.users) &&
    value.users.length <= 100 &&
    isRecord(value.pagination) &&
    hasExactKeys(value.pagination, ["page", "pageSize", "hasMore"])
  ) {
    const { page, pageSize, hasMore } = value.pagination;
    if (
      typeof page !== "number" ||
      typeof pageSize !== "number" ||
      !Number.isInteger(page) ||
      !Number.isInteger(pageSize) ||
      page < 1 ||
      page > 100 ||
      pageSize < 1 ||
      pageSize > 100 ||
      typeof hasMore !== "boolean"
    ) {
      return repositoryFailure();
    }
    return {
      users: value.users.map(readManagedUser),
      pagination: { page, pageSize, hasMore },
    };
  }

  return repositoryFailure();
}

function readOperationStatus(value: unknown): CentralUserOperationStatus {
  if (
    typeof value !== "string" ||
    !OPERATION_STATUSES.has(value as CentralUserOperationStatus)
  ) {
    return repositoryFailure();
  }
  return value as CentralUserOperationStatus;
}

function readAgentStage(value: unknown): CentralUserAgentStage | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "string" ||
    !AGENT_STAGES.has(value as CentralUserAgentStage)
  ) {
    return repositoryFailure();
  }
  return value as CentralUserAgentStage;
}

function throwRpcError(error: unknown): void {
  if (!error) {
    return;
  }
  if (
    isRecord(error) &&
    error.code === "23505" &&
    typeof error.message === "string" &&
    error.message.includes("central_user_operation_id_conflict")
  ) {
    throw new CentralUserOperationConflictError();
  }
  repositoryFailure();
}

async function runAdapterCall<T>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    return repositoryFailure();
  }
}

async function callBooleanRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await runAdapterCall(() => client.rpc(name, args));
  throwRpcError(error);
  if (typeof data !== "boolean") {
    return repositoryFailure();
  }
  return data;
}

export async function claimCentralUserOperation(
  client: SupabaseClient,
  binding: CentralUserOperationBinding,
): Promise<CentralUserOperationClaim> {
  if (!ACTIONS.has(binding.action)) {
    return repositoryFailure();
  }
  const targetEmail =
    binding.targetEmailNormalized === null
      ? null
      : readString(binding.targetEmailNormalized, SIMPLE_EMAIL, 254);
  if (
    (binding.action === "list_users" && targetEmail !== null) ||
    (binding.action !== "list_users" && targetEmail === null)
  ) {
    return repositoryFailure();
  }
  const args = {
    p_operation_id: readUuid(binding.operationId),
    p_tenant_id: readUuid(binding.tenantId),
    p_actor_uid: readUuid(binding.actorUid),
    p_action: binding.action,
    p_target_email_normalized: targetEmail,
    p_request_hash: readHash(binding.requestHash),
  };
  const { data, error } = await runAdapterCall(() =>
    client.rpc("claim_central_user_operation", args),
  );

  throwRpcError(error);
  if (!isRecord(data)) {
    return repositoryFailure();
  }
  if (
    data.outcome === "claimed" &&
    data.status === "received" &&
    hasExactKeys(data, ["outcome", "status"])
  ) {
    return { outcome: "claimed", status: "received" };
  }
  if (
    data.outcome === "retry" &&
    hasExactKeys(data, [
      "outcome",
      "status",
      "agentStage",
      "safeResult",
      "safeErrorCode",
    ])
  ) {
    return {
      outcome: "retry",
      status: readOperationStatus(data.status),
      agentStage: readAgentStage(data.agentStage),
      safeResult: readSafeResult(data.safeResult),
      safeErrorCode: readSafeCode(data.safeErrorCode),
    };
  }
  return repositoryFailure();
}

export function beginCentralUserDispatch(
  client: SupabaseClient,
  operationId: string,
  requestHash: string,
): Promise<boolean> {
  return callBooleanRpc(client, "begin_central_user_dispatch", {
    p_operation_id: readUuid(operationId),
    p_request_hash: readHash(requestHash),
  });
}

export function finalizeCentralUserOperation(
  client: SupabaseClient,
  input: CentralUserFinalizationInput,
): Promise<boolean> {
  const safeResult = readSafeResult(input.safeResult);
  const safeErrorCode = readSafeCode(input.safeErrorCode);
  const agentStage = readAgentStage(input.agentStage);
  const validExpectedTransition =
    (input.expectedStatus === "dispatching" &&
      [
        "completed",
        "failed_safe",
        "in_progress",
        "needs_review",
        "quarantined",
      ].includes(input.nextStatus)) ||
    (["in_progress", "needs_review", "quarantined"].includes(
      input.expectedStatus,
    ) &&
      ["completed", "failed_safe", "quarantined"].includes(
        input.nextStatus,
      ));
  const validTerminalState =
    (input.nextStatus === "completed" &&
      safeResult !== null &&
      agentStage !== null &&
      (safeErrorCode === null || safeErrorCode === "operation_conflict")) ||
    (input.nextStatus !== "completed" &&
      safeResult === null &&
      safeErrorCode !== null);
  const metadata = input.metadata;
  const validMetadata =
    metadata === null ||
    (isRecord(metadata) &&
      hasExactKeys(metadata, ["disposition"]) &&
      (metadata.disposition === "first" ||
        metadata.disposition === "retry" ||
        metadata.disposition === "reconciled"));
  if (
    !validTerminalState ||
    !validExpectedTransition ||
    !validMetadata
  ) {
    return repositoryFailure();
  }
  return callBooleanRpc(client, "finalize_central_user_operation", {
    p_operation_id: readUuid(input.operationId),
    p_request_hash: readHash(input.requestHash),
    p_expected_status: input.expectedStatus,
    p_next_status: input.nextStatus,
    p_agent_stage: agentStage,
    p_safe_result: safeResult,
    p_safe_error_code: safeErrorCode,
    p_event_id: readUuid(input.eventId),
    p_metadata: metadata,
  });
}
