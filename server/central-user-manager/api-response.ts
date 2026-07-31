import "server-only";

import {
  CentralUserManagerAuthorizationError,
} from "../auth/central-user-manager-admin.ts";
import {
  buildAgentOperationRequest,
  parseBrowserOperationRequest,
  type AgentOperationRequest,
} from "./contracts.ts";
import {
  createSafeCentralUserError,
  SAFE_CENTRAL_USER_ERROR_CATALOG,
  type SafeCentralUserError,
  type SafeCentralUserErrorCode,
} from "./safe-errors.ts";
import type {
  CentralUserHealthResult,
  CentralUserHealthSummary,
  CentralUserManagerOperationResult,
  CentralUserManagerServiceResult,
} from "../services/central-user-manager.ts";
import type {
  CentralUserManagerReactivationHealth,
  CentralUserManagerReactivationResult,
} from "../services/central-user-manager-reactivation.ts";
import type {
  CentralManagedUser,
  CentralUserSafeResult,
} from "../repositories/user-management-operations.ts";

const MAX_REQUEST_BYTES = 16_384;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json",
} as const;

type ApiErrorCode =
  | SafeCentralUserError["code"]
  | "method_not_allowed"
  | "request_too_large"
  | "service_unavailable"
  | "unsupported_content_type";

interface ApiError {
  code: ApiErrorCode;
  message: string;
}

interface AuthorizationDependency {
  authorize(): Promise<{ actorUid: string }>;
}

interface OperationsHandlerDependencies extends AuthorizationDependency {
  execute(
    request: AgentOperationRequest,
  ): Promise<CentralUserManagerServiceResult>;
}

interface ReconcileHandlerDependencies extends AuthorizationDependency {
  reconcile(
    request: AgentOperationRequest,
  ): Promise<CentralUserManagerServiceResult>;
}

interface HealthHandlerDependencies extends AuthorizationDependency {
  checkHealth(tenantId: string): Promise<CentralUserHealthResult>;
}

interface ProjectReactivationHandlerDependencies
  extends AuthorizationDependency {
  reactivate(input: {
    tenantId: string;
    actorUid: string;
  }): Promise<CentralUserManagerReactivationResult>;
}

type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...headers,
    },
  });
}

function errorResponse(error: ApiError, status: number): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    },
    status,
  );
}

function inputError(message = "Invalid user-management request."): Response {
  return errorResponse({ code: "invalid_request", message }, 422);
}

function serviceUnavailable(): Response {
  return errorResponse(
    { code: "service_unavailable", message: "Service unavailable." },
    503,
  );
}

function canonicalSafeError(error: SafeCentralUserError): SafeCentralUserError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    typeof error.code !== "string" ||
    !Object.hasOwn(SAFE_CENTRAL_USER_ERROR_CATALOG, error.code)
  ) {
    return null;
  }
  return createSafeCentralUserError(error.code as SafeCentralUserErrorCode);
}

function safeServiceErrorResponse(error: SafeCentralUserError): Response {
  const canonical = canonicalSafeError(error);
  return canonical
    ? errorResponse(canonical, safeErrorStatus(canonical))
    : serviceUnavailable();
}

async function cancelRequestBody(request: Request): Promise<void> {
  if (!request.body || request.body.locked) {
    return;
  }
  try {
    await request.body.cancel();
  } catch {
    // Rejection must not replace the intended safe HTTP response.
  }
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Rejection must not replace the intended safe HTTP response.
  }
}

async function authorize(
  dependency: AuthorizationDependency,
): Promise<{ ok: true; actorUid: string } | { ok: false; response: Response }> {
  try {
    const { actorUid } = await dependency.authorize();
    return { ok: true, actorUid };
  } catch (error) {
    if (error instanceof CentralUserManagerAuthorizationError) {
      if (error.code === "unauthorized") {
        return {
          ok: false,
          response: errorResponse(
            { code: "unauthorized", message: "Authentication is required." },
            401,
          ),
        };
      }
      if (error.code === "forbidden") {
        return {
          ok: false,
          response: errorResponse(
            { code: "forbidden", message: "Permission is required." },
            403,
          ),
        };
      }
    }
    return { ok: false, response: serviceUnavailable() };
  }
}

async function readBoundedJson(request: Request): Promise<JsonReadResult> {
  if (request.headers.get("content-type") !== "application/json") {
    await cancelRequestBody(request);
    return {
      ok: false,
      response: errorResponse(
        {
          code: "unsupported_content_type",
          message: "Content-Type must be application/json.",
        },
        415,
      ),
    };
  }

  const advertisedLength = request.headers.get("content-length");
  if (advertisedLength !== null) {
    const length = Number(advertisedLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      await cancelRequestBody(request);
      return { ok: false, response: inputError() };
    }
    if (length > MAX_REQUEST_BYTES) {
      await cancelRequestBody(request);
      return {
        ok: false,
        response: errorResponse(
          {
            code: "request_too_large",
            message: "Request body is too large.",
          },
          413,
        ),
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    await cancelRequestBody(request);
    return { ok: false, response: inputError() };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await cancelReader(reader);
        return {
          ok: false,
          response: errorResponse(
            {
              code: "request_too_large",
              message: "Request body is too large.",
            },
            413,
          ),
        };
      }
      chunks.push(value);
    }
  } catch {
    await cancelReader(reader);
    return { ok: false, response: inputError() };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: inputError() };
  }
}

function safeUserProjection(user: CentralManagedUser): CentralManagedUser {
  return {
    userId: user.userId,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    credentialVersion: user.credentialVersion,
    authCredentialVersion: user.authCredentialVersion,
  };
}

function safeResultProjection(
  result: CentralUserSafeResult | null,
): CentralUserSafeResult | null {
  if (result === null) {
    return null;
  }
  if ("user" in result) {
    return { user: safeUserProjection(result.user) };
  }
  return {
    users: result.users.map(safeUserProjection),
    pagination: {
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      hasMore: result.pagination.hasMore,
    },
  };
}

function safeOperationProjection(
  operation: CentralUserManagerOperationResult,
  includeTemporaryPassword: boolean,
): CentralUserManagerOperationResult {
  return {
    operationId: operation.operationId,
    status: operation.status,
    agentStage: operation.agentStage,
    safeResult: safeResultProjection(operation.safeResult),
    safeErrorCode: operation.safeErrorCode,
    ...(includeTemporaryPassword && operation.temporaryPassword
      ? { temporaryPassword: operation.temporaryPassword }
      : {}),
  };
}

function safeErrorStatus(error: SafeCentralUserError): number {
  switch (error.code) {
    case "invalid_request":
      return 422;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "operation_conflict":
    case "operation_ambiguous":
      return 409;
    case "project_unavailable":
    case "provider_failure":
      return 503;
  }
}

function operationStatus(operation: CentralUserManagerOperationResult): number {
  if (operation.status === "completed") {
    return 200;
  }
  if (operation.status === "failed_safe" && operation.safeErrorCode) {
    return safeErrorStatus({
      code: operation.safeErrorCode,
      message: "",
    });
  }
  return 409;
}

function operationResponse(
  result: CentralUserManagerServiceResult,
  includeTemporaryPassword: boolean,
): Response {
  if (!result.ok) {
    return safeServiceErrorResponse(result.error);
  }
  const operation = safeOperationProjection(
    result.operation,
    includeTemporaryPassword,
  );
  return jsonResponse(
    { ok: true, operation },
    operationStatus(operation),
  );
}

async function readAgentRequest(
  request: Request,
  actorUid: string,
): Promise<
  { ok: true; request: AgentOperationRequest } | { ok: false; response: Response }
> {
  const parsed = await readBoundedJson(request);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    return {
      ok: true,
      request: buildAgentOperationRequest(
        parseBrowserOperationRequest(parsed.value),
        actorUid,
      ),
    };
  } catch {
    return { ok: false, response: inputError() };
  }
}

export function createCentralUserOperationsHandler(
  dependencies: OperationsHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const authorized = await authorize(dependencies);
    if (!authorized.ok) {
      return authorized.response;
    }
    const parsed = await readAgentRequest(request, authorized.actorUid);
    if (!parsed.ok) {
      return parsed.response;
    }
    try {
      return operationResponse(
        await dependencies.execute(parsed.request),
        true,
      );
    } catch {
      return serviceUnavailable();
    }
  };
}

export function createCentralUserReconcileHandler(
  dependencies: ReconcileHandlerDependencies,
): (
  request: Request,
  params: Promise<{ operationId: string }>,
) => Promise<Response> {
  return async (request, params) => {
    const authorized = await authorize(dependencies);
    if (!authorized.ok) {
      return authorized.response;
    }
    const parsed = await readAgentRequest(request, authorized.actorUid);
    if (!parsed.ok) {
      return parsed.response;
    }
    let operationId: string;
    try {
      ({ operationId } = await params);
    } catch {
      return inputError();
    }
    if (
      !UUID.test(operationId) ||
      operationId !== parsed.request.operationId
    ) {
      return inputError();
    }
    try {
      return operationResponse(
        await dependencies.reconcile(parsed.request),
        false,
      );
    } catch {
      return serviceUnavailable();
    }
  };
}

function readTenantId(request: Request): string | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const keys = [...url.searchParams.keys()];
  const values = url.searchParams.getAll("tenantId");
  if (
    keys.length !== 1 ||
    keys[0] !== "tenantId" ||
    values.length !== 1 ||
    !UUID.test(values[0] ?? "")
  ) {
    return null;
  }
  return values[0] ?? null;
}

export function createCentralUserHealthHandler(
  dependencies: HealthHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const authorized = await authorize(dependencies);
    if (!authorized.ok) {
      return authorized.response;
    }
    const tenantId = readTenantId(request);
    if (!tenantId) {
      return inputError();
    }
    let result: CentralUserHealthResult;
    try {
      result = await dependencies.checkHealth(tenantId);
    } catch {
      return serviceUnavailable();
    }
    if (!result.ok) {
      return safeServiceErrorResponse(result.error);
    }
    const health: CentralUserHealthSummary = {
      tenantId: result.health.tenantId,
      status: result.health.status,
      agentVersion: result.health.agentVersion,
      schemaVersion: result.health.schemaVersion,
      authAttestationVersion: result.health.authAttestationVersion,
      authAttestationCheckedAt: result.health.authAttestationCheckedAt,
    };
    return jsonResponse({ ok: true, health }, 200);
  };
}

function readReactivationRequest(
  value: unknown,
): { tenantId: string } | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length === 1 &&
    keys[0] === "tenantId" &&
    typeof record.tenantId === "string" &&
    UUID.test(record.tenantId)
    ? { tenantId: record.tenantId }
    : null;
}

function hasSameMutationOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function createCentralUserProjectReactivationHandler(
  dependencies: ProjectReactivationHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const authorized = await authorize(dependencies);
    if (!authorized.ok) {
      return authorized.response;
    }
    if (!hasSameMutationOrigin(request)) {
      await cancelRequestBody(request);
      return errorResponse(
        { code: "forbidden", message: "Permission is required." },
        403,
      );
    }
    const parsed = await readBoundedJson(request);
    if (!parsed.ok) {
      return parsed.response;
    }
    const input = readReactivationRequest(parsed.value);
    if (!input) {
      return inputError();
    }
    let result: CentralUserManagerReactivationResult;
    try {
      result = await dependencies.reactivate({
        tenantId: input.tenantId,
        actorUid: authorized.actorUid,
      });
    } catch {
      return serviceUnavailable();
    }
    if (!result.ok) {
      return safeServiceErrorResponse(result.error);
    }
    const health: CentralUserManagerReactivationHealth = {
      tenantId: result.health.tenantId,
      status: "healthy",
      agentVersion: result.health.agentVersion,
      schemaVersion: result.health.schemaVersion,
      authAttestationVersion: result.health.authAttestationVersion,
      authAttestationCheckedAt: result.health.authAttestationCheckedAt,
    };
    return jsonResponse({ ok: true, health }, 200);
  };
}

export function centralUserManagerMethodNotAllowed(allow: string): Response {
  const response = errorResponse(
    { code: "method_not_allowed", message: "Method not allowed." },
    405,
  );
  response.headers.set("Allow", allow);
  return response;
}

export function createCentralUserManagerMethodNotAllowedHandler(
  dependency: AuthorizationDependency,
  allow: string,
): (request: Request) => Promise<Response> {
  return async () => {
    const authorized = await authorize(dependency);
    return authorized.ok
      ? centralUserManagerMethodNotAllowed(allow)
      : authorized.response;
  };
}
