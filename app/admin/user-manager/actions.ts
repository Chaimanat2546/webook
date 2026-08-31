"use server";

import { revalidatePath } from "next/cache";

import { requireCentralUserManagerAdmin } from "../../../server/auth/admin.ts";
import { resolveCentralUserTenant } from "../../../server/central-user-manager/tenant-bindings.ts";
import { runCentralUserOperation } from "../../../server/services/central-user-manager.ts";

const MAX_FORM_BYTES = 16 * 1024;

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function assertFormSize(formData: FormData) {
  let size = 0;
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") throw new Error("Invalid request");
    size += new TextEncoder().encode(key).byteLength + new TextEncoder().encode(value).byteLength;
  }
  if (size > MAX_FORM_BYTES) throw new Error("Invalid request");
}

async function dispatch(action: "list_users" | "create_user" | "reissue_temporary_password" | "suspend_user" | "reactivate_user", formData: FormData) {
  try {
    assertFormSize(formData);
    await requireCentralUserManagerAdmin();
    const tenant = resolveCentralUserTenant(readString(formData, "tenantKey"));
    if (!tenant || !tenant.enabled) throw new Error("Invalid request");
    const operationId = readString(formData, "operationId");
    const payload = action === "list_users"
      ? { page: Number.parseInt(readString(formData, "page"), 10), pageSize: Number.parseInt(readString(formData, "pageSize"), 10) }
      : { email: readString(formData, "email") };
    const result = await runCentralUserOperation({ tenantId: tenant.id, operationId, action, payload });
    revalidatePath("/admin/user-manager");
    return result;
  } catch (error) {
    console.error("CentralUserManagerActionFailed", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, error: { code: "agent_unavailable" as const, message: "ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้" } };
  }
}

export async function listCentralUsersAction(formData: FormData) {
  return dispatch("list_users", formData);
}

export async function createCentralUserAction(formData: FormData) {
  return dispatch("create_user", formData);
}

export async function reissueCentralUserPasswordAction(formData: FormData) {
  return dispatch("reissue_temporary_password", formData);
}

export async function suspendCentralUserAction(formData: FormData) {
  return dispatch("suspend_user", formData);
}

export async function reactivateCentralUserAction(formData: FormData) {
  return dispatch("reactivate_user", formData);
}
