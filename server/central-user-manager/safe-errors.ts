import "server-only";

export const SAFE_CENTRAL_USER_ERROR_CATALOG = {
  invalid_request: {
    code: "invalid_request",
    message: "Invalid user-management request.",
  },
  unauthorized: {
    code: "unauthorized",
    message: "Authentication is required.",
  },
  forbidden: {
    code: "forbidden",
    message: "Permission is required.",
  },
  project_unavailable: {
    code: "project_unavailable",
    message: "The selected project is unavailable.",
  },
  operation_conflict: {
    code: "operation_conflict",
    message: "Operation conflicts with an existing request.",
  },
  provider_failure: {
    code: "provider_failure",
    message: "Unable to complete request.",
  },
  operation_ambiguous: {
    code: "operation_ambiguous",
    message: "Operation outcome requires review.",
  },
} as const;

export type SafeCentralUserErrorCode =
  keyof typeof SAFE_CENTRAL_USER_ERROR_CATALOG;

export interface SafeCentralUserError {
  code: SafeCentralUserErrorCode;
  message: string;
}

const SAFE_ERROR_BY_CODE = new Map<string, SafeCentralUserError>(
  Object.values(SAFE_CENTRAL_USER_ERROR_CATALOG).map((safeError) => [
    safeError.code,
    safeError,
  ]),
);

export function createSafeCentralUserError(
  code: SafeCentralUserErrorCode,
): SafeCentralUserError {
  const safeError = SAFE_ERROR_BY_CODE.get(code);

  if (!safeError) {
    throw new Error("Invalid safe user-management error code.");
  }

  return { ...safeError };
}

export function normalizeSafeCentralUserError(
  _error: unknown,
  fallbackCode: SafeCentralUserErrorCode,
): SafeCentralUserError {
  return createSafeCentralUserError(fallbackCode);
}

export class CentralUserManagerContractError extends Error {
  readonly code = "invalid_request";
  readonly status = 422;

  constructor() {
    const safeError = createSafeCentralUserError("invalid_request");
    super(safeError.message);
    this.name = "CentralUserManagerContractError";
  }
}
