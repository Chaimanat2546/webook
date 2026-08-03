import { normalizeCentralUserEmail, type CentralUserRpcRequest } from "./contracts.ts";

type TenantUserStatus = "active" | "password_change_required" | "suspended" | "abnormal";
type TenantUser = { userId: string; email: string; status: TenantUserStatus; createdAt: string | null; lastSignInAt: string | null; credentialVersion: number | null; authCredentialVersion: number | null };
type TenantOperationStatus = "completed" | "in_progress" | "needs_review" | "quarantined";
type TenantOperation = { operationId: string; status: TenantOperationStatus; stage: string; result?: { users?: TenantUser[]; pagination?: { page: number; pageSize: number; hasMore: boolean }; user?: TenantUser; temporaryPassword?: string }; error?: SafeTenantError };
type SafeTenantError = { code: keyof typeof SAFE_ERRORS; message: string };
export type TenantCentralUserRpcResult = { ok: true; operation: TenantOperation } | { ok: false; error: { code: "invalid_request" | "agent_unavailable"; message: string } };
export type BrowserCentralUserRpcResult = { ok: true; operation: { operationId: string; status: TenantOperationStatus; users?: Array<{ email: string; status: TenantUserStatus }>; pagination?: { page: number; pageSize: number; hasMore: boolean }; user?: { email: string; status: TenantUserStatus }; temporaryPassword?: string } } | { ok: false; error: { code: "invalid_request" | "agent_unavailable"; message: string } };

const SAFE_ERRORS = {
  invalid_request: "Invalid agent operation request.", provider_failure: "Unable to complete request.", database_unavailable: "The operation database is unavailable.", operation_conflict: "Operation conflicts with an existing request.", lease_conflict: "The operation lease is owned by another request.", operation_quarantined: "The operation is permanently quarantined.", provider_ambiguous: "Provider outcome is ambiguous.", lease_lost: "The operation lease was lost.", user_exists: "An admin user already exists for this email.", identity_mismatch: "The Auth user and admin profile do not match.", profile_write_failed: "Unable to update the admin profile.", profile_data_invalid: "Admin profile data is invalid.", profile_state_conflict: "Admin profile state changed.", credential_version_mismatch: "Credential versions do not match.", create_compensated: "User creation was rolled back safely.",
} as const;
const TOP_LEVEL_ERRORS = {
  invalid_request: "Invalid user management request.",
  agent_unavailable: "Central User Manager Agent is unavailable.",
} as const;
const SAFE_STAGES = new Set(["list", "listed", "completed", "needs_review", "quarantined", "claimed", "late_fence", "provider_intent", "provider_outcome", "profile_created", "profile_advanced", "profile_activated", "auth_create_intent", "auth_create_succeeded", "auth_create_rejected", "auth_delete_intent", "auth_delete_succeeded", "auth_delete_rejected", "auth_update_intent", "auth_update_succeeded", "auth_update_rejected", "password_verify_intent", "password_verify_succeeded", "password_verify_rejected", "global_signout_intent", "global_signout_succeeded", "global_signout_rejected", "compensation_ready"]);
const SAFE_STATUSES = new Set<TenantOperationStatus>(["completed", "in_progress", "needs_review", "quarantined"]);
const PASSWORD_ACTIONS = new Set(["create_user", "reissue_temporary_password", "reactivate_user"]);
const TEMPORARY_PASSWORD = /^[!-~]{20}$/;

const safeError = (): TenantCentralUserRpcResult => ({ ok: false, error: { code: "agent_unavailable", message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } });
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key));
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const timestamp = (value: unknown): value is string | null => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
const positive = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);

function user(value: unknown): value is TenantUser {
  if (!record(value) || !keys(value, ["userId", "email", "status", "createdAt", "lastSignInAt", "credentialVersion", "authCredentialVersion"]) || !uuid(value.userId) || typeof value.email !== "string" || !["active", "password_change_required", "suspended", "abnormal"].includes(value.status as string) || !timestamp(value.createdAt) || !timestamp(value.lastSignInAt) || !positive(value.credentialVersion) || !positive(value.authCredentialVersion)) return false;
  try { return normalizeCentralUserEmail(value.email) === value.email; } catch { return false; }
}

function parseSafeTenantError(value: unknown): SafeTenantError | null {
  if (!record(value) || !keys(value, ["code", "message"]) || typeof value.code !== "string" || typeof value.message !== "string" || !(value.code in SAFE_ERRORS)) return null;
  const code = value.code as keyof typeof SAFE_ERRORS;
  return value.message === SAFE_ERRORS[code] ? { code, message: SAFE_ERRORS[code] } : null;
}

function parseTopLevelError(value: unknown): "invalid_request" | "agent_unavailable" | null {
  if (!record(value) || !keys(value, ["code", "message"]) || typeof value.code !== "string" || typeof value.message !== "string" || !(value.code in TOP_LEVEL_ERRORS)) return null;
  const code = value.code as keyof typeof TOP_LEVEL_ERRORS;
  return value.message === TOP_LEVEL_ERRORS[code] ? code : null;
}

function parseListResult(value: unknown, request: CentralUserRpcRequest): boolean {
  return request.action === "list_users" && record(value) && keys(value, ["users", "pagination"]) && Array.isArray(value.users) && value.users.length <= request.payload.pageSize && value.users.every(user) && record(value.pagination) && keys(value.pagination, ["page", "pageSize", "hasMore"]) && value.pagination.page === request.payload.page && value.pagination.pageSize === request.payload.pageSize && typeof value.pagination.hasMore === "boolean";
}

function parseMutationResult(value: unknown, request: CentralUserRpcRequest, error: SafeTenantError | undefined): boolean {
  if (request.action === "list_users" || !record(value) || !keys(value, value.temporaryPassword === undefined ? ["user"] : ["user", "temporaryPassword"]) || !user(value.user) || value.user.email !== request.payload.email) return false;
  const duplicateCreate = request.action === "create_user" && error?.code === "user_exists";
  const expectedStatus = request.action === "suspend_user" ? "suspended" : "password_change_required";
  if (duplicateCreate ? !["active", "password_change_required", "suspended"].includes(value.user.status) : value.user.status !== expectedStatus) return false;
  return value.temporaryPassword === undefined || (error === undefined && typeof value.temporaryPassword === "string" && PASSWORD_ACTIONS.has(request.action) && TEMPORARY_PASSWORD.test(value.temporaryPassword));
}

export function parseTenantCentralUserRpcResult(value: unknown, request: CentralUserRpcRequest): TenantCentralUserRpcResult {
  if (!record(value) || !keys(value, value.ok === true ? ["ok", "operation"] : ["ok", "error"])) return safeError();
  if (value.ok === false) {
    const code = parseTopLevelError(value.error);
    return code ? { ok: false, error: { code, message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } } : safeError();
  }
  if (value.ok !== true || !record(value.operation)) return safeError();
  const operation = value.operation;
  const operationKeys = ["operationId", "status", "stage", ...(operation.result === undefined ? [] : ["result"]), ...(operation.error === undefined ? [] : ["error"])];
  if (!keys(operation, operationKeys) || operation.operationId !== request.operationId || !SAFE_STATUSES.has(operation.status as TenantOperationStatus) || typeof operation.stage !== "string" || !SAFE_STAGES.has(operation.stage)) return safeError();
  const parsedError = operation.error === undefined ? undefined : parseSafeTenantError(operation.error);
  if (operation.error !== undefined && parsedError === null) return safeError();
  const error = parsedError ?? undefined;
  if (operation.result !== undefined && !record(operation.result)) return safeError();
  const status = operation.status as TenantOperationStatus;
  if (status !== "completed") return operation.result === undefined && error ? { ok: true, operation: { operationId: request.operationId, status, stage: operation.stage, error } } : safeError();
  if (operation.stage !== (request.action === "list_users" ? "listed" : "completed")) return safeError();
  if (request.action === "list_users") return error === undefined && parseListResult(operation.result, request) ? { ok: true, operation: operation as TenantOperation } : safeError();
  if (error?.code === "create_compensated") return request.action === "create_user" && operation.result === undefined ? { ok: true, operation: { operationId: request.operationId, status, stage: operation.stage, error } } : safeError();
  if (error !== undefined && !(request.action === "create_user" && error.code === "user_exists")) return safeError();
  return parseMutationResult(operation.result, request, error) ? { ok: true, operation: operation as TenantOperation } : safeError();
}

export function projectBrowserCentralUserResult(result: TenantCentralUserRpcResult): BrowserCentralUserRpcResult {
  if (!result.ok) return result;
  const { operation } = result;
  const base = { operationId: operation.operationId, status: operation.status };
  if (!operation.result) return { ok: true, operation: base };
  if (operation.result.users && operation.result.pagination) return { ok: true, operation: { ...base, users: operation.result.users.map(({ email, status }) => ({ email, status })), pagination: operation.result.pagination } };
  if (operation.result.user) return { ok: true, operation: { ...base, user: { email: operation.result.user.email, status: operation.result.user.status }, ...(operation.result.temporaryPassword ? { temporaryPassword: operation.result.temporaryPassword } : {}) } };
  return { ok: true, operation: base };
}
