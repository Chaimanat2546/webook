import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WEBOOK_ALLOW_TOOL_OPTIONS,
  type WebookAllowTools,
  type WebookManagedRole,
  type WebookManagedUser,
} from "../../lib/webook-users.ts";

export interface WebookUserUpdateFields {
  allowTools?: WebookAllowTools;
  dvId?: string | null;
  name: string;
  roleId: number;
}

export interface WebookUsersPage {
  totalUsers: number;
  users: WebookManagedUser[];
}

export class DuplicateWebookUserDvIdError extends Error {
  constructor() {
    super("DV ID already exists");
  }
}

export type WebookUserSortBy = "dvId" | "email" | "name" | "role" | "username";
export type WebookUserSortDirection = "asc" | "desc";

export interface WebookUsersRepository {
  listRoles(): Promise<WebookManagedRole[]>;
  listUsers(input: {
    page: number;
    pageSize: number;
    roleIds: number[];
    search: string;
    sortBy: WebookUserSortBy;
    sortDirection: WebookUserSortDirection;
  }): Promise<WebookUsersPage>;
  getUser(id: string): Promise<WebookManagedUser | null>;
  dvIdExists(dvId: string, excludedUserId: string): Promise<boolean>;
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

function readDvId(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : null;
}

function readAllowTools(value: unknown): WebookAllowTools {
  const record = asRecord(value);
  return Object.fromEntries(
    WEBOOK_ALLOW_TOOL_OPTIONS.map(({ key }) => [key, record?.[key] === true]),
  ) as WebookAllowTools;
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

  return `สิทธิ์ผู้ใช้ ${roleId}`;
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
    allowTools: readAllowTools(record?.allow_tools),
    dvId: readDvId(record?.dv_id),
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

async function getUserById(supabase: SupabaseClient, id: string): Promise<WebookManagedUser | null> {
  const { data, error } = await supabase
    .from("webook_user_management_list")
    .select("id, name, username, email, role_id, dv_id, allow_tools")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data === null ? null : mapUser(data);
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

    async listUsers({ page, pageSize, roleIds, search, sortBy, sortDirection }) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const query = supabase
        .from("webook_user_management_list")
        .select("id, name, username, email, role_id, dv_id, allow_tools, dv_sort_id, role_name", { count: "exact" });
      const searchFilteredQuery = search ? query.or(userSearchFilter(search)) : query;
      const filteredQuery = roleIds.length > 0
        ? searchFilteredQuery.in("role_id", roleIds)
        : searchFilteredQuery;
      const ascending = sortDirection === "asc";
      const sortedQuery = sortBy === "role"
        ? filteredQuery.order("role_name", { ascending, nullsFirst: ascending })
        : filteredQuery.order(sortBy === "dvId" ? "dv_sort_id" : sortBy, { ascending, nullsFirst: ascending });
      const { count, data, error } = await sortedQuery
        .order("id", { ascending: true })
        .range(from, to);

      if (error) throw new Error(error.message);
      return {
        totalUsers: count ?? 0,
        users: ((data ?? []) as unknown[]).map(mapUser),
      };
    },

    async getUser(id) {
      return getUserById(supabase, id);
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

    async dvIdExists(dvId, excludedUserId) {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("dv_id", dvId)
        .neq("id", excludedUserId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data !== null;
    },

    async updateUser(id, fields) {
      const updateFields: { allow_tools?: WebookAllowTools; dv_id?: string | null; name: string; role_id: number } = {
        name: fields.name,
        role_id: fields.roleId,
      };
      if (fields.dvId !== undefined) updateFields.dv_id = fields.dvId;
      if (fields.allowTools !== undefined) updateFields.allow_tools = fields.allowTools;
      const { data, error } = await supabase
        .from("users")
        .update(updateFields)
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") throw new DuplicateWebookUserDvIdError();
        throw new Error(error.message);
      }
      return data === null ? null : getUserById(supabase, id);
    },
  };
}
