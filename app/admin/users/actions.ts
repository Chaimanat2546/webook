"use server";

import { revalidatePath } from "next/cache";

import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import {
  updateWebookUser,
  type UpdateWebookUserResult,
} from "../../../server/services/webook-users";

const MAX_FORM_BYTES = 16 * 1024;

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function assertFormSize(formData: FormData): void {
  let size = 0;
  const encoder = new TextEncoder();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") throw new Error("Invalid request");
    size += encoder.encode(key).byteLength + encoder.encode(value).byteLength;
  }

  if (size > MAX_FORM_BYTES) throw new Error("Invalid request");
}

export async function updateWebookUserAction(
  formData: FormData,
): Promise<UpdateWebookUserResult> {
  try {
    assertFormSize(formData);
    await requireWebookUserManagerAdmin();

    const result = await updateWebookUser({
      dvId: readString(formData, "dvId"),
      id: readString(formData, "id"),
      name: readString(formData, "name"),
      roleId: readString(formData, "roleId"),
      updateDvId: readString(formData, "section") !== "permissions",
    });

    if (result.ok) revalidatePath("/admin/users");
    return result;
  } catch (error) {
    console.error("WebookUserUpdateFailed", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, message: "ไม่สามารถแก้ไขผู้ใช้ได้ในขณะนี้" };
  }
}

export async function updateWebookUserFormAction(
  _previousState: UpdateWebookUserResult | null,
  formData: FormData,
): Promise<UpdateWebookUserResult> {
  return updateWebookUserAction(formData);
}
