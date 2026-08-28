import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WebookManagedRole, WebookManagedUser } from "../../lib/webook-users";
import {
  createWebookUsersRepository,
  type WebookUserSortBy,
  type WebookUserSortDirection,
  type WebookUsersRepository,
} from "../repositories/webook-users.ts";

const USER_NAME_MAX_LENGTH = 150;
const SMALLINT_MAX = 32_767;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const WEBOOK_USERS_PAGE_SIZE = 8;
const WEBOOK_USER_SORT_FIELDS: readonly WebookUserSortBy[] = ["name", "username", "email", "role", "dvId"];

interface WebookUserServiceDependencies {
  createAdminClient?: () => SupabaseClient | null;
  repository?: WebookUsersRepository;
}

export interface WebookUserManagementData {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalUsers: number;
  };
  roles: WebookManagedRole[];
  users: WebookManagedUser[];
}

export interface UpdateWebookUserInput {
  id: string;
  name: string;
  roleId: string;
}

export type UpdateWebookUserResult =
  | { ok: true; user: WebookManagedUser }
  | { ok: false; message: string };

export function normalizeWebookUsersPage(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1;
}

export function normalizeWebookUsersSearch(value: string | undefined): string {
  return (value ?? "").trim();
}

export function normalizeWebookUserRoleIds(values: number[] | undefined): number[] {
  return [...new Set((values ?? []).filter((value) => Number.isSafeInteger(value) && value > 0 && value <= SMALLINT_MAX))]
    .sort((left, right) => left - right);
}

export function normalizeWebookUsersSortBy(value: string | undefined): WebookUserSortBy {
  return WEBOOK_USER_SORT_FIELDS.includes(value as WebookUserSortBy)
    ? value as WebookUserSortBy
    : "name";
}

export function normalizeWebookUsersSortDirection(value: string | undefined): WebookUserSortDirection {
  return value === "desc" ? "desc" : "asc";
}

export async function listWebookUserRoles(
  dependencies: WebookUserServiceDependencies = {},
): Promise<WebookManagedRole[]> {
  const repository = await resolveRepository(dependencies);
  return repository.listRoles();
}

async function resolveRepository(
  dependencies: WebookUserServiceDependencies = {},
): Promise<WebookUsersRepository> {
  if (dependencies.repository) return dependencies.repository;

  const createAdminClient = dependencies.createAdminClient ?? (
    await import("../../lib/supabase/admin.ts")
  ).createSupabaseAdminClient;
  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Webook user management is not configured");

  return createWebookUsersRepository(adminClient);
}

function parseUpdateInput(input: UpdateWebookUserInput):
  | { ok: true; value: { id: string; name: string; roleId: number } }
  | { ok: false; message: string } {
  const id = input.id.trim();
  const name = input.name.trim();
  const rawRoleId = input.roleId.trim();

  if (!UUID_PATTERN.test(id)) {
    return { ok: false, message: "ข้อมูลผู้ใช้ไม่ถูกต้อง" };
  }
  if (!name || name.length > USER_NAME_MAX_LENGTH) {
    return { ok: false, message: "กรุณาระบุชื่อไม่เกิน 150 ตัวอักษร" };
  }
  if (!/^\d+$/.test(rawRoleId)) {
    return { ok: false, message: "สิทธิ์ผู้ใช้ที่เลือกไม่ถูกต้อง" };
  }

  const roleId = Number(rawRoleId);
  if (!Number.isSafeInteger(roleId) || roleId < 1 || roleId > SMALLINT_MAX) {
    return { ok: false, message: "สิทธิ์ผู้ใช้ที่เลือกไม่ถูกต้อง" };
  }

  return { ok: true, value: { id, name, roleId } };
}

export async function listWebookUserManagementData(
  {
    page: pageInput,
    roleIds: roleIdsInput,
    search: searchInput,
    sortBy: sortByInput,
    sortDirection: sortDirectionInput,
    roles: suppliedRoles,
    ...dependencies
  }: WebookUserServiceDependencies & {
    page?: number;
    roleIds?: number[];
    roles?: WebookManagedRole[];
    search?: string;
    sortBy?: string;
    sortDirection?: string;
  } = {},
): Promise<WebookUserManagementData> {
  const repository = await resolveRepository(dependencies);
  const page = normalizeWebookUsersPage(pageInput);
  const roleIds = normalizeWebookUserRoleIds(roleIdsInput);
  const search = normalizeWebookUsersSearch(searchInput);
  const sortBy = normalizeWebookUsersSortBy(sortByInput);
  const sortDirection = normalizeWebookUsersSortDirection(sortDirectionInput);
  const [initialUserPage, roles] = await Promise.all([
    repository.listUsers({ page, pageSize: WEBOOK_USERS_PAGE_SIZE, roleIds, search, sortBy, sortDirection }),
    suppliedRoles ? Promise.resolve(suppliedRoles) : repository.listRoles(),
  ]);
  const totalPages = Math.max(1, Math.ceil(initialUserPage.totalUsers / WEBOOK_USERS_PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const userPage = effectivePage === page
    ? initialUserPage
    : await repository.listUsers({ page: effectivePage, pageSize: WEBOOK_USERS_PAGE_SIZE, roleIds, search, sortBy, sortDirection });

  return {
    pagination: {
      page: effectivePage,
      pageSize: WEBOOK_USERS_PAGE_SIZE,
      totalPages,
      totalUsers: initialUserPage.totalUsers,
    },
    roles,
    users: userPage.users,
  };
}

export async function getWebookUserForManagement(
  id: string,
  dependencies: WebookUserServiceDependencies = {},
): Promise<WebookManagedUser | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const repository = await resolveRepository(dependencies);
  return repository.getUser(id);
}

export async function updateWebookUser(
  input: UpdateWebookUserInput,
  dependencies: WebookUserServiceDependencies = {},
): Promise<UpdateWebookUserResult> {
  const parsed = parseUpdateInput(input);
  if (!parsed.ok) return parsed;

  const repository = await resolveRepository(dependencies);
  if (!(await repository.roleExists(parsed.value.roleId))) {
    return { ok: false, message: "สิทธิ์ผู้ใช้ที่เลือกไม่ถูกต้อง" };
  }

  const user = await repository.updateUser(parsed.value.id, {
    name: parsed.value.name,
    roleId: parsed.value.roleId,
  });
  if (!user) return { ok: false, message: "ไม่พบผู้ใช้ที่ต้องการแก้ไข" };

  return { ok: true, user };
}
