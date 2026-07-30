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

type CentralUserReconciliationInput = {
  operationId: string;
  requestHash: string;
  expectedStatus: "in_progress" | "needs_review" | "quarantined";
} & (
  | {
      nextStatus: "completed";
      safeResult: CentralUserSafeResult;
      safeErrorCode: null;
    }
  | {
      nextStatus: "failed_safe" | "quarantined";
      safeResult: null;
      safeErrorCode: SafeCentralUserErrorCode;
    }
);

export type CentralUserOperationClaim =
  | { outcome: "claimed"; status: "received" }
  | {
      outcome: "retry";
      status: CentralUserOperationStatus;
      safeResult: CentralUserSafeResult | null;
      safeErrorCode: string | null;
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

function readSafeCode(value: unknown): string | null {
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
      "safeResult",
      "safeErrorCode",
    ])
  ) {
    return {
      outcome: "retry",
      status: readOperationStatus(data.status),
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

export function completeCentralUserOperation(
  client: SupabaseClient,
  operationId: string,
  requestHash: string,
  safeResult: CentralUserSafeResult,
): Promise<boolean> {
  const trustedSafeResult = readSafeResult(safeResult);
  if (trustedSafeResult === null) {
    return repositoryFailure();
  }
  return callBooleanRpc(client, "complete_central_user_operation", {
    p_operation_id: readUuid(operationId),
    p_request_hash: readHash(requestHash),
    p_safe_result: trustedSafeResult,
  });
}

export function markCentralUserOperationAmbiguous(
  client: SupabaseClient,
  operationId: string,
  requestHash: string,
  status: "in_progress" | "needs_review" | "quarantined",
  safeErrorCode: SafeCentralUserErrorCode,
): Promise<boolean> {
  return callBooleanRpc(client, "mark_central_user_operation_ambiguous", {
    p_operation_id: readUuid(operationId),
    p_request_hash: readHash(requestHash),
    p_status: status,
    p_safe_error_code: readSafeCode(safeErrorCode),
  });
}

export function reconcileCentralUserOperation(
  client: SupabaseClient,
  input: CentralUserReconciliationInput,
): Promise<boolean> {
  const safeResult = readSafeResult(input.safeResult);
  const safeErrorCode = readSafeCode(input.safeErrorCode);
  const validTerminalState =
    (input.nextStatus === "completed" &&
      safeResult !== null &&
      safeErrorCode === null) ||
    ((input.nextStatus === "failed_safe" ||
      input.nextStatus === "quarantined") &&
      safeResult === null &&
      safeErrorCode !== null);
  if (
    !validTerminalState ||
    !["in_progress", "needs_review", "quarantined"].includes(
      input.expectedStatus,
    )
  ) {
    return repositoryFailure();
  }
  return callBooleanRpc(client, "reconcile_central_user_operation", {
    p_operation_id: readUuid(input.operationId),
    p_request_hash: readHash(input.requestHash),
    p_expected_status: input.expectedStatus,
    p_next_status: input.nextStatus,
    p_safe_result: safeResult,
    p_safe_error_code: safeErrorCode,
  });
}
