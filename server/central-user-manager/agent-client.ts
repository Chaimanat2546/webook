import "server-only";

import {
  buildAgentOperationRequest,
  parseBrowserOperationRequest,
  type AgentOperationRequest,
  type CentralUserAction,
} from "./contracts.ts";
import {
  createSafeCentralUserError,
  type SafeCentralUserError,
} from "./safe-errors.ts";
import { decryptTenantToken } from "./token-vault.ts";
import { readStoredAgentOrigin } from "./agent-origin.ts";
import type {
  ActiveCustomerProject,
  CustomerProjectHealthProof,
} from "../repositories/customer-projects.ts";
import type {
  CentralUserAgentStage,
  CentralManagedUser,
  CentralManagedUserStatus,
  CentralUserSafeResult,
} from "../repositories/user-management-operations.ts";

const HEALTH_PATH = "/api/internal/central-user-manager/v1/health";
const OPERATIONS_PATH = "/api/internal/central-user-manager/v1/operations";
const MAX_REQUEST_BYTES = 16_384;
const MAX_RESPONSE_BYTES = 65_536;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 20_000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRINTABLE_PASSWORD = /^[!-~]{20}$/;
const AGENT_STATUSES = new Set<AgentOperationStatus>([
  "completed",
  "in_progress",
  "needs_review",
  "quarantined",
]);
const USER_STATUSES = new Set<CentralManagedUserStatus>([
  "active",
  "password_change_required",
  "suspended",
  "abnormal",
]);
const PASSWORD_ACTIONS = new Set<CentralUserAction>([
  "create_user",
  "reissue_temporary_password",
  "reactivate_user",
]);
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
const AGENT_ERROR_CATALOG = {
  invalid_request: "Invalid agent operation request.",
  provider_failure: "Unable to complete request.",
  database_unavailable: "The operation database is unavailable.",
  operation_conflict: "Operation conflicts with an existing request.",
  lease_conflict: "The operation lease is owned by another request.",
  operation_quarantined: "The operation is permanently quarantined.",
  provider_ambiguous: "Provider outcome is ambiguous.",
  lease_lost: "The operation lease was lost.",
  user_exists: "An admin user already exists for this email.",
  identity_mismatch: "The Auth user and admin profile do not match.",
  profile_write_failed: "Unable to update the admin profile.",
  profile_data_invalid: "Admin profile data is invalid.",
  profile_state_conflict: "Admin profile state changed.",
  credential_version_mismatch: "Credential versions do not match.",
  create_compensated: "User creation was rolled back safely.",
} as const;
const GENERIC_AGENT_ERRORS = new Map([
  ["agent_unavailable", "Central User Manager Agent is unavailable."],
  ["health_unavailable", "Central User Manager health checks failed."],
  ["tenant_mismatch", "Tenant identity does not match."],
  ["invalid_protocol_version", "Invalid Central User Manager protocol version."],
  ["invalid_request", "Invalid agent operation request."],
  ["unsupported_content_type", "Content-Type must be application/json."],
  ["request_too_large", "Agent operation request is too large."],
  ["rate_limited", "Too many requests."],
]);

export type AgentSafeErrorCode = keyof typeof AGENT_ERROR_CATALOG;
export type AgentOperationStatus =
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined";

export interface AgentOperationResponseData {
  operationId: string;
  status: AgentOperationStatus;
  stage: CentralUserAgentStage;
  safeResult: CentralUserSafeResult | null;
  temporaryPassword?: string;
  agentErrorCode?: AgentSafeErrorCode;
}

export type AgentHealthCallResult =
  | { kind: "success"; data: CustomerProjectHealthProof }
  | { kind: "failure"; error: SafeCentralUserError };

export type AgentOperationCallResult =
  | ({ kind: "response" } & AgentOperationResponseData)
  | { kind: "failure"; error: SafeCentralUserError }
  | { kind: "ambiguous"; error: SafeCentralUserError };

export type AgentOutboundDiagnostic = {
  kind: "health" | "operation";
  stage:
    | "origin_rejected"
    | "timeout_rejected"
    | "decrypt_rejected"
    | "fetch_invoked"
    | "fetch_rejected_abort"
    | "fetch_rejected_network"
    | "fetch_rejected_daemon"
    | "fetch_rejected_cloudflare_1021"
    | "fetch_rejected_cloudflare_1024"
    | "fetch_rejected_cloudflare_1042"
    | "fetch_rejected_cache"
    | "fetch_rejected_redirect"
    | "fetch_rejected_api"
    | "fetch_rejected_type"
    | "fetch_rejected_other"
    | "response_redirect_same_origin_same_path"
    | "response_redirect_same_origin_other_path"
    | "response_redirect_cross_origin"
    | "response_redirect_invalid"
    | "response_redirect_missing"
    | "response_received";
};

const AGENT_OUTBOUND_DIAGNOSTIC_KINDS = new Set<
  AgentOutboundDiagnostic["kind"]
>(["health", "operation"]);
const AGENT_OUTBOUND_DIAGNOSTIC_STAGES = new Set<
  AgentOutboundDiagnostic["stage"]
>([
  "origin_rejected",
  "timeout_rejected",
  "decrypt_rejected",
  "fetch_invoked",
  "fetch_rejected_abort",
  "fetch_rejected_network",
  "fetch_rejected_daemon",
  "fetch_rejected_cloudflare_1021",
  "fetch_rejected_cloudflare_1024",
  "fetch_rejected_cloudflare_1042",
  "fetch_rejected_cache",
  "fetch_rejected_redirect",
  "fetch_rejected_api",
  "fetch_rejected_type",
  "fetch_rejected_other",
  "response_redirect_same_origin_same_path",
  "response_redirect_same_origin_other_path",
  "response_redirect_cross_origin",
  "response_redirect_invalid",
  "response_redirect_missing",
  "response_received",
]);

interface AgentClientDependencies {
  fetch?: typeof fetch;
  decryptToken?: (project: ActiveCustomerProject) => Promise<string>;
  timeoutMs?: number;
  diagnostic?: (event: AgentOutboundDiagnostic) => void;
}

type RawFetchResult =
  | {
      ok: true;
      response: Response;
      deadline: number;
      abort: () => void;
      finish: () => void;
    }
  | { ok: false; afterFetch: boolean };

type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function failure(code: "provider_failure" | "project_unavailable" | "invalid_request") {
  return { kind: "failure" as const, error: createSafeCentralUserError(code) };
}

function ambiguous() {
  return {
    kind: "ambiguous" as const,
    error: createSafeCentralUserError("operation_ambiguous"),
  };
}

function resolveTimeout(value: number | undefined): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > MAX_TIMEOUT_MS
  ) {
    throw new Error("Invalid Agent timeout");
  }
  return timeout;
}

function buildAgentUrl(origin: string, path: string): string {
  const trustedOrigin = readStoredAgentOrigin(origin);
  const url = new URL(path, `${trustedOrigin}/`);
  if (
    url.origin !== trustedOrigin ||
    url.pathname !== path ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Invalid Agent URL");
  }
  return url.toString();
}

function emitDiagnostic(
  dependencies: AgentClientDependencies,
  event: AgentOutboundDiagnostic,
): void {
  try {
    dependencies.diagnostic?.(event);
  } catch {
    // Diagnostics must never affect the Agent request path.
  }
}

export function logAgentOutboundDiagnostic(
  event: AgentOutboundDiagnostic,
): void {
  if (
    !AGENT_OUTBOUND_DIAGNOSTIC_KINDS.has(event.kind) ||
    !AGENT_OUTBOUND_DIAGNOSTIC_STAGES.has(event.stage)
  ) {
    return;
  }
  console.warn("cum_agent_outbound", {
    kind: event.kind,
    stage: event.stage,
  });
}

function classifyFetchRejection(
  error: unknown,
): AgentOutboundDiagnostic["stage"] {
  try {
    return classifyFetchRejectionUnsafe(error);
  } catch {
    return "fetch_rejected_other";
  }
}

function classifyFetchRejectionUnsafe(
  error: unknown,
): AgentOutboundDiagnostic["stage"] {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "fetch_rejected_abort";
  }
  const message =
    error instanceof Error ? error.message.slice(0, 2_048) : "";
  const cause =
    error instanceof Error &&
    typeof error.cause === "object" &&
    error.cause !== null
      ? error.cause
      : null;
  const causeCode =
    cause && "code" in cause ? String(cause.code) : "";
  const matchesCode = (code: string) =>
    causeCode === code || new RegExp(`(?:^|\\D)${code}(?:\\D|$)`).test(message);
  if (matchesCode("1021")) return "fetch_rejected_cloudflare_1021";
  if (matchesCode("1024")) return "fetch_rejected_cloudflare_1024";
  if (matchesCode("1042")) return "fetch_rejected_cloudflare_1042";
  if (message.includes("Network connection lost")) {
    return "fetch_rejected_network";
  }
  if (message.includes("daemonDown")) return "fetch_rejected_daemon";
  if (message.includes("Unsupported cache mode")) {
    return "fetch_rejected_cache";
  }
  if (message.toLowerCase().includes("redirect")) {
    return "fetch_rejected_redirect";
  }
  if (message.includes("Fetch API cannot load")) {
    return "fetch_rejected_api";
  }
  return error instanceof TypeError
    ? "fetch_rejected_type"
    : "fetch_rejected_other";
}

function classifyRedirectResponse(
  response: Response,
  requestUrl: string,
): AgentOutboundDiagnostic["stage"] | null {
  try {
    if (response.status < 300 || response.status > 399) return null;
    const location = response.headers.get("Location");
    if (!location) return "response_redirect_missing";
    let redirected: URL;
    try {
      redirected = new URL(location, requestUrl);
    } catch {
      return "response_redirect_invalid";
    }
    const requested = new URL(requestUrl);
    if (redirected.origin !== requested.origin) {
      return "response_redirect_cross_origin";
    }
    return redirected.pathname === requested.pathname &&
      redirected.search === requested.search
      ? "response_redirect_same_origin_same_path"
      : "response_redirect_same_origin_other_path";
  } catch {
    return "response_redirect_invalid";
  }
}

async function performFetch(
  project: ActiveCustomerProject,
  kind: AgentOutboundDiagnostic["kind"],
  path: string,
  method: "GET" | "POST",
  body: string | undefined,
  dependencies: AgentClientDependencies,
): Promise<RawFetchResult> {
  let url: string;
  let timeoutMs: number;
  let token = "";
  try {
    url = buildAgentUrl(project.agentOrigin, path);
  } catch {
    emitDiagnostic(dependencies, { kind, stage: "origin_rejected" });
    return { ok: false, afterFetch: false };
  }
  try {
    timeoutMs = resolveTimeout(dependencies.timeoutMs);
  } catch {
    emitDiagnostic(dependencies, { kind, stage: "timeout_rejected" });
    return { ok: false, afterFetch: false };
  }
  try {
    token = await (dependencies.decryptToken ?? decryptTenantToken)(project);
  } catch {
    token = "";
    emitDiagnostic(dependencies, { kind, stage: "decrypt_rejected" });
    return { ok: false, afterFetch: false };
  }

  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let afterFetch = false;
  let keepTimer = false;
  try {
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-CUM-Version": "1",
    });
    if (method === "POST") {
      headers.set("Content-Type", "application/json");
    }
    afterFetch = true;
    emitDiagnostic(dependencies, { kind, stage: "fetch_invoked" });
    const response = await (dependencies.fetch ?? globalThis.fetch)(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    emitDiagnostic(dependencies, {
      kind,
      stage:
        classifyRedirectResponse(response, url) ?? "response_received",
    });
    keepTimer = true;
    return {
      ok: true,
      response,
      deadline,
      abort() {
        controller.abort();
      },
      finish() {
        clearTimeout(timer);
      },
    };
  } catch (error) {
    emitDiagnostic(dependencies, {
      kind,
      stage: classifyFetchRejection(error),
    });
    return { ok: false, afterFetch };
  } finally {
    if (!keepTimer) {
      clearTimeout(timer);
    }
    token = "";
  }
}

function isJsonMediaType(value: string | null): boolean {
  return (
    value !== null &&
    /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(value)
  );
}

function cancelUnlockedBody(response: Response): void {
  if (response.body && !response.body.locked) {
    void response.body.cancel().catch(() => undefined);
  }
}

function rejectManualRedirect(
  fetched: Extract<RawFetchResult, { ok: true }>,
): boolean {
  if (fetched.response.status < 300 || fetched.response.status > 399) {
    return false;
  }
  cancelUnlockedBody(fetched.response);
  fetched.finish();
  return true;
}

async function readChunkBeforeDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: number,
): Promise<
  | { kind: "chunk"; value: ReadableStreamReadResult<Uint8Array> }
  | { kind: "timeout" }
> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return { kind: "timeout" };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read().then((value) => ({ kind: "chunk" as const, value })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: "timeout" }), remaining);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function readBoundedJson(
  response: Response,
  deadline: number,
  abort: () => void,
): Promise<JsonReadResult> {
  if (!isJsonMediaType(response.headers.get("Content-Type"))) {
    cancelUnlockedBody(response);
    return { ok: false };
  }

  const contentLength = response.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(contentLength)) {
      cancelUnlockedBody(response);
      return { ok: false };
    }
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > MAX_RESPONSE_BYTES) {
      cancelUnlockedBody(response);
      return { ok: false };
    }
  }

  if (!response.body) {
    return { ok: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const read = await readChunkBeforeDeadline(reader, deadline);
      if (read.kind === "timeout") {
        abort();
        void reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      const next = read.value;
      if (next.done) {
        break;
      }
      total += next.value.length;
      if (total > MAX_RESPONSE_BYTES) {
        abort();
        void reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(next.value);
    }
  } catch {
    abort();
    void reader.cancel().catch(() => undefined);
    return { ok: false };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  } finally {
    bytes.fill(0);
  }
}

function readHealthProof(
  value: unknown,
  project: ActiveCustomerProject,
): CustomerProjectHealthProof | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "tenantId",
      "protocolVersion",
      "tokenVersion",
      "projectRef",
      "agentVersion",
      "schemaVersion",
      "checks",
      "authAttestation",
    ]) ||
    !isRecord(value.checks) ||
    !hasExactKeys(value.checks, [
      "database",
      "adminUsersTable",
      "operationTables",
    ]) ||
    !isRecord(value.authAttestation) ||
    !hasExactKeys(value.authAttestation, ["version", "digest", "checkedAt"]) ||
    value.tenantId !== project.tenantId ||
    value.protocolVersion !== 1 ||
    value.tokenVersion !== project.bearerTokenVersion ||
    value.projectRef !== project.targetSupabaseProjectRef ||
    value.agentVersion !== project.expectedAgentVersion ||
    value.schemaVersion !== project.expectedSchemaVersion ||
    value.checks.database !== "ok" ||
    value.checks.adminUsersTable !== "ok" ||
    value.checks.operationTables !== "ok" ||
    value.authAttestation.version !== project.authAttestationVersion ||
    value.authAttestation.digest !== project.authAttestationDigest ||
    value.authAttestation.checkedAt !== project.authAttestationCheckedAt
  ) {
    return null;
  }
  return {
    protocolVersion: 1,
    tenantId: project.tenantId,
    projectRef: project.targetSupabaseProjectRef,
    agentVersion: project.expectedAgentVersion,
    schemaVersion: project.expectedSchemaVersion,
    authAttestationVersion: project.authAttestationVersion,
    authAttestationDigest: project.authAttestationDigest,
    authAttestationCheckedAt: project.authAttestationCheckedAt,
  };
}

function readAgentError(value: unknown): AgentSafeErrorCode | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["code", "message"]) ||
    typeof value.code !== "string" ||
    typeof value.message !== "string"
  ) {
    return null;
  }
  const expected =
    AGENT_ERROR_CATALOG[value.code as AgentSafeErrorCode];
  return expected === value.message
    ? (value.code as AgentSafeErrorCode)
    : null;
}

function readUser(value: unknown): CentralManagedUser | null {
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
    ]) ||
    typeof value.userId !== "string" ||
    !UUID.test(value.userId) ||
    typeof value.email !== "string" ||
    value.email.length > 254 ||
    value.email !== value.email.trim().toLowerCase() ||
    !EMAIL.test(value.email) ||
    typeof value.status !== "string" ||
    !USER_STATUSES.has(value.status as CentralManagedUserStatus) ||
    !(
      value.createdAt === null ||
      (typeof value.createdAt === "string" &&
        value.createdAt.length <= 64 &&
        Number.isFinite(Date.parse(value.createdAt)))
    ) ||
    !(
      value.lastSignInAt === null ||
      (typeof value.lastSignInAt === "string" &&
        value.lastSignInAt.length <= 64 &&
        Number.isFinite(Date.parse(value.lastSignInAt)))
    ) ||
    !isNullablePositiveInteger(value.credentialVersion) ||
    !isNullablePositiveInteger(value.authCredentialVersion)
  ) {
    return null;
  }
  return {
    userId: value.userId,
    email: value.email,
    status: value.status as CentralManagedUserStatus,
    createdAt: value.createdAt as string | null,
    lastSignInAt: value.lastSignInAt as string | null,
    credentialVersion: value.credentialVersion as number | null,
    authCredentialVersion: value.authCredentialVersion as number | null,
  };
}

function isNullablePositiveInteger(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= 2_147_483_647)
  );
}

function readListResult(
  value: unknown,
  request: Extract<AgentOperationRequest, { action: "list_users" }>,
): CentralUserSafeResult | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["users", "pagination"]) ||
    !Array.isArray(value.users) ||
    value.users.length > request.payload.pageSize ||
    !isRecord(value.pagination) ||
    !hasExactKeys(value.pagination, ["page", "pageSize", "hasMore"]) ||
    value.pagination.page !== request.payload.page ||
    value.pagination.pageSize !== request.payload.pageSize ||
    typeof value.pagination.hasMore !== "boolean"
  ) {
    return null;
  }
  const users: CentralManagedUser[] = [];
  for (const rawUser of value.users) {
    const user = readUser(rawUser);
    if (!user) {
      return null;
    }
    users.push(user);
  }
  return {
    users,
    pagination: {
      page: request.payload.page,
      pageSize: request.payload.pageSize,
      hasMore: value.pagination.hasMore,
    },
  };
}

function readMutationResult(
  value: unknown,
  request: Exclude<AgentOperationRequest, { action: "list_users" }>,
  agentErrorCode: AgentSafeErrorCode | undefined,
): {
  safeResult: CentralUserSafeResult;
  temporaryPassword?: string;
} | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["user"], ["temporaryPassword"])
  ) {
    return null;
  }
  const user = readUser(value.user);
  if (!user || user.email !== request.payload.email) {
    return null;
  }
  const duplicate =
    request.action === "create_user" && agentErrorCode === "user_exists";
  if (
    (duplicate &&
      !["active", "password_change_required", "suspended"].includes(
        user.status,
      )) ||
    (!duplicate &&
      request.action === "suspend_user" &&
      user.status !== "suspended") ||
    (!duplicate &&
      request.action !== "suspend_user" &&
      user.status !== "password_change_required")
  ) {
    return null;
  }

  const temporaryPassword = value.temporaryPassword;
  if (
    temporaryPassword !== undefined &&
    (typeof temporaryPassword !== "string" ||
      !PRINTABLE_PASSWORD.test(temporaryPassword) ||
      !PASSWORD_ACTIONS.has(request.action) ||
      agentErrorCode !== undefined)
  ) {
    return null;
  }
  return {
    safeResult: { user },
    ...(temporaryPassword === undefined ? {} : { temporaryPassword }),
  };
}

function readOperationEnvelope(
  value: unknown,
  request: AgentOperationRequest,
): AgentOperationResponseData | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      ["tenantId", "protocolVersion", "operationId", "status", "stage"],
      ["result", "error"],
    ) ||
    value.tenantId !== request.tenantId ||
    value.protocolVersion !== 1 ||
    value.operationId !== request.operationId ||
    typeof value.status !== "string" ||
    !AGENT_STATUSES.has(value.status as AgentOperationStatus) ||
    typeof value.stage !== "string" ||
    !AGENT_STAGES.has(value.stage as CentralUserAgentStage)
  ) {
    return null;
  }
  const status = value.status as AgentOperationStatus;
  const agentErrorCode =
    value.error === undefined ? undefined : readAgentError(value.error);
  if (value.error !== undefined && !agentErrorCode) {
    return null;
  }

  if (status !== "completed") {
    if (value.result !== undefined || agentErrorCode == null) {
      return null;
    }
    return {
      operationId: request.operationId,
      status,
      stage: value.stage as CentralUserAgentStage,
      safeResult: null,
      agentErrorCode,
    };
  }

  if (request.action === "list_users") {
    if (
      value.stage !== "listed" ||
      agentErrorCode !== undefined ||
      value.result === undefined
    ) {
      return null;
    }
    const safeResult = readListResult(value.result, request);
    return safeResult
      ? {
          operationId: request.operationId,
          status,
          stage: value.stage as CentralUserAgentStage,
          safeResult,
        }
      : null;
  }

  if (
    agentErrorCode === "create_compensated" &&
    request.action === "create_user" &&
    value.stage === "completed" &&
    value.result === undefined
  ) {
    return {
      operationId: request.operationId,
      status,
      stage: value.stage as CentralUserAgentStage,
      safeResult: null,
      agentErrorCode,
    };
  }
  if (
    value.stage !== "completed" ||
    value.result === undefined ||
    (agentErrorCode !== undefined &&
      !(request.action === "create_user" && agentErrorCode === "user_exists"))
  ) {
    return null;
  }
  const result = readMutationResult(value.result, request, agentErrorCode);
  return result
    ? {
        operationId: request.operationId,
        status,
        stage: value.stage as CentralUserAgentStage,
        safeResult: result.safeResult,
        ...(result.temporaryPassword
          ? { temporaryPassword: result.temporaryPassword }
          : {}),
        ...(agentErrorCode ? { agentErrorCode } : {}),
      }
    : null;
}

function isExactGenericError(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["error"])) {
    return false;
  }
  if (typeof value.error === "string") {
    return (
      value.error === "Invalid agent operation request." ||
      value.error === "Unable to complete request."
    );
  }
  if (
    !isRecord(value.error) ||
    !hasExactKeys(value.error, ["code", "message"]) ||
    typeof value.error.code !== "string" ||
    typeof value.error.message !== "string"
  ) {
    return false;
  }
  return GENERIC_AGENT_ERRORS.get(value.error.code) === value.error.message;
}

function buildTrustedOperationRequest(
  request: AgentOperationRequest,
): { request: AgentOperationRequest; body: string } | null {
  try {
    const browser = parseBrowserOperationRequest({
      tenantId: request.tenantId,
      operationId: request.operationId,
      action: request.action,
      payload: request.payload,
    });
    const trusted = buildAgentOperationRequest(browser, request.actorUid);
    if (
      !isRecord(request) ||
      !hasExactKeys(request, [
        "tenantId",
        "operationId",
        "actorUid",
        "action",
        "payload",
      ]) ||
      JSON.stringify(trusted) !== JSON.stringify(request)
    ) {
      return null;
    }
    const body = JSON.stringify(trusted);
    if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) {
      return null;
    }
    return { request: trusted, body };
  } catch {
    return null;
  }
}

export async function getAgentHealth(
  project: ActiveCustomerProject,
  dependencies: AgentClientDependencies = {},
): Promise<AgentHealthCallResult> {
  const fetched = await performFetch(
    project,
    "health",
    HEALTH_PATH,
    "GET",
    undefined,
    dependencies,
  );
  if (!fetched.ok) {
    return failure(
      fetched.afterFetch ? "provider_failure" : "project_unavailable",
    );
  }
  if (rejectManualRedirect(fetched)) {
    return failure("provider_failure");
  }
  let parsed: JsonReadResult;
  try {
    parsed = await readBoundedJson(
      fetched.response,
      fetched.deadline,
      fetched.abort,
    );
  } finally {
    fetched.finish();
  }
  if (!parsed.ok || !fetched.response.ok) {
    return failure("provider_failure");
  }
  const proof = readHealthProof(parsed.value, project);
  return proof
    ? { kind: "success", data: proof }
    : failure("provider_failure");
}

export async function sendAgentOperation(
  project: ActiveCustomerProject,
  request: AgentOperationRequest,
  dependencies: AgentClientDependencies = {},
): Promise<AgentOperationCallResult> {
  const trusted = buildTrustedOperationRequest(request);
  if (!trusted || trusted.request.tenantId !== project.tenantId) {
    return failure("invalid_request");
  }
  const isMutation = trusted.request.action !== "list_users";
  const fetched = await performFetch(
    project,
    "operation",
    OPERATIONS_PATH,
    "POST",
    trusted.body,
    dependencies,
  );
  if (!fetched.ok) {
    return isMutation && fetched.afterFetch
      ? ambiguous()
      : failure(
          fetched.afterFetch ? "provider_failure" : "project_unavailable",
        );
  }
  if (rejectManualRedirect(fetched)) {
    return isMutation ? ambiguous() : failure("provider_failure");
  }

  let parsed: JsonReadResult;
  try {
    parsed = await readBoundedJson(
      fetched.response,
      fetched.deadline,
      fetched.abort,
    );
  } finally {
    fetched.finish();
  }
  if (parsed.ok) {
    const envelope = readOperationEnvelope(parsed.value, trusted.request);
    if (envelope) {
      return { kind: "response", ...envelope };
    }
  }

  if (
    parsed.ok &&
    fetched.response.status >= 400 &&
    fetched.response.status < 500 &&
    isExactGenericError(parsed.value)
  ) {
    return failure(
      fetched.response.status === 401 || fetched.response.status === 403
        ? "project_unavailable"
        : fetched.response.status === 429
          ? "provider_failure"
        : "invalid_request",
    );
  }

  return isMutation ? ambiguous() : failure("provider_failure");
}
