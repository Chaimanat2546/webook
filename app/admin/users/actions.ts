"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
      id: readString(formData, "id"),
      name: readString(formData, "name"),
      roleId: readString(formData, "roleId"),
    });

    if (result.ok) revalidatePath("/admin/users");
    return result;
  } catch (error) {
    console.error("WebookUserUpdateFailed", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, message: "ไม่สามารถแก้ไขผู้ใช้ได้ในขณะนี้" };
  }
}

export async function updateWebookUserFormAction(formData: FormData): Promise<void> {
  const result = await updateWebookUserAction(formData);
  if (!result.ok) {
    const id = readString(formData, "id");
    const section = readString(formData, "section") === "permissions" ? "&section=permissions" : "";
    redirect(`/admin/users/${id}?error=${encodeURIComponent(result.message)}${section}`);
  }

  redirect("/admin/users?success=1");
}
