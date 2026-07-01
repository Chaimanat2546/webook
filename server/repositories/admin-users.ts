import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminUserForAuth, AuthUserIdentity } from "../auth/admin";

type AdminUserRow = AdminUserForAuth;

interface SignInUserRow {
  email: string | null;
}

export async function findSignInEmailByUsername(supabase: SupabaseClient, username: string): Promise<string | null> {
  const normalizedUsername = username.trim();

  if (!normalizedUsername || normalizedUsername === "NULL") {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("username", normalizedUsername)
    .limit(2);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SignInUserRow[];

  if (rows.length !== 1) {
    return null;
  }

  const email = rows[0]?.email?.trim();
  return email || null;
}

export async function findAdminUserByAuthIdentity(
  supabase: SupabaseClient,
  authUser: AuthUserIdentity,
): Promise<{ byEmail: AdminUserRow | null; byUid: AdminUserRow | null }> {
  const { data: byUid, error: uidError } = await supabase
    .from("users")
    .select("mid, role_id, allow_tools")
    .eq("uid", authUser.id)
    .maybeSingle();

  if (uidError) {
    throw new Error(uidError.message);
  }

  if (!authUser.email) {
    return { byEmail: null, byUid };
  }

  const { data: byEmail, error: emailError } = await supabase
    .from("users")
    .select("mid, role_id, allow_tools")
    .eq("email", authUser.email)
    .maybeSingle();

  if (emailError) {
    throw new Error(emailError.message);
  }

  return { byEmail, byUid };
}
