import "server-only";

export type CentralUserManagerAuthorizationCode =
  | "forbidden"
  | "service_unavailable"
  | "unauthorized";

const AUTHORIZATION_STATUS: Record<
  CentralUserManagerAuthorizationCode,
  401 | 403 | 503
> = {
  forbidden: 403,
  service_unavailable: 503,
  unauthorized: 401,
};

export class CentralUserManagerAuthorizationError extends Error {
  readonly code: CentralUserManagerAuthorizationCode;
  readonly status: 401 | 403 | 503;

  constructor(code: CentralUserManagerAuthorizationCode) {
    super("Central User Manager authorization failed");
    this.name = "CentralUserManagerAuthorizationError";
    this.code = code;
    this.status = AUTHORIZATION_STATUS[code];
  }
}

interface CentralUserManagerSessionClient {
  auth: {
    getUser(): Promise<{
      data: {
        user: { id: string } | null;
      };
      error: unknown;
    }>;
  };
}

interface CentralUserManagerRoleRow {
  role_id: number | null;
  uid: string | null;
}

interface CentralUserManagerUsersQuery {
  eq(column: string, value: number | string): CentralUserManagerUsersQuery;
  limit(count: number): Promise<{
    data: CentralUserManagerRoleRow[] | null;
    error: unknown;
  }>;
}

interface CentralUserManagerServiceClient {
  from(table: string): {
    select(columns: string): CentralUserManagerUsersQuery;
  };
}

export async function authorizeCentralUserManagerAdmin(
  sessionClient: CentralUserManagerSessionClient,
  serviceClient: CentralUserManagerServiceClient | null,
): Promise<{ actorUid: string }> {
  let authResult: Awaited<
    ReturnType<CentralUserManagerSessionClient["auth"]["getUser"]>
  >;

  try {
    authResult = await sessionClient.auth.getUser();
  } catch {
    throw new CentralUserManagerAuthorizationError("unauthorized");
  }

  if (
    !authResult ||
    typeof authResult !== "object" ||
    !authResult.data ||
    typeof authResult.data !== "object"
  ) {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  const {
    data: { user },
    error: authError,
  } = authResult;

  if (authError || !user) {
    throw new CentralUserManagerAuthorizationError("unauthorized");
  }
  if (typeof user.id !== "string" || !user.id) {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  if (!serviceClient) {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  const actorUid = user.id;
  let roleResult: {
    data: CentralUserManagerRoleRow[] | null;
    error: unknown;
  };

  try {
    roleResult = await serviceClient
      .from("users")
      .select("uid, role_id")
      .eq("uid", actorUid)
      .eq("role_id", 1)
      .limit(2);
  } catch {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  if (!roleResult || typeof roleResult !== "object") {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }
  if (roleResult.error) {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }
  if (roleResult.data !== null && !Array.isArray(roleResult.data)) {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  const rows = roleResult.data ?? [];
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row?.uid !== actorUid ||
    row.role_id !== 1
  ) {
    throw new CentralUserManagerAuthorizationError("forbidden");
  }

  return { actorUid };
}

interface CentralUserManagerClients {
  serviceClient: CentralUserManagerServiceClient | null;
  sessionClient: CentralUserManagerSessionClient;
}

export async function requireCentralUserManagerAdminWithLoader(
  loadClients: () => Promise<CentralUserManagerClients>,
): Promise<{
  actorUid: string;
}> {
  let clients: CentralUserManagerClients;
  try {
    clients = await loadClients();
  } catch {
    throw new CentralUserManagerAuthorizationError("service_unavailable");
  }

  return authorizeCentralUserManagerAdmin(
    clients.sessionClient,
    clients.serviceClient,
  );
}

export async function requireCentralUserManagerAdmin(): Promise<{
  actorUid: string;
}> {
  return requireCentralUserManagerAdminWithLoader(async () => {
    const [{ createSupabaseServerClient }, { createSupabaseAdminClient }] =
      await Promise.all([
        import("../../lib/supabase/server"),
        import("../../lib/supabase/admin"),
      ]);

    const sessionClient = await createSupabaseServerClient();
    const serviceClient = createSupabaseAdminClient();

    return {
      serviceClient:
        serviceClient as unknown as CentralUserManagerServiceClient | null,
      sessionClient:
        sessionClient as unknown as CentralUserManagerSessionClient,
    };
  });
}
