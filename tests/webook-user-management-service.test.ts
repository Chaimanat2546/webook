import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findWebookUserConflict,
  listWebookUsers,
  updateWebookUserBan,
  updateWebookUserDetails,
  type WebookManagedUser,
  type WebookUserRepositoryPort,
} from "../server/repositories/webook-users.ts";
import {
  createWebookUserLifecycleService,
  type WebookAuthUserAttributes,
} from "../server/services/webook-users.ts";

const actorUid = "10000000-0000-4000-8000-000000000001";
const actorEmail = "admin@example.com";
const actorUserId = "20000000-0000-4000-8000-000000000001";
const userUid = "10000000-0000-4000-8000-000000000002";
const userId = "20000000-0000-4000-8000-000000000002";
const lockToken = "30000000-0000-4000-8000-000000000001";

function managedUser(overrides: Partial<WebookManagedUser> = {}): WebookManagedUser {
  return {
    id: userId,
    uid: userUid,
    name: "Existing User",
    username: "existing",
    tel: "081 234 5678",
    email: "existing@example.com",
    isBanned: false,
    updatedAt: "2026-08-27T05:00:00.000Z",
    ...overrides,
  };
}

interface FakeRepositoryState {
  users: Map<string, WebookManagedUser>;
  conflicts: Set<string>;
  failAuthClientCreation: boolean;
  failConflict: boolean;
  failDetailsUpdate: boolean;
  failFind: boolean;
  failBanUpdate: boolean;
  uniqueDetailsConflict: boolean;
  locks: Map<string, string>;
  updated: WebookManagedUser | null;
}

function createFakeRepository(initialUsers: WebookManagedUser[]): {
  repository: WebookUserRepositoryPort<object>;
  state: FakeRepositoryState;
} {
  const state: FakeRepositoryState = {
    users: new Map(initialUsers.map((user) => [user.id, user])),
    conflicts: new Set(),
    failAuthClientCreation: false,
    failConflict: false,
    failDetailsUpdate: false,
    failFind: false,
    failBanUpdate: false,
    uniqueDetailsConflict: false,
    locks: new Map(),
    updated: null,
  };
  const repository: WebookUserRepositoryPort<object> = {
    async acquireLifecycleLock(_client, id, ownerToken) {
      if (state.locks.has(id)) return false;
      state.locks.set(id, ownerToken);
      return true;
    },
    async releaseLifecycleLock(_client, id, ownerToken) {
      if (state.locks.get(id) === ownerToken) state.locks.delete(id);
    },
    async findById(_client, id) {
      if (state.failFind) throw new Error("raw database lookup failure");
      return state.users.get(id) ?? null;
    },
    async findConflict(_client, input) {
      if (state.failConflict) throw new Error("raw database conflict failure");
      return state.conflicts.has(input.username) || state.conflicts.has(input.email);
    },
    async updateDetails(_client, id, changes, ownerToken) {
      if (!ownerToken || state.locks.get(id) !== ownerToken) {
        throw new Error("missing lifecycle lock");
      }
      if (state.uniqueDetailsConflict) {
        throw Object.assign(new Error("duplicate key value leaks schema"), { code: "23505" });
      }
      if (state.failDetailsUpdate) throw new Error("database details update failed");
      const existing = state.users.get(id);
      if (!existing) throw new Error("missing user");
      const updated = { ...existing, ...changes };
      state.users.set(id, updated);
      state.updated = updated;
      return updated;
    },
    async updateBan(_client, id, isBanned, ownerToken) {
      if (!ownerToken || state.locks.get(id) !== ownerToken) {
        throw new Error("missing lifecycle lock");
      }
      if (state.failBanUpdate) throw new Error("database ban update failed");
      const existing = state.users.get(id);
      if (!existing) throw new Error("missing user");
      const updated = { ...existing, isBanned };
      state.users.set(id, updated);
      state.updated = updated;
      return updated;
    },
  };
  return { repository, state };
}

function createAuthAdmin(events: string[], actualEmail = "existing@example.com") {
  const calls: Array<[string, string, WebookAuthUserAttributes]> = [];
  const lookups: string[] = [];
  return {
    calls,
    lookups,
    auth: {
      admin: {
        async getUserById(uid: string) {
          events.push(`auth:get:${actualEmail}`);
          lookups.push(uid);
          return { data: { user: { email: actualEmail } }, error: null };
        },
        async updateUserById(uid: string, attributes: WebookAuthUserAttributes) {
          events.push(`auth:${String(attributes.ban_duration ?? attributes.email)}`);
          calls.push(["updateUserById", uid, attributes]);
          return { data: { user: null }, error: null };
        },
      },
    },
  };
}

function createServiceFixture(
  initialUsers: WebookManagedUser[] = [managedUser()],
  actualAuthEmail = "existing@example.com",
) {
  const client = { scope: "request" };
  const managementClient = { scope: "management" };
  const events: string[] = [];
  const writeClients: object[] = [];
  const { repository, state } = createFakeRepository(initialUsers);
  const auth = createAuthAdmin(events, actualAuthEmail);
  const service = createWebookUserLifecycleService({
    async authorize() {
      events.push("authorize");
      return { supabase: client, user: { id: actorUid, email: actorEmail } };
    },
    createAuthAdminClient() {
      if (state.failAuthClientCreation) throw new Error("missing Auth configuration");
      return auth;
    },
    createManagementClient() {
      return managementClient;
    },
    repository: {
      async acquireLifecycleLock(currentClient, id, ownerToken) {
        events.push("repository:acquire-lock");
        return repository.acquireLifecycleLock(currentClient, id, ownerToken);
      },
      async releaseLifecycleLock(currentClient, id, ownerToken) {
        events.push("repository:release-lock");
        return repository.releaseLifecycleLock(currentClient, id, ownerToken);
      },
      async findById(currentClient, id) {
        events.push("repository:find");
        return repository.findById(currentClient, id);
      },
      async findConflict(currentClient, input) {
        events.push("repository:conflict");
        return repository.findConflict(currentClient, input);
      },
      async updateDetails(currentClient, id, changes, ownerToken) {
        events.push("repository:update-details");
        writeClients.push(currentClient);
        return repository.updateDetails(currentClient, id, changes, ownerToken);
      },
      async updateBan(currentClient, id, isBanned, ownerToken) {
        events.push(`repository:update-ban:${String(isBanned)}`);
        writeClients.push(currentClient);
        return repository.updateBan(currentClient, id, isBanned, ownerToken);
      },
    },
  });
  return { auth, events, managementClient, service, state, writeClients };
}

describe("Webook users repository", () => {
  it("queries only users and maps unknown row values explicitly", async () => {
    const tables: string[] = [];
    const query = {
      select() {
        return this;
      },
      order() {
        return this;
      },
      then<TResult1 = unknown, TResult2 = never>(
        onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        return Promise.resolve({
          data: [{
            id: userId,
            uid: 42,
            name: null,
            username: "pat",
            tel: undefined,
            email: "PAT@EXAMPLE.COM",
            is_banned: 1,
            updated_at: false,
          }],
          error: null,
        }).then(onFulfilled, onRejected);
      },
    };
    const client = {
      from(table: string) {
        tables.push(table);
        return query;
      },
    } as unknown as SupabaseClient;

    const users = await listWebookUsers(client);

    assert.deepEqual(tables, ["users"]);
    assert.deepEqual(users, [{
      id: userId,
      uid: null,
      name: "",
      username: "pat",
      tel: "",
      email: "PAT@EXAMPLE.COM",
      isBanned: false,
      updatedAt: null,
    }]);
  });

  it("matches normalized email literally when it contains percent or underscore", async () => {
    const filters: Array<[string, string, string]> = [];
    const client = {
      from() {
        const query = {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            filters.push(["eq", column, value]);
            return this;
          },
          ilike(column: string, value: string) {
            filters.push(["ilike", column, value]);
            return this;
          },
          neq() {
            return this;
          },
          limit() {
            return Promise.resolve({ data: [], error: null });
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const conflict = await findWebookUserConflict(client, {
      id: userId,
      username: "literal-user",
      email: "percent%_literal@example.com",
    });

    assert.equal(conflict, false);
    assert.deepEqual(filters, [
      ["eq", "username", "literal-user"],
      ["eq", "email", "percent%_literal@example.com"],
    ]);
  });

  it("reports an atomic database uniqueness conflict with code 23505", async () => {
    const client = {
      rpc(name: string, input: Record<string, unknown>) {
        assert.equal(name, "update_webook_user_details");
        assert.deepEqual(input, {
          p_id: userId,
          p_name: "Updated User",
          p_username: "updated",
          p_tel: "081",
          p_email: "updated@example.com",
          p_lock_token: lockToken,
        });
        return {
          single() {
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: "duplicate key value leaks schema" },
            });
          },
        };
      },
    } as unknown as SupabaseClient;

    await assert.rejects(
      () => updateWebookUserDetails(client, userId, {
        name: "Updated User",
        username: "updated",
        tel: "081",
        email: "updated@example.com",
      }, lockToken),
      (error: unknown) => error instanceof Error && error.name === "WebookUserConflictError",
    );
  });

  it("routes Ban persistence through the narrow database function", async () => {
    const client = {
      rpc(name: string, input: Record<string, unknown>) {
        assert.equal(name, "set_webook_user_ban");
        assert.deepEqual(input, { p_id: userId, p_is_banned: true, p_lock_token: lockToken });
        return {
          single() {
            return Promise.resolve({
              data: {
                ...managedUser(),
                is_banned: true,
                isBanned: undefined,
                updatedAt: undefined,
                updated_at: "2026-08-27T06:00:00.000Z",
              },
              error: null,
            });
          },
        };
      },
    } as unknown as SupabaseClient;

    const updated = await updateWebookUserBan(client, userId, true, lockToken);

    assert.equal(updated.isBanned, true);
    assert.equal(updated.updatedAt, "2026-08-27T06:00:00.000Z");
  });
});

describe("Webook user lifecycle service", () => {
  it("authorizes before repository access", async () => {
    const { events, service } = createServiceFixture();

    await service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "+66 (81) 234-5678",
      email: "updated@example.com",
    });

    assert.equal(events[0], "authorize");
    assert.equal(events[1], "repository:find");
  });

  it("uses the server-only management client for local writes", async () => {
    const fixture = createServiceFixture();

    const updated = await fixture.service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "existing@example.com",
    });
    const banned = await fixture.service.banWebookUser({ id: userId, actorUid });

    assert.equal(updated.ok, true);
    assert.equal(banned.ok, true);
    assert.deepEqual(fixture.writeClients, [fixture.managementClient, fixture.managementClient]);
  });

  it("rejects an edit with invalid fields or a duplicate identity", async () => {
    const { service, state } = createServiceFixture();

    await assert.rejects(() => service.updateWebookUser({
      id: userId,
      name: " ",
      username: "used",
      tel: "081",
      email: "not-email",
    }), /Invalid user data/);
    await assert.rejects(() => service.updateWebookUser({
      id: "not-a-uuid",
      name: "A",
      username: "new",
      tel: "081#",
      email: "new@example.com",
    }), /Invalid user data/);

    state.conflicts.add("used");
    await assert.rejects(() => service.updateWebookUser({
      id: userId,
      name: "Valid Name",
      username: "used",
      tel: "081",
      email: "valid@example.com",
    }), /Invalid user data/);
  });

  it("normalizes an email, updates Auth first, and then persists details", async () => {
    const { auth, events, service, state } = createServiceFixture();

    const result = await service.updateWebookUser({
      id: userId,
      name: "  Updated User  ",
      username: "  updated  ",
      tel: " +66 (81) 234-5678 ",
      email: "  UPDATED@Example.COM ",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(auth.calls, [["updateUserById", userUid, {
      email: "updated@example.com",
      email_confirm: true,
    }]]);
    assert.ok(events.indexOf("repository:acquire-lock") < events.indexOf("auth:updated@example.com"));
    assert.ok(events.indexOf("auth:updated@example.com") < events.indexOf("repository:update-details"));
    assert.deepEqual(state.updated, managedUser({
      name: "Updated User",
      username: "updated",
      tel: "+66 (81) 234-5678",
      email: "updated@example.com",
    }));
  });

  it("restores the previous Auth email if local persistence fails", async () => {
    const { auth, service, state } = createServiceFixture();
    state.failDetailsUpdate = true;

    const result = await service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    });

    assert.deepEqual(result, { ok: false, message: "Unable to update user." });
    assert.deepEqual(auth.calls, [
      ["updateUserById", userUid, { email: "updated@example.com", email_confirm: true }],
      ["updateUserById", userUid, { email: "existing@example.com", email_confirm: true }],
    ]);
    assert.deepEqual(auth.lookups, [userUid]);
  });

  it("restores the actual Auth email when the mapped local email is empty", async () => {
    const { auth, service, state } = createServiceFixture(
      [managedUser({ email: "" })],
      "canonical-auth@example.com",
    );
    state.failDetailsUpdate = true;

    const result = await service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    });

    assert.deepEqual(result, { ok: false, message: "Unable to update user." });
    assert.deepEqual(auth.calls, [
      ["updateUserById", userUid, { email: "updated@example.com", email_confirm: true }],
      ["updateUserById", userUid, { email: "canonical-auth@example.com", email_confirm: true }],
    ]);
    assert.deepEqual(auth.lookups, [userUid]);
  });

  it("returns a safe failure if the Auth Admin client cannot be created", async () => {
    const { service, state } = createServiceFixture();
    state.failAuthClientCreation = true;

    const result = await service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    });

    assert.deepEqual(result, { ok: false, message: "Unable to update user." });
    assert.equal(state.locks.size, 0);
  });

  it("returns safe failures for repository lookup and conflict errors", async () => {
    const lookup = createServiceFixture();
    lookup.state.failFind = true;

    assert.deepEqual(await lookup.service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    }), { ok: false, message: "Unable to update user." });
    assert.deepEqual(
      await lookup.service.banWebookUser({ id: userId, actorUid }),
      { ok: false, message: "Unable to ban user." },
    );

    const conflict = createServiceFixture();
    conflict.state.failConflict = true;
    const result = await conflict.service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    });

    assert.deepEqual(result, { ok: false, message: "Unable to update user." });
    assert.doesNotMatch(result.message, /raw database/i);
  });

  it("compensates Auth and rejects an atomic uniqueness conflict as invalid data", async () => {
    const { auth, service, state } = createServiceFixture();
    state.uniqueDetailsConflict = true;

    await assert.rejects(() => service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    }), /Invalid user data/);
    assert.deepEqual(auth.calls, [
      ["updateUserById", userUid, { email: "updated@example.com", email_confirm: true }],
      ["updateUserById", userUid, { email: "existing@example.com", email_confirm: true }],
    ]);
  });

  it("updates only the local record when no Auth uid is linked", async () => {
    const { auth, service, state } = createServiceFixture([managedUser({ uid: null })]);

    const result = await service.updateWebookUser({
      id: userId,
      name: "Updated User",
      username: "updated",
      tel: "081",
      email: "updated@example.com",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(auth.calls, []);
    assert.equal(state.updated?.email, "updated@example.com");
  });

  it("keeps an email-matched administrator linked when they edit their own email", async () => {
    const actor = managedUser({ id: actorUserId, uid: null, email: actorEmail });
    const { auth, service, state } = createServiceFixture([actor], actorEmail);

    const result = await service.updateWebookUser({
      id: actorUserId,
      name: "Updated Admin",
      username: "updated-admin",
      tel: "081",
      email: "updated-admin@example.com",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(auth.lookups, [actorUid]);
    assert.deepEqual(auth.calls, [[
      "updateUserById",
      actorUid,
      { email: "updated-admin@example.com", email_confirm: true },
    ]]);
    assert.equal(state.updated?.email, "updated-admin@example.com");
  });

  it("bans Auth, then persists the local Ban state", async () => {
    const { auth, events, service, state } = createServiceFixture();

    const result = await service.banWebookUser({ id: userId, actorUid });

    assert.equal(result.ok, true);
    assert.deepEqual(auth.calls, [["updateUserById", userUid, { ban_duration: "876000h" }]]);
    assert.ok(events.indexOf("auth:876000h") < events.indexOf("repository:update-ban:true"));
    assert.equal(state.updated?.isBanned, true);
  });

  it("refuses a self-Ban", async () => {
    const actor = managedUser({ id: actorUserId, uid: actorUid });
    const { auth, service, state } = createServiceFixture([actor]);

    await assert.rejects(
      () => service.banWebookUser({ id: actorUserId, actorUid }),
      /cannot ban yourself/i,
    );

    assert.deepEqual(auth.calls, []);
    assert.equal(state.updated, null);
  });

  it("refuses a self-Ban for an unlinked record resolved by email", async () => {
    const actor = managedUser({ id: actorUserId, uid: null, email: actorEmail.toUpperCase() });
    const { auth, service, state } = createServiceFixture([actor]);

    await assert.rejects(
      () => service.banWebookUser({ id: actorUserId, actorUid }),
      /cannot ban yourself/i,
    );

    assert.deepEqual(auth.calls, []);
    assert.equal(state.updated, null);
  });

  it("compensates Auth if local Ban persistence fails", async () => {
    const { auth, service, state } = createServiceFixture();
    state.failBanUpdate = true;

    const result = await service.banWebookUser({ id: userId, actorUid });

    assert.deepEqual(result, { ok: false, message: "Unable to ban user." });
    assert.deepEqual(auth.calls, [
      ["updateUserById", userUid, { ban_duration: "876000h" }],
      ["updateUserById", userUid, { ban_duration: "none" }],
    ]);
  });

  it("unbans Auth, then persists locally and reapplies the Ban on failure", async () => {
    const banned = managedUser({ isBanned: true });
    const success = createServiceFixture([banned]);

    const result = await success.service.unbanWebookUser({ id: userId, actorUid });

    assert.equal(result.ok, true);
    assert.deepEqual(success.auth.calls, [["updateUserById", userUid, { ban_duration: "none" }]]);
    assert.equal(success.state.updated?.isBanned, false);

    const failed = createServiceFixture([banned]);
    failed.state.failBanUpdate = true;
    const failedResult = await failed.service.unbanWebookUser({ id: userId, actorUid });

    assert.deepEqual(failedResult, { ok: false, message: "Unable to unban user." });
    assert.deepEqual(failed.auth.calls, [
      ["updateUserById", userUid, { ban_duration: "none" }],
      ["updateUserById", userUid, { ban_duration: "876000h" }],
    ]);
  });

  it("bans and unbans an unlinked user through local state only", async () => {
    const fixture = createServiceFixture([managedUser({ uid: null })]);

    const banned = await fixture.service.banWebookUser({ id: userId, actorUid });
    const unbanned = await fixture.service.unbanWebookUser({ id: userId, actorUid });

    assert.equal(banned.ok && banned.user.isBanned, true);
    assert.equal(unbanned.ok && unbanned.user.isBanned, false);
    assert.deepEqual(fixture.auth.calls, []);
  });

  it("serializes cross-system sagas for the same managed user", async () => {
    const events: string[] = [];
    const users = new Map([[userId, managedUser()]]);
    const locks = new Map<string, string>();
    let releaseFirstAuthUpdate: (() => void) | undefined;
    const firstAuthUpdateStarted = new Promise<void>((resolve) => {
      releaseFirstAuthUpdate = resolve;
    });
    let continueFirstAuthUpdate: (() => void) | undefined;
    const firstAuthUpdateBlocked = new Promise<void>((resolve) => {
      continueFirstAuthUpdate = resolve;
    });
    let authUpdateCount = 0;

    const service = createWebookUserLifecycleService({
      async authorize() {
        return { supabase: {}, user: { id: actorUid, email: actorEmail } };
      },
      createAuthAdminClient() {
        return {
          auth: {
            admin: {
              async getUserById() {
                return { data: { user: { email: "existing@example.com" } }, error: null };
              },
              async updateUserById(_uid: string, attributes: WebookAuthUserAttributes) {
                authUpdateCount += 1;
                events.push(`auth:${String(attributes.ban_duration)}`);
                if (authUpdateCount === 1) {
                  releaseFirstAuthUpdate?.();
                  await firstAuthUpdateBlocked;
                }
                return { error: null };
              },
            },
          },
        };
      },
      createManagementClient() {
        return {};
      },
      repository: {
        async acquireLifecycleLock(_client, id, ownerToken) {
          events.push("repository:acquire-lock");
          if (locks.has(id)) return false;
          locks.set(id, ownerToken);
          return true;
        },
        async releaseLifecycleLock(_client, id, ownerToken) {
          events.push("repository:release-lock");
          if (locks.get(id) === ownerToken) locks.delete(id);
        },
        async findById(_client, id) {
          events.push("repository:find");
          return users.get(id) ?? null;
        },
        async findConflict() {
          return false;
        },
        async updateDetails(_client, id, changes, ownerToken) {
          if (locks.get(id) !== ownerToken) throw new Error("missing lifecycle lock");
          const current = users.get(id);
          if (!current) throw new Error("missing user");
          const updated = { ...current, ...changes };
          users.set(id, updated);
          return updated;
        },
        async updateBan(_client, id, isBanned, ownerToken) {
          events.push(`repository:update-ban:${String(isBanned)}`);
          if (locks.get(id) !== ownerToken) throw new Error("missing lifecycle lock");
          const current = users.get(id);
          if (!current) throw new Error("missing user");
          const updated = { ...current, isBanned };
          users.set(id, updated);
          return updated;
        },
      },
    });

    const ban = service.banWebookUser({ id: userId, actorUid });
    await firstAuthUpdateStarted;
    const unban = service.unbanWebookUser({ id: userId, actorUid });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(events, ["repository:find", "repository:acquire-lock", "auth:876000h"]);
    continueFirstAuthUpdate?.();
    const [banResult, unbanResult] = await Promise.all([ban, unban]);

    assert.equal(banResult.ok, true);
    assert.equal(unbanResult.ok, true);
    assert.equal(users.get(userId)?.isBanned, false);
    assert.deepEqual(events, [
      "repository:find",
      "repository:acquire-lock",
      "auth:876000h",
      "repository:update-ban:true",
      "repository:release-lock",
      "repository:find",
      "repository:acquire-lock",
      "auth:none",
      "repository:update-ban:false",
      "repository:release-lock",
    ]);
  });

  it("prevents separate service instances from starting competing Auth sagas", async () => {
    const { repository, state } = createFakeRepository([managedUser()]);
    const authEvents: string[] = [];
    let markFirstAuthStarted = (): void => undefined;
    const firstAuthStarted = new Promise<void>((resolve) => {
      markFirstAuthStarted = resolve;
    });
    let continueFirstAuth = (): void => undefined;
    const firstAuthBlocked = new Promise<void>((resolve) => {
      continueFirstAuth = resolve;
    });

    function isolatedService(name: "first" | "second") {
      return createWebookUserLifecycleService({
        async authorize() {
          return { supabase: {}, user: { id: actorUid, email: actorEmail } };
        },
        createAuthAdminClient() {
          return {
            auth: {
              admin: {
                async getUserById() {
                  return { data: { user: { email: "existing@example.com" } }, error: null };
                },
                async updateUserById(_uid: string, attributes: WebookAuthUserAttributes) {
                  authEvents.push(`${name}:${String(attributes.ban_duration)}`);
                  if (name === "first" && attributes.ban_duration === "876000h") {
                    markFirstAuthStarted();
                    await firstAuthBlocked;
                  }
                  return { error: null };
                },
              },
            },
          };
        },
        createManagementClient() {
          return {};
        },
        repository,
      });
    }

    const firstService = isolatedService("first");
    const secondService = isolatedService("second");
    const first = firstService.banWebookUser({ id: userId, actorUid });
    await firstAuthStarted;

    const second = await secondService.unbanWebookUser({ id: userId, actorUid });

    assert.deepEqual(second, { ok: false, message: "Unable to unban user." });
    assert.deepEqual(authEvents, ["first:876000h"]);
    continueFirstAuth();
    const firstResult = await first;

    assert.equal(firstResult.ok, true);
    assert.equal(state.users.get(userId)?.isBanned, true);
    assert.equal(state.locks.size, 0);
  });
});
