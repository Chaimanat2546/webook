import { cache } from "react";

export interface AdminAllowTools {
  allow_accommodation?: boolean;
  allow_quotation?: boolean;
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

export function canUseQuotation(user: Pick<AdminUserForAuth, "allow_tools"> | null): boolean {
  return user?.allow_tools?.allow_quotation === true;
}

export function canManageHouseRating(user: Pick<AdminUserForAuth, "role_id"> | null): boolean {
  return user?.role_id === 1;
}

export function canManageCentralUsers(
  user: Pick<AdminUserForAuth, "role_id"> | null,
): boolean {
  return user?.role_id === 1;
}

export function canManageWebookUsers(
  user: Pick<AdminUserForAuth, "role_id"> | null,
): boolean {
  return user?.role_id === 1;
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

export async function requireAccommodationAdmin() {
  const session = await requireAdmin();
  if (!canUseAccommodation(session.adminUser)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }

  return session;
}

export async function requireCentralUserManagerAdmin() {
  const session = await requireAdmin();
  if (!canManageCentralUsers(session.adminUser)) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function requireWebookUserManagerAdmin() {
  const session = await requireAdmin();
  if (!canManageWebookUsers(session.adminUser)) {
    throw new Error("Forbidden");
  }

  return session;
}
