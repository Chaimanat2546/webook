import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readStoredAgentOrigin } from "../central-user-manager/agent-origin.ts";
import type { EncryptedTenantToken } from "../central-user-manager/token-vault.ts";

const SAFE_PROJECT_COLUMNS = [
  "id",
  "display_name",
  "is_active",
  "last_verified_token_version",
  "last_health_checked_at",
  "last_list_users_checked_at",
  "created_at",
  "updated_at",
  "expected_agent_version",
  "expected_schema_version",
  "auth_attestation_version",
  "auth_attestation_checked_at",
  "last_health_status",
  "last_health_safe_error",
  "last_health_agent_version",
  "last_health_schema_version",
  "last_health_auth_attestation_version",
  "last_health_auth_attestation_checked_at",
].join(",");

const ACTIVE_PROJECT_COLUMNS = [
  "id",
  "target_supabase_project_ref",
  "agent_origin",
  "wrangler_environment",
  "bearer_token_ciphertext",
  "bearer_token_iv",
  "bearer_token_version",
  "bearer_token_kek_version",
  "bearer_token_fingerprint",
  "expected_agent_version",
  "expected_schema_version",
  "auth_attestation_version",
  "auth_attestation_digest",
  "auth_attestation_checked_at",
].join(",");
const PROVISIONING_PROJECT_COLUMNS = [
  "id",
  "display_name",
  "is_active",
  "provisioning_state",
  ACTIVE_PROJECT_COLUMNS.split(",").slice(1).join(","),
].join(",");

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const WRANGLER_ENVIRONMENT = /^[A-Za-z0-9_-]{1,64}$/;
const BASE64URL_CIPHERTEXT = /^[A-Za-z0-9_-]{64}$/;
const BASE64URL_IV = /^[A-Za-z0-9_-]{16}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const SAFE_ERROR_CODE = /^[a-z0-9_]{1,64}$/;
const MAX_SQL_INTEGER = 2_147_483_647;

export type CustomerProjectHealthStatus =
  | "unknown"
  | "healthy"
  | "unhealthy";

export interface SafeCustomerProject {
  id: string;
  displayName: string;
  isActive: boolean;
  lastVerifiedTokenVersion: number | null;
  lastHealthCheckedAt: string | null;
  lastListUsersCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expectedAgentVersion: string | null;
  expectedSchemaVersion: string | null;
  authAttestationVersion: string | null;
  authAttestationCheckedAt: string | null;
  lastHealthStatus: CustomerProjectHealthStatus;
  lastHealthSafeError: string | null;
  lastHealthAgentVersion: string | null;
  lastHealthSchemaVersion: string | null;
  lastHealthAuthAttestationVersion: string | null;
  lastHealthAuthAttestationCheckedAt: string | null;
}

export interface ActiveCustomerProject extends EncryptedTenantToken {
  targetSupabaseProjectRef: string;
  agentOrigin: string;
  wranglerEnvironment: string;
  expectedAgentVersion: string;
  expectedSchemaVersion: string;
  authAttestationVersion: string;
  authAttestationDigest: string;
  authAttestationCheckedAt: string;
}

export interface ProvisioningCustomerProject {
  tenantId: string;
  displayName: string;
  isActive: boolean;
  provisioningState:
    | "registered"
    | "rotation_gated"
    | "token_stored"
    | "completed"
    | null;
  targetSupabaseProjectRef: string;
  agentOrigin: string;
  wranglerEnvironment: string;
  expectedAgentVersion: string;
  expectedSchemaVersion: string;
  authAttestationVersion: string;
  authAttestationDigest: string;
  authAttestationCheckedAt: string;
  encryptedToken: EncryptedTenantToken | null;
}

export interface CustomerProjectRegistration {
  tenantId: string;
  displayName: string;
  targetSupabaseProjectRef: string;
  agentOrigin: string;
  wranglerEnvironment: string;
  expectedAgentVersion: string;
  expectedSchemaVersion: string;
  authAttestationVersion: string;
  authAttestationDigest: string;
  authAttestationCheckedAt: string;
}

export interface CustomerProjectHealthProof {
  protocolVersion: 1;
  tenantId: string;
  projectRef: string;
  agentVersion: string;
  schemaVersion: string;
  authAttestationVersion: string;
  authAttestationDigest: string;
  authAttestationCheckedAt: string;
}

export interface CustomerProjectTokenRotationGate {
  failedSafeCount: number;
  quarantinedCount: number;
  remainingDispatchableCount: 0;
}

export class CentralUserManagerProjectRepositoryError extends Error {
  constructor() {
    super("Central User Manager project repository failed");
    this.name = "CentralUserManagerProjectRepositoryError";
  }
}

function repositoryFailure(): never {
  throw new CentralUserManagerProjectRepositoryError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: unknown,
  pattern: RegExp,
  maximumLength = Number.POSITIVE_INFINITY,
): string {
  if (
    typeof value !== "string" ||
    value.length > maximumLength ||
    !pattern.test(value)
  ) {
    return repositoryFailure();
  }
  return value;
}

function readTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  ) {
    return repositoryFailure();
  }
  return value;
}

function readNullableTimestamp(value: unknown): string | null {
  return value === null ? null : readTimestamp(value);
}

function readPositiveVersion(value: unknown): number {
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

function readNullableVersion(value: unknown): number | null {
  return value === null ? null : readPositiveVersion(value);
}

function readSafeErrorCode(value: unknown): string | null {
  return value === null ? null : readString(value, SAFE_ERROR_CODE);
}

function readNullableVersionText(value: unknown): string | null {
  return value === null ? null : readString(value, VERSION);
}

function readDisplayName(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 120 ||
    value.trim() !== value
  ) {
    return repositoryFailure();
  }
  return value;
}

function readSafeProject(value: unknown): SafeCustomerProject {
  if (!isRecord(value)) {
    return repositoryFailure();
  }

  const healthStatus = value.last_health_status;
  if (
    healthStatus !== "unknown" &&
    healthStatus !== "healthy" &&
    healthStatus !== "unhealthy"
  ) {
    return repositoryFailure();
  }

  return {
    id: readString(value.id, UUID),
    displayName: readDisplayName(value.display_name),
    isActive:
      typeof value.is_active === "boolean"
        ? value.is_active
        : repositoryFailure(),
    lastVerifiedTokenVersion: readNullableVersion(
      value.last_verified_token_version,
    ),
    lastHealthCheckedAt: readNullableTimestamp(value.last_health_checked_at),
    lastListUsersCheckedAt: readNullableTimestamp(
      value.last_list_users_checked_at,
    ),
    createdAt: readTimestamp(value.created_at),
    updatedAt: readTimestamp(value.updated_at),
    expectedAgentVersion: readNullableVersionText(
      value.expected_agent_version,
    ),
    expectedSchemaVersion: readNullableVersionText(
      value.expected_schema_version,
    ),
    authAttestationVersion: readNullableVersionText(
      value.auth_attestation_version,
    ),
    authAttestationCheckedAt: readNullableTimestamp(
      value.auth_attestation_checked_at,
    ),
    lastHealthStatus: healthStatus,
    lastHealthSafeError: readSafeErrorCode(value.last_health_safe_error),
    lastHealthAgentVersion:
      value.last_health_agent_version === null
        ? null
        : readString(value.last_health_agent_version, VERSION),
    lastHealthSchemaVersion:
      value.last_health_schema_version === null
        ? null
        : readString(value.last_health_schema_version, VERSION),
    lastHealthAuthAttestationVersion:
      value.last_health_auth_attestation_version === null
        ? null
        : readString(value.last_health_auth_attestation_version, VERSION),
    lastHealthAuthAttestationCheckedAt: readNullableTimestamp(
      value.last_health_auth_attestation_checked_at,
    ),
  };
}

function readActiveProject(value: unknown): ActiveCustomerProject {
  if (!isRecord(value)) {
    return repositoryFailure();
  }

  const tenantId = readString(value.id, UUID);
  return {
    tenantId,
    targetSupabaseProjectRef: readString(
      value.target_supabase_project_ref,
      PROJECT_REF,
    ),
    agentOrigin: readStoredAgentOrigin(value.agent_origin),
    wranglerEnvironment: readString(
      value.wrangler_environment,
      WRANGLER_ENVIRONMENT,
    ),
    bearerTokenCiphertext: readString(
      value.bearer_token_ciphertext,
      BASE64URL_CIPHERTEXT,
    ),
    bearerTokenIv: readString(value.bearer_token_iv, BASE64URL_IV),
    bearerTokenVersion: readPositiveVersion(value.bearer_token_version),
    bearerTokenKekVersion: readPositiveVersion(
      value.bearer_token_kek_version,
    ),
    bearerTokenFingerprint: readString(
      value.bearer_token_fingerprint,
      HEX_DIGEST,
    ),
    expectedAgentVersion: readString(value.expected_agent_version, VERSION),
    expectedSchemaVersion: readString(value.expected_schema_version, VERSION),
    authAttestationVersion: readString(
      value.auth_attestation_version,
      VERSION,
    ),
    authAttestationDigest: readString(
      value.auth_attestation_digest,
      HEX_DIGEST,
    ),
    authAttestationCheckedAt: readTimestamp(
      value.auth_attestation_checked_at,
    ),
  };
}

function readProvisioningProject(value: unknown): ProvisioningCustomerProject {
  if (!isRecord(value)) return repositoryFailure();
  const tenantId = readString(value.id, UUID);
  const hasToken = value.bearer_token_version !== null;
  const provisioningState = value.provisioning_state;
  if (
    provisioningState !== null &&
    provisioningState !== "registered" &&
    provisioningState !== "rotation_gated" &&
    provisioningState !== "token_stored" &&
    provisioningState !== "completed"
  ) {
    return repositoryFailure();
  }
  return {
    tenantId,
    displayName: readDisplayName(value.display_name),
    isActive:
      typeof value.is_active === "boolean"
        ? value.is_active
        : repositoryFailure(),
    provisioningState,
    targetSupabaseProjectRef: readString(value.target_supabase_project_ref, PROJECT_REF),
    agentOrigin: readStoredAgentOrigin(value.agent_origin),
    wranglerEnvironment: readString(value.wrangler_environment, WRANGLER_ENVIRONMENT),
    expectedAgentVersion: readString(value.expected_agent_version, VERSION),
    expectedSchemaVersion: readString(value.expected_schema_version, VERSION),
    authAttestationVersion: readString(value.auth_attestation_version, VERSION),
    authAttestationDigest: readString(value.auth_attestation_digest, HEX_DIGEST),
    authAttestationCheckedAt: readTimestamp(value.auth_attestation_checked_at),
    encryptedToken: hasToken
      ? {
          tenantId,
          bearerTokenCiphertext: readString(value.bearer_token_ciphertext, BASE64URL_CIPHERTEXT),
          bearerTokenIv: readString(value.bearer_token_iv, BASE64URL_IV),
          bearerTokenVersion: readPositiveVersion(value.bearer_token_version),
          bearerTokenKekVersion: readPositiveVersion(value.bearer_token_kek_version),
          bearerTokenFingerprint: readString(value.bearer_token_fingerprint, HEX_DIGEST),
        }
      : value.bearer_token_ciphertext === null &&
          value.bearer_token_iv === null &&
          value.bearer_token_kek_version === null &&
          value.bearer_token_fingerprint === null
        ? null
        : repositoryFailure(),
  };
}

function throwOnError(error: unknown): void {
  if (error) {
    repositoryFailure();
  }
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
  throwOnError(error);
  if (typeof data !== "boolean") {
    return repositoryFailure();
  }
  return data;
}

export async function listCustomerProjects(
  client: SupabaseClient,
): Promise<SafeCustomerProject[]> {
  const { data, error } = await runAdapterCall(() =>
    client
      .from("central_user_manager_projects")
      .select(SAFE_PROJECT_COLUMNS)
      .order("display_name")
      .order("id"),
  );

  throwOnError(error);
  if (!Array.isArray(data)) {
    return repositoryFailure();
  }
  return data.map(readSafeProject);
}

export async function findActiveCustomerProject(
  client: SupabaseClient,
  tenantId: string,
): Promise<ActiveCustomerProject | null> {
  const trustedTenantId = readString(tenantId, UUID);
  const { data, error } = await runAdapterCall(() =>
    client
      .from("customer_projects")
      .select(ACTIVE_PROJECT_COLUMNS)
      .eq("id", trustedTenantId)
      .eq("is_active", true)
      .limit(2),
  );

  throwOnError(error);
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return null;
  }
  if (!Array.isArray(data) || data.length !== 1) {
    return repositoryFailure();
  }
  return readActiveProject(data[0]);
}

export async function findCustomerProjectForProvisioning(
  client: SupabaseClient,
  tenantId: string,
): Promise<ProvisioningCustomerProject | null> {
  const trustedTenantId = readString(tenantId, UUID);
  const { data, error } = await runAdapterCall(() =>
    client
      .from("customer_projects")
      .select(PROVISIONING_PROJECT_COLUMNS)
      .eq("id", trustedTenantId)
      .limit(2),
  );
  throwOnError(error);
  if (data === null || (Array.isArray(data) && data.length === 0)) return null;
  if (!Array.isArray(data) || data.length !== 1) return repositoryFailure();
  return readProvisioningProject(data[0]);
}

export async function registerCustomerProject(
  client: SupabaseClient,
  input: CustomerProjectRegistration & {
    actorUid: string;
    eventId: string;
  },
): Promise<{ outcome: "registered" | "retry"; isActive: false }> {
  const args = {
    p_tenant_id: readString(input.tenantId, UUID),
    p_display_name: readDisplayName(input.displayName),
    p_target_supabase_project_ref: readString(
      input.targetSupabaseProjectRef,
      PROJECT_REF,
    ),
    p_agent_origin: readStoredAgentOrigin(input.agentOrigin),
    p_wrangler_environment: readString(
      input.wranglerEnvironment,
      WRANGLER_ENVIRONMENT,
    ),
    p_expected_agent_version: readString(input.expectedAgentVersion, VERSION),
    p_expected_schema_version: readString(input.expectedSchemaVersion, VERSION),
    p_auth_attestation_version: readString(
      input.authAttestationVersion,
      VERSION,
    ),
    p_auth_attestation_digest: readString(
      input.authAttestationDigest,
      HEX_DIGEST,
    ),
    p_auth_attestation_checked_at: readTimestamp(
      input.authAttestationCheckedAt,
    ),
    p_actor_uid: readString(input.actorUid, UUID),
    p_event_id: readString(input.eventId, UUID),
  };
  const { data, error } = await runAdapterCall(() =>
    client.rpc("register_customer_project_for_provisioning", args),
  );

  throwOnError(error);
  if (
    !isRecord(data) ||
    (data.outcome !== "registered" && data.outcome !== "retry") ||
    data.isActive !== false
  ) {
    return repositoryFailure();
  }
  return { outcome: data.outcome, isActive: false };
}

export function deactivateCustomerProject(
  client: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  return callBooleanRpc(client, "deactivate_customer_project", {
    p_tenant_id: readString(tenantId, UUID),
  });
}

export async function beginCustomerProjectTokenRotation(
  client: SupabaseClient,
  input: {
    tenantId: string;
    actorUid: string;
    eventId: string;
    expectedTokenVersion: number;
  },
): Promise<CustomerProjectTokenRotationGate> {
  const { data, error } = await runAdapterCall(() =>
    client.rpc("begin_customer_project_token_rotation", {
      p_tenant_id: readString(input.tenantId, UUID),
      p_actor_uid: readString(input.actorUid, UUID),
      p_event_id: readString(input.eventId, UUID),
      p_expected_token_version: readPositiveVersion(input.expectedTokenVersion),
    }),
  );
  throwOnError(error);
  const failedSafeCount = isRecord(data) ? data.failedSafeCount : null;
  const quarantinedCount = isRecord(data) ? data.quarantinedCount : null;
  if (
    !isRecord(data) ||
    typeof failedSafeCount !== "number" ||
    typeof quarantinedCount !== "number" ||
    !Number.isSafeInteger(failedSafeCount) ||
    !Number.isSafeInteger(quarantinedCount) ||
    failedSafeCount < 0 ||
    quarantinedCount < 0 ||
    data.remainingDispatchableCount !== 0
  ) {
    return repositoryFailure();
  }
  return {
    failedSafeCount,
    quarantinedCount,
    remainingDispatchableCount: 0,
  };
}

export function storeCustomerProjectBearerForProvisioning(
  client: SupabaseClient,
  input: EncryptedTenantToken & {
    expectedTokenVersion: number;
    actorUid: string;
    eventId: string;
  },
): Promise<boolean> {
  return callBooleanRpc(client, "store_customer_project_bearer_for_provisioning", {
    p_tenant_id: readString(input.tenantId, UUID),
    p_expected_token_version:
      input.expectedTokenVersion === 0
        ? 0
        : readPositiveVersion(input.expectedTokenVersion),
    p_next_token_version: readPositiveVersion(input.bearerTokenVersion),
    p_kek_version: readPositiveVersion(input.bearerTokenKekVersion),
    p_ciphertext: readString(
      input.bearerTokenCiphertext,
      BASE64URL_CIPHERTEXT,
    ),
    p_iv: readString(input.bearerTokenIv, BASE64URL_IV),
    p_fingerprint: readString(
      input.bearerTokenFingerprint,
      HEX_DIGEST,
    ),
    p_actor_uid: readString(input.actorUid, UUID),
    p_event_id: readString(input.eventId, UUID),
  });
}

export function recordCustomerProjectVerification(
  client: SupabaseClient,
  input: {
    tenantId: string;
    tokenVersion: number;
    check: "health" | "list_users";
    succeeded: boolean;
    safeErrorCode: string | null;
    health: CustomerProjectHealthProof | null;
  },
): Promise<boolean> {
  const health = input.health;
  if (
    typeof input.succeeded !== "boolean" ||
    (input.check !== "health" && input.check !== "list_users") ||
    (input.check === "list_users" && health !== null) ||
    (input.check === "health" && input.succeeded && health === null)
  ) {
    return repositoryFailure();
  }
  return callBooleanRpc(client, "record_customer_project_verification", {
    p_tenant_id: readString(input.tenantId, UUID),
    p_token_version: readPositiveVersion(input.tokenVersion),
    p_check: input.check,
    p_succeeded: input.succeeded,
    p_safe_error_code: readSafeErrorCode(input.safeErrorCode),
    p_health_protocol_version: health?.protocolVersion ?? null,
    p_health_tenant_id: health ? readString(health.tenantId, UUID) : null,
    p_health_project_ref: health
      ? readString(health.projectRef, PROJECT_REF)
      : null,
    p_health_agent_version: health
      ? readString(health.agentVersion, VERSION)
      : null,
    p_health_schema_version: health
      ? readString(health.schemaVersion, VERSION)
      : null,
    p_health_auth_attestation_version: health
      ? readString(health.authAttestationVersion, VERSION)
      : null,
    p_health_auth_attestation_digest: health
      ? readString(health.authAttestationDigest, HEX_DIGEST)
      : null,
    p_health_auth_attestation_checked_at: health
      ? readTimestamp(health.authAttestationCheckedAt)
      : null,
  });
}

export function activateCustomerProjectForProvisioning(
  client: SupabaseClient,
  input: {
    tenantId: string;
    expectedTokenVersion: number;
    actorUid: string;
    eventId: string;
  },
): Promise<boolean> {
  return callBooleanRpc(client, "activate_customer_project_for_provisioning", {
    p_tenant_id: readString(input.tenantId, UUID),
    p_expected_token_version: readPositiveVersion(input.expectedTokenVersion),
    p_actor_uid: readString(input.actorUid, UUID),
    p_event_id: readString(input.eventId, UUID),
  });
}
