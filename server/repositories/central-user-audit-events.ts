import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SAFE_CENTRAL_USER_ERROR_CATALOG,
  type SafeCentralUserErrorCode,
} from "../central-user-manager/safe-errors.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_CODE = /^[a-z0-9_]{1,64}$/;
const MAX_SQL_INTEGER = 2_147_483_647;
const MAX_METADATA_BYTES = 16_384;
const ACTIONS = new Set<CentralUserAuditAction>([
  "list_users",
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
  "register_project",
  "verify_project",
  "activate_project",
  "deactivate_project",
  "rotate_token",
  "rotate_kek",
  "reconcile_operation",
]);
const OUTCOMES = new Set<CentralUserAuditOutcome>([
  "received",
  "dispatching",
  "completed",
  "in_progress",
  "needs_review",
  "quarantined",
  "failed_safe",
  "succeeded",
  "failed",
  "retry",
  "conflict",
]);
const METADATA_KEYS = new Set([
  "stage",
  "status",
  "tokenVersion",
  "agentVersion",
  "schemaVersion",
  "healthStatus",
  "page",
  "pageSize",
  "hasMore",
  "disposition",
]);
const SAFE_ERROR_CODES = new Set<SafeCentralUserErrorCode>(
  Object.keys(
    SAFE_CENTRAL_USER_ERROR_CATALOG,
  ) as SafeCentralUserErrorCode[],
);

export type CentralUserAuditAction =
  | "list_users"
  | "create_user"
  | "reissue_temporary_password"
  | "suspend_user"
  | "reactivate_user"
  | "register_project"
  | "verify_project"
  | "activate_project"
  | "deactivate_project"
  | "rotate_token"
  | "rotate_kek"
  | "reconcile_operation";

export type CentralUserAuditOutcome =
  | "received"
  | "dispatching"
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined"
  | "failed_safe"
  | "succeeded"
  | "failed"
  | "retry"
  | "conflict";

export interface CentralUserAuditMetadata {
  stage?: string;
  status?: string;
  tokenVersion?: number;
  agentVersion?: string;
  schemaVersion?: string;
  healthStatus?: "unknown" | "healthy" | "unhealthy";
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  disposition?: "first" | "retry" | "reconciled";
}

export interface CentralUserAuditEventInput {
  eventId: string;
  operationId: string | null;
  tenantId: string;
  actorUid: string;
  action: CentralUserAuditAction;
  outcome: CentralUserAuditOutcome;
  safeErrorCode: SafeCentralUserErrorCode | null;
  requestHash: string | null;
  metadata: CentralUserAuditMetadata | null;
}

export class CentralUserAuditInputError extends Error {
  constructor() {
    super("Central User Manager audit input is invalid");
    this.name = "CentralUserAuditInputError";
  }
}

export class CentralUserAuditRepositoryError extends Error {
  constructor() {
    super("Central User Manager audit repository failed");
    this.name = "CentralUserAuditRepositoryError";
  }
}

function invalidInput(): never {
  throw new CentralUserAuditInputError();
}

function repositoryFailure(): never {
  throw new CentralUserAuditRepositoryError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, pattern: RegExp, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    !pattern.test(value)
  ) {
    return invalidInput();
  }
  return value;
}

function readUuid(value: unknown): string {
  return readString(value, UUID, 36);
}

function readNullableUuid(value: unknown): string | null {
  return value === null ? null : readUuid(value);
}

function readNullableSafeCode(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  const code = readString(value, SAFE_CODE, 64) as SafeCentralUserErrorCode;
  if (!SAFE_ERROR_CODES.has(code)) {
    return invalidInput();
  }
  return code;
}

function readNullableHash(value: unknown): string | null {
  return value === null ? null : readString(value, HASH, 64);
}

function readBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return invalidInput();
  }
  return value;
}

function readMetadata(value: unknown): CentralUserAuditMetadata | null {
  if (value === null) {
    return null;
  }
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !METADATA_KEYS.has(key))
  ) {
    return invalidInput();
  }

  const metadata: CentralUserAuditMetadata = {};
  if (value.stage !== undefined) {
    metadata.stage = readString(value.stage, SAFE_CODE, 64);
  }
  if (value.status !== undefined) {
    metadata.status = readString(value.status, SAFE_CODE, 64);
  }
  if (value.tokenVersion !== undefined) {
    metadata.tokenVersion = readBoundedInteger(
      value.tokenVersion,
      1,
      MAX_SQL_INTEGER,
    );
  }
  if (value.agentVersion !== undefined) {
    metadata.agentVersion = readString(value.agentVersion, SAFE_TEXT, 64);
  }
  if (value.schemaVersion !== undefined) {
    metadata.schemaVersion = readString(value.schemaVersion, SAFE_TEXT, 64);
  }
  if (value.healthStatus !== undefined) {
    if (
      value.healthStatus !== "unknown" &&
      value.healthStatus !== "healthy" &&
      value.healthStatus !== "unhealthy"
    ) {
      return invalidInput();
    }
    metadata.healthStatus = value.healthStatus;
  }
  if (value.page !== undefined) {
    metadata.page = readBoundedInteger(value.page, 1, 100);
  }
  if (value.pageSize !== undefined) {
    metadata.pageSize = readBoundedInteger(value.pageSize, 1, 100);
  }
  if (value.hasMore !== undefined) {
    if (typeof value.hasMore !== "boolean") {
      return invalidInput();
    }
    metadata.hasMore = value.hasMore;
  }
  if (value.disposition !== undefined) {
    if (
      value.disposition !== "first" &&
      value.disposition !== "retry" &&
      value.disposition !== "reconciled"
    ) {
      return invalidInput();
    }
    metadata.disposition = value.disposition;
  }

  if (new TextEncoder().encode(JSON.stringify(metadata)).length > MAX_METADATA_BYTES) {
    return invalidInput();
  }
  return metadata;
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

export async function appendCentralUserAuditEvent(
  client: SupabaseClient,
  input: CentralUserAuditEventInput,
): Promise<string> {
  if (!ACTIONS.has(input.action) || !OUTCOMES.has(input.outcome)) {
    return invalidInput();
  }

  const eventId = readUuid(input.eventId);
  const args = {
    p_event_id: eventId,
    p_operation_id: readNullableUuid(input.operationId),
    p_tenant_id: readUuid(input.tenantId),
    p_actor_uid: readUuid(input.actorUid),
    p_action: input.action,
    p_outcome: input.outcome,
    p_safe_error_code: readNullableSafeCode(input.safeErrorCode),
    p_request_hash: readNullableHash(input.requestHash),
    p_metadata: readMetadata(input.metadata),
  };
  const { data, error } = await runAdapterCall(() =>
    client.rpc("append_central_user_audit_event", args),
  );

  if (error || data !== eventId) {
    return repositoryFailure();
  }
  return eventId;
}
