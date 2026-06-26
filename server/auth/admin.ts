import { cache } from "react";

export const ADMIN_ROLE_ID = 1;

export interface AdminUserForAuth {
  id: number;
  role_id: number | null;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export function canAccessAdmin(user: Pick<AdminUserForAuth, "role_id"> | null): boolean {
  return user?.role_id === ADMIN_ROLE_ID;
}

export function isAdminAuthBypassEnabled(
  env: { ADMIN_AUTH_BYPASS?: string; NODE_ENV?: string } = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.ADMIN_AUTH_BYPASS === "true";
}

export function pickAdminUser({
  byEmail,
  byUid,
}: {
  authUser: AuthUserIdentity;
  byEmail: AdminUserForAuth | null;
  byUid: AdminUserForAuth | null;
}): AdminUserForAuth | null {
  return byUid ?? byEmail;
}

export const requireAdmin = cache(async () => {
  const { createSupabaseServerClient } = await import("../../lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  if (isAdminAuthBypassEnabled()) {
    return {
      adminUser: { id: 0, role_id: ADMIN_ROLE_ID },
      isAuthorized: true,
      supabase,
      user: {
        email: "dev-bypass@example.local",
        id: "dev-bypass",
      },
    };
  }

  const [{ redirect }, { findAdminUserByAuthIdentity }] = await Promise.all([
    import("next/navigation"),
    import("../repositories/admin-users"),
  ]);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
    throw new Error("Unauthenticated");
  }

  const matches = await findAdminUserByAuthIdentity(supabase, {
    email: user.email,
    id: user.id,
  });
  const adminUser = pickAdminUser({ authUser: user, ...matches });

  return {
    adminUser,
    isAuthorized: canAccessAdmin(adminUser),
    supabase,
    user,
  };
});
