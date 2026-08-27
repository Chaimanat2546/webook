"use server";

import { revalidatePath } from "next/cache";

import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import {
  banWebookUser,
  unbanWebookUser,
  updateWebookUser,
  type WebookUserMutationResult,
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

function revalidateAfterSuccess(result: WebookUserMutationResult): WebookUserMutationResult {
  if (result.ok) revalidatePath("/admin/users");
  return result;
}

export async function updateWebookUserAction(formData: FormData): Promise<WebookUserMutationResult> {
  await requireWebookUserManagerAdmin();
  assertFormSize(formData);

  return revalidateAfterSuccess(await updateWebookUser({
    id: readString(formData, "id"),
    name: readString(formData, "name"),
    username: readString(formData, "username"),
    tel: readString(formData, "tel"),
    email: readString(formData, "email"),
  }));
}

export async function banWebookUserAction(formData: FormData): Promise<WebookUserMutationResult> {
  const { user } = await requireWebookUserManagerAdmin();
  assertFormSize(formData);

  return revalidateAfterSuccess(await banWebookUser({
    id: readString(formData, "id"),
    actorUid: user.id,
  }));
}

export async function unbanWebookUserAction(formData: FormData): Promise<WebookUserMutationResult> {
  const { user } = await requireWebookUserManagerAdmin();
  assertFormSize(formData);

  return revalidateAfterSuccess(await unbanWebookUser({
    id: readString(formData, "id"),
    actorUid: user.id,
  }));
}
