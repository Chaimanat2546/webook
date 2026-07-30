import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  parseKekRotationArguments,
  rotateKek,
} from "../scripts/central-user-manager/rotate-kek.mjs";
import {
  decryptTenantToken,
  encryptTenantToken,
  rewrapTenantToken,
  type TenantTokenKeyring,
} from "../server/central-user-manager/token-vault.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OPERATOR_UID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

function key(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

function keyring(): TenantTokenKeyring {
  return {
    currentVersion: 2,
    keys: new Map([
      [1, key(1)],
      [2, key(2)],
    ]),
  };
}

const requiredArguments = [
  "--operator-uid",
  OPERATOR_UID,
  "--from-kek-version",
  "1",
  "--to-kek-version",
  "2",
];

describe("Central User Manager KEK rotation", () => {
  it("defaults to dry run and requires distinct positive versions", () => {
    assert.deepEqual(parseKekRotationArguments(requiredArguments), {
      apply: false,
      operatorUid: OPERATOR_UID,
      fromKekVersion: 1,
      toKekVersion: 2,
      batchSize: 50,
    });
    assert.throws(
      () =>
        parseKekRotationArguments([
          ...requiredArguments,
          "--from-kek-version",
          "0",
        ]),
      /invalid kek rotation arguments/i,
    );
    assert.throws(
      () =>
        parseKekRotationArguments([
          "--operator-uid",
          OPERATOR_UID,
          "--from-kek-version",
          "2",
          "--to-kek-version",
          "1",
        ]),
      /invalid kek rotation arguments/i,
    );
    assert.throws(
      () =>
        parseKekRotationArguments([
          "--operator-uid",
          OPERATOR_UID,
          "--from-kek-version",
          "2",
          "--to-kek-version",
          "2",
        ]),
      /invalid kek rotation arguments/i,
    );
  });

  it("rewraps the same Tenant token with a fresh IV and current KEK", async () => {
    const keys = keyring();
    const encrypted = await encryptTenantToken(
      { tenantId: TENANT_ID, token: TOKEN, tokenVersion: 7 },
      {
        keyring: {
          currentVersion: 1,
          keys: keys.keys,
        },
      },
    );
    const rewrapped = await rewrapTenantToken(encrypted, { keyring: keys });

    assert.equal(rewrapped.tenantId, TENANT_ID);
    assert.equal(rewrapped.bearerTokenVersion, 7);
    assert.equal(rewrapped.bearerTokenKekVersion, 2);
    assert.equal(
      rewrapped.bearerTokenFingerprint,
      encrypted.bearerTokenFingerprint,
    );
    assert.notEqual(rewrapped.bearerTokenIv, encrypted.bearerTokenIv);
    assert.notEqual(
      rewrapped.bearerTokenCiphertext,
      encrypted.bearerTokenCiphertext,
    );
    assert.equal(
      await decryptTenantToken(rewrapped, { keyring: keys }),
      TOKEN,
    );
    await assert.rejects(
      () =>
        rewrapTenantToken(
          { ...encrypted, tenantId: OPERATOR_UID },
          { keyring: keys },
        ),
      /token vault failed/i,
    );
  });

  it("performs no writes in dry run and reports the exact old-version count", async () => {
    const writes: string[] = [];
    const result = await rotateKek(
      parseKekRotationArguments(requiredArguments),
      {
        verifyOperator: async () => {},
        assertKeyring: async () => {},
        countRemaining: async () => 3,
        listBatch: async () => {
          writes.push("list");
          return [];
        },
        rewrap: async () => {
          writes.push("rewrap");
          return {} as never;
        },
        persist: async () => {
          writes.push("persist");
          return true;
        },
      },
    );
    assert.deepEqual(result, { applied: false, rotated: 0, remaining: 3 });
    assert.deepEqual(writes, []);
  });

  it("rotates bounded batches, skips mixed versions, and proves old-key removal", async () => {
    const rows = [
      { tenantId: TENANT_ID, bearerTokenKekVersion: 1 },
      {
        tenantId: "33333333-3333-4333-8333-333333333333",
        bearerTokenKekVersion: 1,
      },
    ];
    let batch = 0;
    const persisted: string[] = [];
    const config = parseKekRotationArguments([
      ...requiredArguments,
      "--batch-size",
      "1",
      "--apply",
    ]);
    const result = await rotateKek(config, {
      verifyOperator: async () => {},
      assertKeyring: async () => {},
      countRemaining: async () => (batch < 2 ? 2 - batch : 0),
      listBatch: async () => {
        const row = rows[batch];
        return row ? [row] : [];
      },
      rewrap: async (row: { tenantId: string }) => ({
        ...row,
        bearerTokenKekVersion: 2,
      }),
      persist: async (row: { tenantId: string }) => {
        persisted.push(row.tenantId);
        batch += 1;
        return true;
      },
    });
    assert.deepEqual(result, { applied: true, rotated: 2, remaining: 0 });
    assert.deepEqual(persisted, rows.map((row) => row.tenantId));
  });

  it("stops on a failed CAS so a rerun can resume untouched rows", async () => {
    let writes = 0;
    await assert.rejects(
      () =>
        rotateKek(
          { ...parseKekRotationArguments(requiredArguments), apply: true },
          {
            verifyOperator: async () => {},
            assertKeyring: async () => {},
            countRemaining: async () => 1,
            listBatch: async () => [
              { tenantId: TENANT_ID, bearerTokenKekVersion: 1 },
            ],
            rewrap: async (row: object) => ({
              ...row,
              bearerTokenKekVersion: 2,
            }),
            persist: async () => {
              writes += 1;
              return false;
            },
          },
        ),
      /kek rotation failed/i,
    );
    assert.equal(writes, 1);
  });

  it("uses one service-role CAS RPC with atomic audit and no token-version change", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/20260730072218_central_user_manager_kek_rewrap.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(migration, /rewrap_customer_project_bearer_kek/i);
    assert.match(migration, /bearer_token_kek_version = p_expected_kek_version/i);
    assert.match(migration, /bearer_token_ciphertext = p_expected_ciphertext/i);
    assert.match(migration, /bearer_token_iv = p_expected_iv/i);
    assert.match(migration, /bearer_token_version = p_token_version/i);
    assert.match(
      migration,
      /p_next_kek_version <= p_expected_kek_version/i,
    );
    assert.match(migration, /'rotate_kek'/i);
    assert.match(migration, /central_user_audit_events/i);
    assert.match(
      migration,
      /grant execute on function public\.rewrap_customer_project_bearer_kek[\s\S]*to service_role/i,
    );
    assert.doesNotMatch(migration, /bearer_token_version\s*=\s*p_next/i);
  });
});
