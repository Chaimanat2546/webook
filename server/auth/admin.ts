import { cache } from "react";

export interface AdminAllowTools {
  allow_accommodation?: boolean;
}

export interface AdminUserForAuth {
  allow_tools: AdminAllowTools | null;
  mid: number | null;
  role_id: number | null;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export function canUseAccommodation(user: Pick<AdminUserForAuth, "allow_tools"> | null): boolean {
  return user?.allow_tools?.allow_accommodation === true;
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
    isAuthorized: canUseAccommodation(adminUser),
    supabase,
    user,
  };
});
