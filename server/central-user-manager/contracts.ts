import "server-only";

import { CentralUserManagerContractError } from "./safe-errors.ts";

export { CentralUserManagerContractError } from "./safe-errors.ts";

export type CentralUserAction =
  | "list_users"
  | "create_user"
  | "reissue_temporary_password"
  | "suspend_user"
  | "reactivate_user";

export type BrowserOperationRequest =
  | {
      tenantId: string;
      operationId: string;
      action: "list_users";
      payload: { page: number; pageSize: number };
    }
  | {
      tenantId: string;
      operationId: string;
      action: Exclude<CentralUserAction, "list_users">;
      payload: { email: string };
    };

export type AgentOperationRequest = BrowserOperationRequest & {
  actorUid: string;
};

const BROWSER_REQUEST_KEYS = [
  "tenantId",
  "operationId",
  "action",
  "payload",
] as const;
const MUTATION_ACTIONS = new Set<CentralUserAction>([
  "create_user",
  "reissue_temporary_password",
  "suspend_user",
  "reactivate_user",
]);
const CANONICAL_RFC_9562_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_EMAIL_CHARACTERS = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const MAX_EMAIL_LENGTH = 254;
const MAX_EMAIL_LOCAL_PART_LENGTH = 64;
const MAX_EMAIL_DOMAIN_LABEL_LENGTH = 63;

function invalidRequest(): never {
  throw new CentralUserManagerContractError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    )
  ) {
    return false;
  }

  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function readUuid(value: unknown): string {
  if (typeof value !== "string" || !CANONICAL_RFC_9562_UUID.test(value)) {
    return invalidRequest();
  }

  return value;
}

function readListPayload(value: unknown): {
  page: number;
  pageSize: number;
} {
  if (!isRecord(value) || !hasExactDataKeys(value, ["page", "pageSize"])) {
    return invalidRequest();
  }

  const { page, pageSize } = value;

  if (
    typeof page !== "number" ||
    typeof pageSize !== "number" ||
    !Number.isInteger(page) ||
    !Number.isInteger(pageSize) ||
    page < 1 ||
    page > 100 ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    return invalidRequest();
  }

  return { page, pageSize };
}

function readMutationPayload(value: unknown): { email: string } {
  if (!isRecord(value) || !hasExactDataKeys(value, ["email"])) {
    return invalidRequest();
  }

  const { email } = value;

  if (typeof email !== "string") {
    return invalidRequest();
  }

  const normalized = email.trim().toLowerCase();
  const [localPart = "", domain = ""] = normalized.split("@");
  const domainLabels = domain.split(".");

  if (
    normalized.length === 0 ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !SIMPLE_EMAIL.test(normalized) ||
    FORBIDDEN_EMAIL_CHARACTERS.test(normalized) ||
    localPart.length > MAX_EMAIL_LOCAL_PART_LENGTH ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domainLabels.some(
      (label) =>
        label.length === 0 ||
        label.length > MAX_EMAIL_DOMAIN_LABEL_LENGTH ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  ) {
    return invalidRequest();
  }

  return { email: normalized };
}

export function parseBrowserOperationRequest(
  value: unknown,
): BrowserOperationRequest {
  if (
    !isRecord(value) ||
    !hasExactDataKeys(value, BROWSER_REQUEST_KEYS)
  ) {
    return invalidRequest();
  }

  const tenantId = readUuid(value.tenantId);
  const operationId = readUuid(value.operationId);
  const { action, payload } = value;

  if (action === "list_users") {
    return {
      tenantId,
      operationId,
      action,
      payload: readListPayload(payload),
    };
  }

  if (
    typeof action === "string" &&
    MUTATION_ACTIONS.has(action as CentralUserAction)
  ) {
    return {
      tenantId,
      operationId,
      action: action as Exclude<CentralUserAction, "list_users">,
      payload: readMutationPayload(payload),
    };
  }

  return invalidRequest();
}

export function buildAgentOperationRequest(
  request: BrowserOperationRequest,
  actorUid: unknown,
): AgentOperationRequest {
  const trustedActorUid = readUuid(actorUid);

  if (request.action === "list_users") {
    return {
      tenantId: request.tenantId,
      operationId: request.operationId,
      actorUid: trustedActorUid,
      action: request.action,
      payload: { ...request.payload },
    };
  }

  return {
    tenantId: request.tenantId,
    operationId: request.operationId,
    actorUid: trustedActorUid,
    action: request.action,
    payload: { ...request.payload },
  };
}
