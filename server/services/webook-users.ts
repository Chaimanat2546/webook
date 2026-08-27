import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireWebookUserManagerAdmin } from "../auth/admin.ts";
import {
  webookUserRepository,
  type WebookManagedUser,
  type WebookUserDetails,
  type WebookUserRepositoryPort,
} from "../repositories/webook-users.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL = /^[0-9 +\-()]*$/;
const LONG_BAN_DURATION = "876000h";

export interface WebookAuthUserAttributes {
  ban_duration?: string;
  email?: string;
  email_confirm?: boolean;
}

export interface WebookAuthAdminClient {
  auth: {
    admin: {
      updateUserById(
        uid: string,
        attributes: WebookAuthUserAttributes,
      ): Promise<{ error: unknown | null }>;
    };
  };
}

interface WebookManagerSession<TClient> {
  supabase: TClient;
  user: { id: string };
}

export interface WebookUserLifecycleDependencies<TClient> {
  authorize(): Promise<WebookManagerSession<TClient>>;
  createAuthAdminClient():
    | WebookAuthAdminClient
    | null
    | Promise<WebookAuthAdminClient | null>;
  repository: WebookUserRepositoryPort<TClient>;
}

export interface UpdateWebookUserInput {
  id: string;
  name: string;
  username: string;
  tel: string;
  email: string;
}

export interface BanWebookUserInput {
  id: string;
  actorUid: string;
}

export type WebookUserMutationResult =
  | { ok: true; user: WebookManagedUser }
  | { ok: false; message: string };

function invalidUserData(): never {
  throw new Error("Invalid user data");
}

function validateId(id: string): string {
  const normalized = typeof id === "string" ? id.trim() : "";
  if (!UUID.test(normalized)) invalidUserData();
  return normalized;
}

function prepareUserDetails(input: UpdateWebookUserInput): WebookUserDetails {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const tel = typeof input.tel === "string" ? input.tel.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

  if (
    !name
    || name.length > 150
    || username.length > 100
    || tel.length > 30
    || !TEL.test(tel)
    || !EMAIL.test(email)
  ) {
    invalidUserData();
  }

  return { name, username, tel, email };
}

function safeResult(message: string): WebookUserMutationResult {
  return { ok: false, message };
}

async function updateAuthUser(
  client: WebookAuthAdminClient,
  uid: string,
  attributes: WebookAuthUserAttributes,
): Promise<boolean> {
  try {
    const { error } = await client.auth.admin.updateUserById(uid, attributes);
    return error === null;
  } catch {
    return false;
  }
}

async function compensateAuthUser(
  client: WebookAuthAdminClient,
  uid: string,
  attributes: WebookAuthUserAttributes,
): Promise<void> {
  await updateAuthUser(client, uid, attributes);
}

function requireMatchingActor(inputActorUid: string, sessionActorUid: string): void {
  if (inputActorUid !== sessionActorUid) throw new Error("Forbidden");
}

async function createAuthAdminClientSafely<TClient>(
  dependencies: WebookUserLifecycleDependencies<TClient>,
): Promise<WebookAuthAdminClient | null> {
  try {
    return await dependencies.createAuthAdminClient();
  } catch {
    return null;
  }
}

export function createWebookUserLifecycleService<TClient>(
  dependencies: WebookUserLifecycleDependencies<TClient>,
) {
  async function updateUser(input: UpdateWebookUserInput): Promise<WebookUserMutationResult> {
    const session = await dependencies.authorize();
    const id = validateId(input.id);
    const changes = prepareUserDetails(input);
    const current = await dependencies.repository.findById(session.supabase, id);
    if (!current) return safeResult("User not found.");

    const hasConflict = await dependencies.repository.findConflict(session.supabase, {
      id,
      username: changes.username,
      email: changes.email,
    });
    if (hasConflict) invalidUserData();

    const emailChanged = changes.email !== current.email.trim().toLowerCase();
    let authClient: WebookAuthAdminClient | null = null;
    if (current.uid && emailChanged) {
      authClient = await createAuthAdminClientSafely(dependencies);
      if (!authClient) return safeResult("Unable to update user.");
      const authUpdated = await updateAuthUser(authClient, current.uid, {
        email: changes.email,
        email_confirm: true,
      });
      if (!authUpdated) return safeResult("Unable to update user.");
    }

    try {
      const user = await dependencies.repository.updateDetails(session.supabase, id, changes);
      return { ok: true, user };
    } catch {
      if (current.uid && authClient) {
        await compensateAuthUser(authClient, current.uid, {
          email: current.email,
          email_confirm: true,
        });
      }
      return safeResult("Unable to update user.");
    }
  }

  async function setBanState(
    input: BanWebookUserInput,
    isBanned: boolean,
  ): Promise<WebookUserMutationResult> {
    const session = await dependencies.authorize();
    requireMatchingActor(input.actorUid, session.user.id);
    const id = validateId(input.id);
    const current = await dependencies.repository.findById(session.supabase, id);
    if (!current) return safeResult("User not found.");
    if (isBanned && current.uid === session.user.id) {
      throw new Error("You cannot ban yourself");
    }

    const desiredDuration = isBanned ? LONG_BAN_DURATION : "none";
    const compensationDuration = isBanned ? "none" : LONG_BAN_DURATION;
    let authClient: WebookAuthAdminClient | null = null;
    if (current.uid) {
      authClient = await createAuthAdminClientSafely(dependencies);
      if (!authClient) {
        return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
      }
      const authUpdated = await updateAuthUser(authClient, current.uid, {
        ban_duration: desiredDuration,
      });
      if (!authUpdated) {
        return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
      }
    }

    try {
      const user = await dependencies.repository.updateBan(session.supabase, id, isBanned);
      return { ok: true, user };
    } catch {
      if (current.uid && authClient) {
        await compensateAuthUser(authClient, current.uid, {
          ban_duration: compensationDuration,
        });
      }
      return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
    }
  }

  return {
    updateWebookUser: updateUser,
    banWebookUser(input: BanWebookUserInput) {
      return setBanState(input, true);
    },
    unbanWebookUser(input: BanWebookUserInput) {
      return setBanState(input, false);
    },
  };
}

const webookUserLifecycleService = createWebookUserLifecycleService<SupabaseClient>({
  authorize: requireWebookUserManagerAdmin,
  async createAuthAdminClient() {
    const { createSupabaseAdminClient } = await import("../../lib/supabase/admin.ts");
    return createSupabaseAdminClient();
  },
  repository: webookUserRepository,
});

export async function updateWebookUser(
  input: UpdateWebookUserInput,
): Promise<WebookUserMutationResult> {
  return webookUserLifecycleService.updateWebookUser(input);
}

export async function banWebookUser(input: BanWebookUserInput): Promise<WebookUserMutationResult> {
  return webookUserLifecycleService.banWebookUser(input);
}

export async function unbanWebookUser(input: BanWebookUserInput): Promise<WebookUserMutationResult> {
  return webookUserLifecycleService.unbanWebookUser(input);
}
