import type {
  ClientOperation,
  ClientOperationWithPassword,
  ManagedUserStatus,
  TemporaryCredential,
  UserManagerProject,
} from "./types.ts";

export type ProjectLifecycle =
  | "healthy"
  | "unhealthy"
  | "provisioning"
  | "deactivated";

export interface TenantSelection {
  tenantId: string;
  generation: number;
}

export function createTenantSelectionGuard() {
  let generation = 0;
  let tenantId: string | null = null;
  return {
    select(nextTenantId: string): TenantSelection {
      tenantId = nextTenantId;
      generation += 1;
      return { tenantId, generation };
    },
    current(): TenantSelection | null {
      return tenantId === null ? null : { tenantId, generation };
    },
    isCurrent(selection: TenantSelection): boolean {
      return (
        selection.tenantId === tenantId &&
        selection.generation === generation
      );
    },
  };
}

export function isHealthForSelectedTenant(
  health: Pick<{ tenantId: string; status: string }, "tenantId" | "status"> | null,
  selectedTenantId: string | null,
): boolean {
  return (
    health?.status === "healthy" &&
    health.tenantId === selectedTenantId
  );
}

export function readTemporaryCredential(
  operation: ClientOperationWithPassword,
  input: { tenantId: string; payload: { email?: string } },
): TemporaryCredential | null {
  return operation.temporaryPassword && input.payload.email
    ? {
        tenantId: input.tenantId,
        email: input.payload.email,
        password: operation.temporaryPassword,
      }
    : null;
}

export function getUserStatusPresentation(status: ManagedUserStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case "active":
      return { label: "ใช้งาน", variant: "default" };
    case "password_change_required":
      return { label: "รอเปลี่ยนรหัส", variant: "secondary" };
    case "suspended":
      return { label: "ระงับ", variant: "destructive" };
    case "abnormal":
      return { label: "ข้อมูลผิดปกติ", variant: "outline" };
  }
}

export function getProjectLifecycle(
  project: Pick<
    UserManagerProject,
    "isActive" | "lastVerifiedTokenVersion" | "lastHealthStatus"
  >,
): ProjectLifecycle {
  if (!project.isActive) {
    return project.lastVerifiedTokenVersion === null
      ? "provisioning"
      : "deactivated";
  }
  return project.lastHealthStatus === "healthy" ? "healthy" : "unhealthy";
}

export function clampUserManagerPage(page: number): number {
  if (!Number.isFinite(page)) {
    return 1;
  }
  return Math.min(100, Math.max(1, Math.trunc(page)));
}

export function sanitizeClientOperation(
  operation: ClientOperationWithPassword,
): ClientOperation {
  return {
    operationId: operation.operationId,
    status: operation.status,
    agentStage: operation.agentStage,
    safeResult: operation.safeResult,
    safeErrorCode: operation.safeErrorCode,
  };
}

export function formatUserManagerDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
