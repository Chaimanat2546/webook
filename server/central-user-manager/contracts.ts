export const CENTRAL_USER_ACTIONS = [
  "list_users",
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
] as const;

export type CentralUserAction = (typeof CENTRAL_USER_ACTIONS)[number];
export type CentralUserMutationAction = Exclude<CentralUserAction, "list_users">;
export type CentralUserPayload =
  | { page: number; pageSize: number }
  | { email: string };

export type CentralUserRpcRequest = {
  protocolVersion: 1;
  tenantId: string;
  operationId: string;
  actorUid: string;
  action: "list_users";
  payload: { page: number; pageSize: number };
} | {
  protocolVersion: 1;
  tenantId: string;
  operationId: string;
  actorUid: string;
  action: CentralUserMutationAction;
  payload: { email: string };
};

export type CentralUserOperationStatus =
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined"
  | "failed";

export class CentralUserManagerError extends Error {
  readonly code: "invalid_request" | "tenant_unavailable" | "agent_unavailable" | "forbidden";

  constructor(code: "invalid_request" | "tenant_unavailable" | "agent_unavailable" | "forbidden") {
    super(code);
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

export function normalizeCentralUserEmail(value: unknown): string {
  if (typeof value !== "string") throw new CentralUserManagerError("invalid_request");
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CentralUserManagerError("invalid_request");
  }
  return email;
}

export function parseCentralUserRpcRequest(value: unknown): CentralUserRpcRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, ["protocolVersion", "tenantId", "operationId", "actorUid", "action", "payload"])) {
    throw new CentralUserManagerError("invalid_request");
  }
  const { protocolVersion, tenantId, operationId, actorUid, action, payload } = value;
  if (protocolVersion !== 1 || !isCanonicalUuid(tenantId) || !isCanonicalUuid(operationId) || !isCanonicalUuid(actorUid)) {
    throw new CentralUserManagerError("invalid_request");
  }
  if (action === "list_users") {
    if (!isRecord(payload) || !hasOnlyKeys(payload, ["page", "pageSize"]) || typeof payload.page !== "number" || typeof payload.pageSize !== "number" || !Number.isInteger(payload.page) || !Number.isInteger(payload.pageSize) || payload.page < 1 || payload.page > 100 || payload.pageSize < 1 || payload.pageSize > 100) {
      throw new CentralUserManagerError("invalid_request");
    }
    return { protocolVersion, tenantId, operationId, actorUid, action, payload: { page: payload.page, pageSize: payload.pageSize } };
  }
  if (!CENTRAL_USER_ACTIONS.includes(action as CentralUserAction) || action === "list_users" || !isRecord(payload) || !hasOnlyKeys(payload, ["email"])) {
    throw new CentralUserManagerError("invalid_request");
  }
  return { protocolVersion, tenantId, operationId, actorUid, action: action as CentralUserMutationAction, payload: { email: normalizeCentralUserEmail(payload.email) } };
}
