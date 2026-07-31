"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type {
  ClientOperation,
  ClientOperationWithPassword,
  ManagedUser,
  TemporaryCredential,
  UserLifecycleAction,
  UserManagerHealth,
  UserManagerProject,
} from "./types.ts";
import {
  clampUserManagerPage,
  createTenantSelectionGuard,
  readTemporaryCredential,
  sanitizeClientOperation,
  type TenantSelection,
} from "./view-model.ts";

export type BrowserOperationInput =
  | {
      tenantId: string;
      action: "list_users";
      payload: { page: number; pageSize: number };
    }
  | {
      tenantId: string;
      action: UserLifecycleAction;
      payload: { email: string };
    };

type ExactBrowserOperation = BrowserOperationInput & { operationId: string };

interface CoordinatorDependencies {
  randomUuid(): string;
  send(path: string, body: ExactBrowserOperation): Promise<unknown>;
}

export function createUserManagerRequestCoordinator(
  dependencies: CoordinatorDependencies,
) {
  const inFlight = new Map<string, Promise<unknown>>();
  const requests = new WeakMap<Promise<unknown>, ExactBrowserOperation>();
  let reviewRequest: ExactBrowserOperation | null = null;

  function dispatch(
    key: string,
    path: string,
    request: ExactBrowserOperation,
  ): Promise<unknown> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const promise = dependencies.send(path, request);
    inFlight.set(key, promise);
    requests.set(promise, request);
    void promise.then(
      () => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      },
      () => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      },
    );
    return promise;
  }

  function execute(
    key: string,
    input: BrowserOperationInput,
  ): Promise<unknown> {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = {
      ...input,
      operationId: dependencies.randomUuid(),
    } as ExactBrowserOperation;
    return dispatch(
      key,
      "/api/admin/user-manager/operations",
      request,
    );
  }

  function markForReview(
    promise: Promise<unknown>,
  ): ExactBrowserOperation | null {
    const request = requests.get(promise) ?? null;
    if (request?.action !== "list_users") reviewRequest = request;
    return request;
  }

  function resolveReview(operationId: string) {
    if (reviewRequest?.operationId === operationId) reviewRequest = null;
  }

  function reconcile(): Promise<unknown> {
    if (!reviewRequest) {
      return Promise.reject(new Error("No operation to reconcile"));
    }
    return dispatch(
      `reconcile:${reviewRequest.operationId}`,
      `/api/admin/user-manager/operations/${reviewRequest.operationId}/reconcile`,
      reviewRequest,
    );
  }

  return {
    execute,
    markForReview,
    resolveReview,
    getReviewRequest: () => reviewRequest,
    reconcile,
  };
}

async function sendJson(path: string, body: ExactBrowserOperation) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json().catch(() => null);
  return { response, value };
}

type ReactivationFetch = (
  path: string,
  init: RequestInit,
) => Promise<Response>;

export type UserManagerReactivationResponse =
  | { ok: true; health: UserManagerHealth }
  | { ok: false; errorMessage: string };

function readHealthyTenant(
  value: unknown,
  tenantId: string,
): UserManagerHealth | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("health" in value) ||
    typeof value.health !== "object" ||
    value.health === null
  ) {
    return null;
  }
  const health = value.health as Record<string, unknown>;
  return health.tenantId === tenantId &&
    health.status === "healthy" &&
    typeof health.agentVersion === "string" &&
    typeof health.schemaVersion === "string" &&
    typeof health.authAttestationVersion === "string" &&
    typeof health.authAttestationCheckedAt === "string"
    ? (health as unknown as UserManagerHealth)
    : null;
}

const reactivationRequests = new Map<
  string,
  Promise<UserManagerReactivationResponse>
>();

async function sendProjectReactivation(
  tenantId: string,
  send: ReactivationFetch,
): Promise<UserManagerReactivationResponse> {
  const response = await send(
    "/api/admin/user-manager/projects/reactivate",
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    },
  );
  const value = await response.json().catch(() => null);
  const health = response.ok ? readHealthyTenant(value, tenantId) : null;
  return health
    ? { ok: true, health }
    : { ok: false, errorMessage: safeErrorMessage(value) };
}

export function reactivateUserManagerProject(
  tenantId: string,
  send: ReactivationFetch = fetch,
): Promise<UserManagerReactivationResponse> {
  const existing = reactivationRequests.get(tenantId);
  if (existing) return existing;
  const request = sendProjectReactivation(tenantId, send);
  reactivationRequests.set(tenantId, request);
  void request.finally(() => {
    if (reactivationRequests.get(tenantId) === request) {
      reactivationRequests.delete(tenantId);
    }
  }).catch(() => {
    // The caller owns the original rejection; cleanup must not create another.
  });
  return request;
}

function readOperation(value: unknown): ClientOperationWithPassword | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("operation" in value) ||
    typeof value.operation !== "object" ||
    value.operation === null
  ) {
    return null;
  }
  return value.operation as ClientOperationWithPassword;
}

function safeErrorMessage(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error
  ) {
    switch (value.error.code) {
      case "operation_conflict":
        return "คำขอนี้ขัดแย้งกับรายการเดิม";
      case "project_unavailable":
        return "โครงการนี้ยังไม่พร้อมใช้งาน";
      case "operation_ambiguous":
        return "ต้องตรวจสอบผลการดำเนินการก่อนทำรายการต่อ";
    }
  }
  return "ไม่สามารถดำเนินการได้ กรุณาลองใหม่";
}

function requiresReview(operation: ClientOperation): boolean {
  return (
    operation.status === "needs_review" ||
    operation.status === "quarantined" ||
    operation.status === "in_progress" ||
    operation.status === "dispatching"
  );
}

export function useUserManager(initialProjects: UserManagerProject[]) {
  const [projects, setProjects] =
    useState<UserManagerProject[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [health, setHealth] = useState<UserManagerHealth | null>(null);
  const [operation, setOperation] = useState<ClientOperation | null>(null);
  const [temporaryCredential, setTemporaryCredential] =
    useState<TemporaryCredential | null>(null);
  const [reviewState, setReviewState] = useState<{
    tenantId: string;
    operation: ClientOperation;
  } | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selectedProject = useMemo(
    () =>
      projects.find((project) => project.id === selectedProjectId) ??
      null,
    [projects, selectedProjectId],
  );
  const coordinatorRef = useRef(
    createUserManagerRequestCoordinator({
      randomUuid: () => crypto.randomUUID(),
      send: sendJson,
    }),
  );
  const selectionGuardRef = useRef(createTenantSelectionGuard());
  const isBusy = busyCount > 0;

  const applyOperationResponse = useCallback((
    value: unknown,
    input: BrowserOperationInput,
    requestPromise: Promise<unknown>,
  ) => {
    const nextOperation = readOperation(value);
    if (!nextOperation) {
      setError(safeErrorMessage(value));
      return false;
    }
    const safeOperation = sanitizeClientOperation(nextOperation);
    if (input.action !== "list_users" && requiresReview(safeOperation)) {
      coordinatorRef.current.markForReview(requestPromise);
      setReviewState({ tenantId: input.tenantId, operation: safeOperation });
    } else if (input.action !== "list_users") {
      coordinatorRef.current.resolveReview(safeOperation.operationId);
      setReviewState((current) =>
        current?.operation.operationId === safeOperation.operationId
          ? null
          : current,
      );
    }
    setOperation((current) =>
      input.action === "list_users" && current && requiresReview(current)
        ? current
        : safeOperation,
    );
    setTemporaryCredential(
      input.action === "list_users"
        ? null
        : readTemporaryCredential(nextOperation, input),
    );
    if (nextOperation.safeResult) {
      if ("users" in nextOperation.safeResult) {
        setUsers(nextOperation.safeResult.users);
        setPage(nextOperation.safeResult.pagination.page);
        setHasMore(nextOperation.safeResult.pagination.hasMore);
      } else {
        setUsers((current) => {
          const nextUser = nextOperation.safeResult &&
            "user" in nextOperation.safeResult
            ? nextOperation.safeResult.user
            : null;
          if (!nextUser) return current;
          const found = current.some((user) => user.userId === nextUser.userId);
          return found
            ? current.map((user) =>
                user.userId === nextUser.userId ? nextUser : user,
              )
            : [nextUser, ...current];
        });
      }
    }
    setError(null);
    return true;
  }, []);

  const run = useCallback(async (
    key: string,
    input: BrowserOperationInput,
    selection: TenantSelection,
  ) => {
    setBusyCount((current) => current + 1);
    setTemporaryCredential(null);
    setError(null);
    const requestPromise = coordinatorRef.current.execute(key, input);
    try {
      const result = await requestPromise;
      const value =
        typeof result === "object" && result !== null && "value" in result
          ? result.value
          : result;
      if (selectionGuardRef.current.isCurrent(selection)) {
        applyOperationResponse(value, input, requestPromise);
      } else if (input.action !== "list_users") {
        const nextOperation = readOperation(value);
        if (nextOperation) {
          const credential = readTemporaryCredential(nextOperation, input);
          if (credential) setTemporaryCredential(credential);
          if (requiresReview(nextOperation)) {
            coordinatorRef.current.markForReview(requestPromise);
            setReviewState({
              tenantId: input.tenantId,
              operation: sanitizeClientOperation(nextOperation),
            });
          }
        }
      }
    } catch {
      if (input.action !== "list_users") {
        const request = coordinatorRef.current.markForReview(requestPromise);
        if (request) {
          const reviewOperation: ClientOperation = {
            operationId: request.operationId,
            status: "needs_review",
            agentStage: null,
            safeResult: null,
            safeErrorCode: "transport_ambiguous",
          };
          setReviewState({ tenantId: input.tenantId, operation: reviewOperation });
          if (selectionGuardRef.current.isCurrent(selection)) {
            setOperation(reviewOperation);
          }
        }
      }
      if (selectionGuardRef.current.isCurrent(selection)) {
        setError("การเชื่อมต่อขัดข้อง กรุณาตรวจสอบสถานะรายการ");
      }
    } finally {
      setBusyCount((current) => Math.max(0, current - 1));
    }
  }, [applyOperationResponse]);

  const loadUsers = useCallback((nextPage: number) => {
    const selection = selectionGuardRef.current.current();
    if (!selectedProject || !selection) return Promise.resolve();
    const boundedPage = clampUserManagerPage(nextPage);
    return run(`list:${selectedProject.id}:${boundedPage}`, {
      tenantId: selectedProject.id,
      action: "list_users",
      payload: { page: boundedPage, pageSize: 25 },
    }, selection);
  }, [run, selectedProject]);

  const checkHealthFor = useCallback(async (
    tenantId: string,
    selection: TenantSelection,
  ) => {
    try {
      const response = await fetch(
        `/api/admin/user-manager/health?tenantId=${encodeURIComponent(tenantId)}`,
        { cache: "no-store" },
      );
      const value = await response.json().catch(() => null);
      if (
        response.ok &&
        typeof value === "object" &&
        value !== null &&
        "health" in value
      ) {
        const nextHealth = value.health as UserManagerHealth;
        if (
          selectionGuardRef.current.isCurrent(selection) &&
          nextHealth.tenantId === tenantId
        ) {
          setHealth(nextHealth);
        }
      } else {
        if (selectionGuardRef.current.isCurrent(selection)) setHealth(null);
      }
    } catch {
      if (selectionGuardRef.current.isCurrent(selection)) setHealth(null);
    }
  }, []);

  const checkHealth = useCallback(() => {
    const selection = selectionGuardRef.current.current();
    return selectedProject && selection
      ? checkHealthFor(selectedProject.id, selection)
      : Promise.resolve();
  }, [checkHealthFor, selectedProject]);

  const selectProject = useCallback((projectId: string) => {
    const project =
      projects.find((candidate) => candidate.id === projectId) ?? null;
    setUsers([]);
    setPage(1);
    setHasMore(false);
    setHealth(null);
    setOperation(
      reviewState?.tenantId === projectId ? reviewState.operation : null,
    );
    setTemporaryCredential(null);
    setError(null);
    setSelectedProjectId(projectId);
    const selection = selectionGuardRef.current.select(projectId);
    if (project?.isActive) {
      void checkHealthFor(project.id, selection);
      void run(`list:${project.id}:1`, {
        tenantId: project.id,
        action: "list_users",
        payload: { page: 1, pageSize: 25 },
      }, selection);
    }
  }, [checkHealthFor, projects, reviewState, run]);

  const reactivateProject = useCallback(async () => {
    const selection = selectionGuardRef.current.current();
    if (
      !selectedProject ||
      !selection ||
      selectedProject.isActive ||
      (
        selectedProject.provisioningState !== "completed" &&
        selectedProject.provisioningState !== "reactivation_verifying"
      )
    ) {
      return;
    }
    setBusyCount((current) => current + 1);
    setError(null);
    try {
      const result = await reactivateUserManagerProject(selectedProject.id);
      if (!selectionGuardRef.current.isCurrent(selection)) return;
      if (!result.ok) {
        setHealth(null);
        setError(result.errorMessage);
        return;
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                isActive: true,
                provisioningState: "completed",
                lastHealthStatus: "healthy",
                lastHealthSafeError: null,
                lastHealthCheckedAt: result.health.authAttestationCheckedAt,
                lastHealthAgentVersion: result.health.agentVersion,
                lastHealthSchemaVersion: result.health.schemaVersion,
                lastHealthAuthAttestationVersion:
                  result.health.authAttestationVersion,
                lastHealthAuthAttestationCheckedAt:
                  result.health.authAttestationCheckedAt,
              }
            : project,
        ),
      );
      setHealth(result.health);
      await run(`list:${selectedProject.id}:1`, {
        tenantId: selectedProject.id,
        action: "list_users",
        payload: { page: 1, pageSize: 25 },
      }, selection);
    } catch {
      if (selectionGuardRef.current.isCurrent(selection)) {
        setHealth(null);
        setError("การเชื่อมต่อขัดข้อง กรุณาลองเปิดใช้งานอีกครั้ง");
      }
    } finally {
      setBusyCount((current) => Math.max(0, current - 1));
    }
  }, [run, selectedProject]);

  const runUserAction = useCallback((
    action: UserLifecycleAction,
    email: string,
  ) => {
    const selection = selectionGuardRef.current.current();
    if (!selectedProject || !selection) return Promise.resolve();
    return run(`${selectedProject.id}:${action}:${email}`, {
      tenantId: selectedProject.id,
      action,
      payload: { email },
    }, selection);
  }, [run, selectedProject]);

  const reconcile = useCallback(async () => {
    const request = coordinatorRef.current.getReviewRequest();
    if (!request) {
      setError("ไม่มีรายการที่ต้องตรวจสอบ");
      return;
    }
    setBusyCount((current) => current + 1);
    setTemporaryCredential(null);
    try {
      const result = await coordinatorRef.current.reconcile();
      const value =
        typeof result === "object" && result !== null && "value" in result
          ? result.value
          : result;
      const nextOperation = readOperation(value);
      if (!nextOperation) {
        setError(safeErrorMessage(value));
        return;
      }
      const safeOperation = sanitizeClientOperation(nextOperation);
      if (requiresReview(safeOperation)) {
        setReviewState({ tenantId: request.tenantId, operation: safeOperation });
      } else {
        coordinatorRef.current.resolveReview(safeOperation.operationId);
        setReviewState(null);
      }
      const currentSelection = selectionGuardRef.current.current();
      if (currentSelection?.tenantId === request.tenantId) {
        setOperation(safeOperation);
        setError(null);
      }
    } catch {
      setError("ยังตรวจสอบสถานะรายการไม่ได้");
    } finally {
      setBusyCount((current) => Math.max(0, current - 1));
    }
  }, []);

  return {
    projects,
    selectedProject,
    selectedProjectId,
    selectProject,
    users,
    page,
    hasMore,
    health,
    operation,
    temporaryCredential,
    clearTemporaryPassword: () => setTemporaryCredential(null),
    hasPendingReview: reviewState !== null,
    isBusy,
    error,
    loadUsers,
    checkHealth,
    reactivateProject,
    runUserAction,
    reconcile,
  };
}
