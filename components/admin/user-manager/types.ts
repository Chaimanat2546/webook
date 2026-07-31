export type ManagedUserStatus =
  | "active"
  | "password_change_required"
  | "suspended"
  | "abnormal";

export interface ManagedUser {
  userId: string;
  email: string;
  status: ManagedUserStatus;
  createdAt: string | null;
  lastSignInAt: string | null;
  credentialVersion: number | null;
  authCredentialVersion: number | null;
}

export interface UserManagerProject {
  id: string;
  displayName: string;
  isActive: boolean;
  provisioningState:
    | null
    | "registered"
    | "rotation_gated"
    | "token_stored"
    | "completed"
    | "reactivation_verifying";
  lastVerifiedTokenVersion: number | null;
  lastHealthCheckedAt: string | null;
  lastListUsersCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expectedAgentVersion: string | null;
  expectedSchemaVersion: string | null;
  authAttestationVersion: string | null;
  authAttestationCheckedAt: string | null;
  lastHealthStatus: "unknown" | "healthy" | "unhealthy";
  lastHealthSafeError: string | null;
  lastHealthAgentVersion: string | null;
  lastHealthSchemaVersion: string | null;
  lastHealthAuthAttestationVersion: string | null;
  lastHealthAuthAttestationCheckedAt: string | null;
}

export type ClientOperationStatus =
  | "received"
  | "dispatching"
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined"
  | "failed_safe";

export interface ClientOperation {
  operationId: string;
  status: ClientOperationStatus;
  agentStage: string | null;
  safeResult:
    | { user: ManagedUser }
    | {
        users: ManagedUser[];
        pagination: { page: number; pageSize: number; hasMore: boolean };
      }
    | null;
  safeErrorCode: string | null;
}

export interface ClientOperationWithPassword extends ClientOperation {
  temporaryPassword?: string;
}

export interface TemporaryCredential {
  tenantId: string;
  email: string;
  password: string;
}

export interface UserManagerHealth {
  tenantId: string;
  status: "healthy" | "unhealthy";
  agentVersion: string | null;
  schemaVersion: string | null;
  authAttestationVersion: string | null;
  authAttestationCheckedAt: string | null;
}

export type UserLifecycleAction =
  | "create_user"
  | "reissue_temporary_password"
  | "suspend_user"
  | "reactivate_user";
