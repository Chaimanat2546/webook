import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebookManagedRole, WebookManagedUser } from "../../lib/webook-users";

export interface WebookUserUpdateFields {
  name: string;
  roleId: number;
}

export interface WebookUsersPage {
  totalUsers: number;
  users: WebookManagedUser[];
}

export interface WebookUsersRepository {
  listRoles(): Promise<WebookManagedRole[]>;
  listUsers(input: { page: number; pageSize: number; search: string }): Promise<WebookUsersPage>;
  getUser(id: string): Promise<WebookManagedUser | null>;
  roleExists(roleId: number): Promise<boolean>;
  updateUser(id: string, fields: WebookUserUpdateFields): Promise<WebookManagedUser | null>;
}

interface UnknownRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRoleId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function readRoleName(value: unknown, roleId: number): string {
  const directName = readText(value);
  if (directName) return directName;

  const record = asRecord(value);
  if (record) {
    const preferredKeys = ["th", "th-TH", "name_th", "en", "en-US", "name_en", "name"];
    for (const key of preferredKeys) {
      const name = readText(record[key]);
      if (name) return name;
    }

    for (const candidate of Object.values(record)) {
      const name = readText(candidate);
      if (name) return name;
    }
  }

  return `Role ${roleId}`;
}

function mapRole(value: unknown): WebookManagedRole {
  const record = asRecord(value);
  const id = readRoleId(record?.id);
  if (id === null) throw new Error("Invalid role row");

  return { id, name: readRoleName(record?.name, id) };
}

function mapUser(value: unknown): WebookManagedUser {
  const record = asRecord(value);
  const id = readText(record?.id);
  if (!id) throw new Error("Invalid user row");

  return {
    email: readText(record?.email),
    id,
    name: readText(record?.name),
    roleId: readRoleId(record?.role_id),
    username: readText(record?.username),
  };
}

function userSearchFilter(search: string): string {
  const pattern = search
    .replace(/[(),]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  return `name.ilike.%${pattern}%,username.ilike.%${pattern}%,email.ilike.%${pattern}%`;
}

export function createWebookUsersRepository(supabase: SupabaseClient): WebookUsersRepository {
  return {
    async listRoles() {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name")
        .order("id", { ascending: true });

      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown[]).map(mapRole);
    },

    async listUsers({ page, pageSize, search }) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const query = supabase
        .from("users")
        .select("id, name, username, email, role_id", { count: "exact" });
      const filteredQuery = search ? query.or(userSearchFilter(search)) : query;
      const { count, data, error } = await filteredQuery
        .order("name", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);

      if (error) throw new Error(error.message);
      return {
        totalUsers: count ?? 0,
        users: ((data ?? []) as unknown[]).map(mapUser),
      };
    },

    async getUser(id) {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, username, email, role_id")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data === null ? null : mapUser(data);
    },

    async roleExists(roleId) {
      const { data, error } = await supabase
        .from("roles")
        .select("id")
        .eq("id", roleId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data !== null;
    },

    async updateUser(id, fields) {
      const { data, error } = await supabase
        .from("users")
        .update({ name: fields.name, role_id: fields.roleId })
        .eq("id", id)
        .select("id, name, username, email, role_id")
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data === null ? null : mapUser(data);
    },
  };
}
