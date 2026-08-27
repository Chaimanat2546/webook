import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface WebookManagedUser {
  id: string;
  uid: string | null;
  name: string;
  username: string;
  tel: string;
  email: string;
  isBanned: boolean;
  updatedAt: string | null;
}

export interface WebookUserDetails {
  name: string;
  username: string;
  tel: string;
  email: string;
}

export interface WebookUserConflictInput {
  id: string;
  username: string;
  email: string;
}

export interface WebookUserRepositoryPort<TClient> {
  acquireLifecycleLock(client: TClient, id: string, ownerToken: string): Promise<boolean>;
  releaseLifecycleLock(client: TClient, id: string, ownerToken: string): Promise<void>;
  findById(client: TClient, id: string): Promise<WebookManagedUser | null>;
  findConflict(client: TClient, input: WebookUserConflictInput): Promise<boolean>;
  updateDetails(
    client: TClient,
    id: string,
    changes: WebookUserDetails,
    lockToken: string,
  ): Promise<WebookManagedUser>;
  updateBan(
    client: TClient,
    id: string,
    isBanned: boolean,
    lockToken: string,
  ): Promise<WebookManagedUser>;
}

export class WebookUserConflictError extends Error {
  readonly code = "23505";

  constructor() {
    super("Webook user identity conflict");
    this.name = "WebookUserConflictError";
  }
}

const MANAGED_USER_COLUMNS = "id, uid, name, username, tel, email, is_banned, updated_at";

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapWebookManagedUser(value: unknown): WebookManagedUser {
  const row = recordValue(value);
  return {
    id: stringValue(row.id),
    uid: nullableStringValue(row.uid),
    name: stringValue(row.name),
    username: stringValue(row.username),
    tel: stringValue(row.tel),
    email: stringValue(row.email),
    isBanned: row.is_banned === true,
    updatedAt: nullableStringValue(row.updated_at),
  };
}

function throwQueryError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listWebookUsers(supabase: SupabaseClient): Promise<WebookManagedUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select(MANAGED_USER_COLUMNS)
    .order("is_banned", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });

  throwQueryError(error);
  return Array.isArray(data) ? data.map(mapWebookManagedUser) : [];
}

export async function findWebookUserById(
  supabase: SupabaseClient,
  id: string,
): Promise<WebookManagedUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select(MANAGED_USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  throwQueryError(error);
  return data === null ? null : mapWebookManagedUser(data);
}

export async function findWebookUserConflict(
  supabase: SupabaseClient,
  input: WebookUserConflictInput,
): Promise<boolean> {
  const [usernameResult, emailResult] = await Promise.all([
    supabase
      .from("users")
      .select("id")
      .eq("username", input.username)
      .neq("id", input.id)
      .limit(1),
    supabase
      .from("users")
      .select("id")
      .eq("email", input.email)
      .neq("id", input.id)
      .limit(1),
  ]);

  throwQueryError(usernameResult.error);
  throwQueryError(emailResult.error);
  return (usernameResult.data?.length ?? 0) > 0 || (emailResult.data?.length ?? 0) > 0;
}

export async function acquireWebookUserLifecycleLock(
  supabase: SupabaseClient,
  id: string,
  ownerToken: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("acquire_webook_user_lifecycle_lock", {
    p_id: id,
    p_owner_token: ownerToken,
  });

  throwQueryError(error);
  return data === true;
}

export async function releaseWebookUserLifecycleLock(
  supabase: SupabaseClient,
  id: string,
  ownerToken: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_webook_user_lifecycle_lock", {
    p_id: id,
    p_owner_token: ownerToken,
  });

  throwQueryError(error);
}

export async function updateWebookUserDetails(
  supabase: SupabaseClient,
  id: string,
  changes: WebookUserDetails,
  lockToken: string,
): Promise<WebookManagedUser> {
  const { data, error } = await supabase
    .rpc("update_webook_user_details", {
      p_id: id,
      p_name: changes.name,
      p_username: changes.username,
      p_tel: changes.tel,
      p_email: changes.email,
      p_lock_token: lockToken,
    })
    .single();

  if (error?.code === "23505") throw new WebookUserConflictError();
  throwQueryError(error);
  return mapWebookManagedUser(data);
}

export async function updateWebookUserBan(
  supabase: SupabaseClient,
  id: string,
  isBanned: boolean,
  lockToken: string,
): Promise<WebookManagedUser> {
  const { data, error } = await supabase
    .rpc("set_webook_user_ban", {
      p_id: id,
      p_is_banned: isBanned,
      p_lock_token: lockToken,
    })
    .single();

  throwQueryError(error);
  return mapWebookManagedUser(data);
}

export const webookUserRepository: WebookUserRepositoryPort<SupabaseClient> = {
  acquireLifecycleLock: acquireWebookUserLifecycleLock,
  releaseLifecycleLock: releaseWebookUserLifecycleLock,
  findById: findWebookUserById,
  findConflict: findWebookUserConflict,
  updateDetails: updateWebookUserDetails,
  updateBan: updateWebookUserBan,
};
