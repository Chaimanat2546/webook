import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireWebookUserManagerAdmin } from "../auth/admin.ts";
import {
  webookUserRepository,
  WebookUserConflictError,
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
      getUserById(uid: string): Promise<{
        data: { user: { email?: string | null } | null };
        error: unknown | null;
      }>;
      updateUserById(
        uid: string,
        attributes: WebookAuthUserAttributes,
      ): Promise<{ error: unknown | null }>;
    };
  };
}

interface WebookManagerSession<TClient> {
  supabase: TClient;
  user: { id: string; email?: string | null };
}

export interface WebookUserLifecycleDependencies<TClient> {
  authorize(): Promise<WebookManagerSession<TClient>>;
  createAuthAdminClient():
    | WebookAuthAdminClient
    | null
    | Promise<WebookAuthAdminClient | null>;
  createManagementClient(): TClient | null | Promise<TClient | null>;
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

async function getAuthUserEmail(
  client: WebookAuthAdminClient,
  uid: string,
): Promise<string | null> {
  try {
    const { data, error } = await client.auth.admin.getUserById(uid);
    const email = data.user?.email;
    return error === null && typeof email === "string" && email.trim() ? email : null;
  } catch {
    return null;
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

async function createManagementClientSafely<TClient>(
  dependencies: WebookUserLifecycleDependencies<TClient>,
): Promise<TClient | null> {
  try {
    return await dependencies.createManagementClient();
  } catch {
    return null;
  }
}

function createManagedRecordSerializer() {
  const operationTails = new Map<string, Promise<void>>();

  return async function serializeManagedRecord<T>(
    id: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = operationTails.get(id) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    operationTails.set(id, current);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (operationTails.get(id) === current) operationTails.delete(id);
    }
  };
}

function isActorRecord<TClient>(
  session: WebookManagerSession<TClient>,
  user: WebookManagedUser,
): boolean {
  if (user.uid === session.user.id) return true;
  const actorEmail = session.user.email?.trim().toLowerCase();
  return Boolean(actorEmail) && user.email.trim().toLowerCase() === actorEmail;
}

export function createWebookUserLifecycleService<TClient>(
  dependencies: WebookUserLifecycleDependencies<TClient>,
) {
  const serializeManagedRecord = createManagedRecordSerializer();

  async function updateUser(input: UpdateWebookUserInput): Promise<WebookUserMutationResult> {
    const session = await dependencies.authorize();
    const id = validateId(input.id);
    const changes = prepareUserDetails(input);
    return serializeManagedRecord(id, async () => {
      let current: WebookManagedUser | null;
      try {
        current = await dependencies.repository.findById(session.supabase, id);
      } catch {
        return safeResult("Unable to update user.");
      }
      if (!current) return safeResult("User not found.");

      let hasConflict: boolean;
      try {
        hasConflict = await dependencies.repository.findConflict(session.supabase, {
          id,
          username: changes.username,
          email: changes.email,
        });
      } catch {
        return safeResult("Unable to update user.");
      }
      if (hasConflict) invalidUserData();

      const managementClient = await createManagementClientSafely(dependencies);
      if (!managementClient) return safeResult("Unable to update user.");

      const lockToken = globalThis.crypto.randomUUID();
      try {
        const acquired = await dependencies.repository.acquireLifecycleLock(
          managementClient,
          id,
          lockToken,
        );
        if (!acquired) return safeResult("Unable to update user.");
      } catch {
        return safeResult("Unable to update user.");
      }

      try {
        const emailChanged = changes.email !== current.email.trim().toLowerCase();
        const linkedAuthUid = current.uid ?? (
          isActorRecord(session, current) ? session.user.id : null
        );
        let authClient: WebookAuthAdminClient | null = null;
        let previousAuthEmail: string | null = null;
        if (linkedAuthUid && emailChanged) {
          authClient = await createAuthAdminClientSafely(dependencies);
          if (!authClient) return safeResult("Unable to update user.");
          previousAuthEmail = await getAuthUserEmail(authClient, linkedAuthUid);
          if (!previousAuthEmail) return safeResult("Unable to update user.");
          const authUpdated = await updateAuthUser(authClient, linkedAuthUid, {
            email: changes.email,
            email_confirm: true,
          });
          if (!authUpdated) return safeResult("Unable to update user.");
        }

        try {
          const user = await dependencies.repository.updateDetails(
            managementClient,
            id,
            changes,
            lockToken,
          );
          return { ok: true, user };
        } catch (error) {
          if (linkedAuthUid && authClient && previousAuthEmail) {
            await compensateAuthUser(authClient, linkedAuthUid, {
              email: previousAuthEmail,
              email_confirm: true,
            });
          }
          if (error instanceof WebookUserConflictError || (
            error !== null
            && typeof error === "object"
            && "code" in error
            && error.code === "23505"
          )) {
            invalidUserData();
          }
          return safeResult("Unable to update user.");
        }
      } finally {
        try {
          await dependencies.repository.releaseLifecycleLock(managementClient, id, lockToken);
        } catch {
          // The lease expires automatically; release failure must not mask the saga result.
        }
      }
    });
  }

  async function setBanState(
    input: BanWebookUserInput,
    isBanned: boolean,
  ): Promise<WebookUserMutationResult> {
    const session = await dependencies.authorize();
    requireMatchingActor(input.actorUid, session.user.id);
    const id = validateId(input.id);
    return serializeManagedRecord(id, async () => {
      let current: WebookManagedUser | null;
      try {
        current = await dependencies.repository.findById(session.supabase, id);
      } catch {
        return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
      }
      if (!current) return safeResult("User not found.");
      if (isBanned && isActorRecord(session, current)) {
        throw new Error("You cannot ban yourself");
      }

      const managementClient = await createManagementClientSafely(dependencies);
      if (!managementClient) {
        return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
      }

      const lockToken = globalThis.crypto.randomUUID();
      try {
        const acquired = await dependencies.repository.acquireLifecycleLock(
          managementClient,
          id,
          lockToken,
        );
        if (!acquired) {
          return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
        }
      } catch {
        return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
      }

      try {
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
          const user = await dependencies.repository.updateBan(
            managementClient,
            id,
            isBanned,
            lockToken,
          );
          return { ok: true, user };
        } catch {
          if (current.uid && authClient) {
            await compensateAuthUser(authClient, current.uid, {
              ban_duration: compensationDuration,
            });
          }
          return safeResult(isBanned ? "Unable to ban user." : "Unable to unban user.");
        }
      } finally {
        try {
          await dependencies.repository.releaseLifecycleLock(managementClient, id, lockToken);
        } catch {
          // The lease expires automatically; release failure must not mask the saga result.
        }
      }
    });
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
  async createManagementClient() {
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
