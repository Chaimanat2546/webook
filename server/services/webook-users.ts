import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WebookManagedRole, WebookManagedUser } from "../../lib/webook-users";
import {
  createWebookUsersRepository,
  type WebookUsersRepository,
} from "../repositories/webook-users.ts";

const USER_NAME_MAX_LENGTH = 150;
const SMALLINT_MAX = 32_767;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface WebookUserServiceDependencies {
  createAdminClient?: () => SupabaseClient | null;
  repository?: WebookUsersRepository;
}

export interface WebookUserManagementData {
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
    return { ok: false, message: "Role ที่เลือกไม่ถูกต้อง" };
  }

  const roleId = Number(rawRoleId);
  if (!Number.isSafeInteger(roleId) || roleId < 1 || roleId > SMALLINT_MAX) {
    return { ok: false, message: "Role ที่เลือกไม่ถูกต้อง" };
  }

  return { ok: true, value: { id, name, roleId } };
}

export async function listWebookUserManagementData(
  dependencies: WebookUserServiceDependencies = {},
): Promise<WebookUserManagementData> {
  const repository = await resolveRepository(dependencies);
  const [users, roles] = await Promise.all([
    repository.listUsers(),
    repository.listRoles(),
  ]);

  return { roles, users };
}

export async function updateWebookUser(
  input: UpdateWebookUserInput,
  dependencies: WebookUserServiceDependencies = {},
): Promise<UpdateWebookUserResult> {
  const parsed = parseUpdateInput(input);
  if (!parsed.ok) return parsed;

  const repository = await resolveRepository(dependencies);
  if (!(await repository.roleExists(parsed.value.roleId))) {
    return { ok: false, message: "Role ที่เลือกไม่ถูกต้อง" };
  }

  const user = await repository.updateUser(parsed.value.id, {
    name: parsed.value.name,
    roleId: parsed.value.roleId,
  });
  if (!user) return { ok: false, message: "ไม่พบผู้ใช้ที่ต้องการแก้ไข" };

  return { ok: true, user };
}
