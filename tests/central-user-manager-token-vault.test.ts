import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CentralUserManagerTokenConfigError,
  getCentralUserManagerTokenKekConfig,
} from "../server/central-user-manager/config.ts";
import {
  CentralUserManagerTokenVaultError,
  decryptTenantToken,
  encryptTenantToken,
  fingerprintTenantToken,
  type TenantTokenKeyring,
} from "../server/central-user-manager/token-vault.ts";

function encodeBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function bytes(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256);
}

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenantId = "22222222-2222-4222-8222-222222222222";
const token = encodeBase64Url(bytes(0));
const otherToken = encodeBase64Url(bytes(1));
const kek = encodeBase64Url(bytes(32));
const otherKek = encodeBase64Url(bytes(64));

function tamperLast(value: string): string {
  const replacement = value.endsWith("A") ? "B" : "A";
  return `${value.slice(0, -1)}${replacement}`;
}

function keyring(
  currentVersion = 1,
  entries: Array<[number, Uint8Array]> = [[1, bytes(32)]],
): TenantTokenKeyring {
  return {
    currentVersion,
    keys: new Map(entries),
  };
}

function deterministicCrypto(ivByte: number): Pick<
  Crypto,
  "getRandomValues" | "subtle"
> {
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array instanceof Uint8Array) {
        assert.equal(array.byteLength, 12);
        array.fill(ivByte);
      }
      return array;
    },
    subtle: globalThis.crypto.subtle,
  };
}

async function expectVaultError(operation: () => Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof CentralUserManagerTokenVaultError);
    assert.equal(error.message, "Central User Manager token vault failed");
    return true;
  });
}

describe("Central User Manager token config", () => {
  it("loads one canonical 32-byte KEK at the exact positive version", () => {
    const config = getCentralUserManagerTokenKekConfig({
      CENTRAL_USER_MANAGER_TOKEN_KEK: kek,
      CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "7",
    });

    assert.equal(config.currentVersion, 7);
    assert.deepEqual(config.keys.get(7), bytes(32));
    assert.equal(config.keys.size, 1);
  });

  it("fails closed for missing, malformed, noncanonical, or invalid-version config", () => {
    const invalidEnvironments = [
      {},
      { CENTRAL_USER_MANAGER_TOKEN_KEK: kek },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: kek,
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "0",
      },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: kek,
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "1.5",
      },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: kek,
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "2147483648",
      },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: `${kek}=`,
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "1",
      },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: "A".repeat(42),
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "1",
      },
      {
        CENTRAL_USER_MANAGER_TOKEN_KEK: `${"A".repeat(42)}B`,
        CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION: "1",
      },
    ];

    for (const environment of invalidEnvironments) {
      assert.throws(
        () => getCentralUserManagerTokenKekConfig(environment),
        (error: unknown) => {
          assert.ok(error instanceof CentralUserManagerTokenConfigError);
          assert.equal(
            error.message,
            "Central User Manager token configuration is invalid",
          );
          assert.doesNotMatch(error.message, new RegExp(kek));
          return true;
        },
      );
    }
  });
});

describe("Central User Manager token vault", () => {
  it("encrypts raw token bytes with the exact bounded storage representation", async () => {
    const injectedKey = bytes(32);
    const encrypted = await encryptTenantToken(
      { tenantId, token, tokenVersion: 3 },
      {
        crypto: deterministicCrypto(9),
        keyring: keyring(1, [[1, injectedKey]]),
      },
    );

    assert.deepEqual(encrypted, {
      tenantId,
      bearerTokenCiphertext:
        "RNmR4MmXdMWQuhtkqVIWJOz91p3B0KljyTgcGMh96kgUM1FRI5FL87gG2uboibAs",
      bearerTokenFingerprint:
        "630dcd2966c4336691125448bbb25b4ff412a49c732db2c8abc1b8581bd710dd",
      bearerTokenIv: "CQkJCQkJCQkJCQkJ",
      bearerTokenKekVersion: 1,
      bearerTokenVersion: 3,
    });
    assert.match(encrypted.bearerTokenCiphertext, /^[A-Za-z0-9_-]{64}$/);
    assert.match(encrypted.bearerTokenFingerprint, /^[0-9a-f]{64}$/);

    const serialized = JSON.stringify(encrypted);
    assert.doesNotMatch(serialized, new RegExp(token));
    assert.doesNotMatch(serialized, new RegExp(kek));
    assert.equal(Object.hasOwn(encrypted, "token"), false);
    assert.deepEqual(injectedKey, bytes(32));
  });

  it("uses a fresh 96-bit IV and round-trips the exact canonical token", async () => {
    const first = await encryptTenantToken(
      { tenantId, token, tokenVersion: 1 },
      { keyring: keyring() },
    );
    const second = await encryptTenantToken(
      { tenantId, token, tokenVersion: 1 },
      { keyring: keyring() },
    );

    assert.equal(first.bearerTokenIv.length, 16);
    assert.notEqual(first.bearerTokenIv, second.bearerTokenIv);
    assert.notEqual(
      first.bearerTokenCiphertext,
      second.bearerTokenCiphertext,
    );
    assert.equal(
      await decryptTenantToken(first, { keyring: keyring() }),
      token,
    );
  });

  it("binds ciphertext to Tenant, token version, KEK version, and exact key", async () => {
    const sameKeyTwoVersions = keyring(1, [
      [1, bytes(32)],
      [2, bytes(32)],
    ]);
    const encrypted = await encryptTenantToken(
      { tenantId, token, tokenVersion: 1 },
      { crypto: deterministicCrypto(5), keyring: sameKeyTwoVersions },
    );

    for (const record of [
      { ...encrypted, tenantId: otherTenantId },
      { ...encrypted, bearerTokenVersion: 2 },
      { ...encrypted, bearerTokenKekVersion: 2 },
      {
        ...encrypted,
        bearerTokenCiphertext: tamperLast(
          encrypted.bearerTokenCiphertext,
        ),
      },
      {
        ...encrypted,
        bearerTokenIv: tamperLast(encrypted.bearerTokenIv),
      },
    ]) {
      await expectVaultError(() =>
        decryptTenantToken(record, { keyring: sameKeyTwoVersions }),
      );
    }

    await expectVaultError(() =>
      decryptTenantToken(encrypted, {
        keyring: keyring(1, [[1, bytes(64)]]),
      }),
    );
    await expectVaultError(() =>
      decryptTenantToken(encrypted, { keyring: keyring(9, [[9, bytes(32)]]) }),
    );
  });

  it("rejects invalid tokens, identities, versions, and record encodings", async () => {
    for (const input of [
      { tenantId, token: `${token}=`, tokenVersion: 1 },
      { tenantId, token: "A".repeat(42), tokenVersion: 1 },
      {
        tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        token,
        tokenVersion: 1,
      },
      { tenantId, token, tokenVersion: 0 },
      { tenantId, token, tokenVersion: 1.5 },
      { tenantId, token, tokenVersion: 2147483648 },
    ]) {
      await expectVaultError(() =>
        encryptTenantToken(input, { keyring: keyring() }),
      );
    }

    const encrypted = await encryptTenantToken(
      { tenantId, token, tokenVersion: 1 },
      { crypto: deterministicCrypto(4), keyring: keyring() },
    );
    await expectVaultError(() =>
      decryptTenantToken(
        { ...encrypted, bearerTokenCiphertext: "A".repeat(63) },
        { keyring: keyring() },
      ),
    );
    await expectVaultError(() =>
      decryptTenantToken(
        { ...encrypted, bearerTokenIv: `${"A".repeat(15)}B` },
        { keyring: keyring() },
      ),
    );
  });

  it("fingerprints decoded raw bytes with a stable SHA-256 identifier", async () => {
    assert.equal(
      await fingerprintTenantToken("A".repeat(43)),
      "66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925",
    );
    assert.equal(
      await fingerprintTenantToken(token),
      await fingerprintTenantToken(token),
    );
    assert.notEqual(
      await fingerprintTenantToken(token),
      await fingerprintTenantToken(otherToken),
    );
  });

  it("never exposes raw Web Crypto failure details", async () => {
    const encrypted = await encryptTenantToken(
      { tenantId, token, tokenVersion: 1 },
      { crypto: deterministicCrypto(2), keyring: keyring() },
    );
    const rawDetails = [
      token,
      kek,
      otherKek,
      encrypted.bearerTokenCiphertext,
      encrypted.bearerTokenIv,
    ];

    await assert.rejects(
      () =>
        decryptTenantToken(encrypted, {
          keyring: keyring(1, [[1, bytes(64)]]),
        }),
      (error: unknown) => {
        assert.ok(error instanceof CentralUserManagerTokenVaultError);
        for (const detail of rawDetails) {
          assert.equal(error.message.includes(detail), false);
        }
        return true;
      },
    );
  });
});
