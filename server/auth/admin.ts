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
