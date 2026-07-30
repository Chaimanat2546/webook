import "server-only";

import {
  decodeCanonicalBase64Url,
  encodeCanonicalBase64Url,
  getCentralUserManagerTokenKekConfig,
} from "./config.ts";

const MAX_SQL_INTEGER = 2_147_483_647;
const CANONICAL_RFC_9562_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const encoder = new TextEncoder();

export interface TenantTokenKeyring {
  currentVersion: number;
  keys: ReadonlyMap<number, Uint8Array>;
}

export interface EncryptedTenantToken {
  tenantId: string;
  bearerTokenCiphertext: string;
  bearerTokenFingerprint: string;
  bearerTokenIv: string;
  bearerTokenKekVersion: number;
  bearerTokenVersion: number;
}

interface TenantTokenVaultDependencies {
  crypto?: Pick<Crypto, "getRandomValues" | "subtle">;
  keyring?: TenantTokenKeyring;
}

export class CentralUserManagerTokenVaultError extends Error {
  constructor() {
    super("Central User Manager token vault failed");
    this.name = "CentralUserManagerTokenVaultError";
  }
}

function vaultFailure(): never {
  throw new CentralUserManagerTokenVaultError();
}

function readVersion(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_SQL_INTEGER
  ) {
    return vaultFailure();
  }
  return value;
}

function readTenantId(value: unknown): string {
  if (typeof value !== "string" || !CANONICAL_RFC_9562_UUID.test(value)) {
    return vaultFailure();
  }
  return value;
}

function readToken(value: unknown): Uint8Array {
  const decoded = decodeCanonicalBase64Url(value, 32);
  if (!decoded) {
    return vaultFailure();
  }
  return decoded;
}

function readEncodedBytes(
  value: unknown,
  expectedByteLength: number,
): Uint8Array {
  const decoded = decodeCanonicalBase64Url(value, expectedByteLength);
  if (!decoded) {
    return vaultFailure();
  }
  return decoded;
}

function readKey(
  keyring: TenantTokenKeyring,
  version: number,
): Uint8Array {
  readVersion(keyring.currentVersion);
  const storedKey = keyring.keys.get(version);
  if (!(storedKey instanceof Uint8Array) || storedKey.length !== 32) {
    return vaultFailure();
  }
  return storedKey.slice();
}

function withResolvedKeyring<T>(
  injectedKeyring: TenantTokenKeyring | undefined,
  operation: (keyring: TenantTokenKeyring) => T,
): T {
  if (injectedKeyring) {
    return operation(injectedKeyring);
  }

  const ownedKeyring = getCentralUserManagerTokenKekConfig();
  try {
    return operation(ownedKeyring);
  } finally {
    for (const key of ownedKeyring.keys.values()) {
      key.fill(0);
    }
  }
}

function buildAdditionalData(
  tenantId: string,
  tokenVersion: number,
  kekVersion: number,
): Uint8Array {
  return encoder.encode(
    `CUM-BEARER-TOKEN-V1\n${tenantId}\n${tokenVersion}\n${kekVersion}`,
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

async function importAesKey(
  subtle: SubtleCrypto,
  keyBytes: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  return subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    [usage],
  );
}

async function fingerprintBytes(
  bytes: Uint8Array,
  subtle: SubtleCrypto,
): Promise<string> {
  const digest = new Uint8Array(
    await subtle.digest("SHA-256", toArrayBuffer(bytes)),
  );

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function fingerprintTenantToken(
  token: unknown,
  cryptoDependency: Pick<Crypto, "subtle"> = globalThis.crypto,
): Promise<string> {
  const tokenBytes = readToken(token);
  try {
    return await fingerprintBytes(tokenBytes, cryptoDependency.subtle);
  } catch {
    return vaultFailure();
  } finally {
    tokenBytes.fill(0);
  }
}

export async function encryptTenantToken(
  input: {
    tenantId: unknown;
    token: unknown;
    tokenVersion: unknown;
  },
  dependencies: TenantTokenVaultDependencies = {},
): Promise<EncryptedTenantToken> {
  const tenantId = readTenantId(input.tenantId);
  const tokenVersion = readVersion(input.tokenVersion);
  const { kekVersion, keyBytes } = withResolvedKeyring(
    dependencies.keyring,
    (keyring) => {
      const resolvedVersion = readVersion(keyring.currentVersion);
      return {
        kekVersion: resolvedVersion,
        keyBytes: readKey(keyring, resolvedVersion),
      };
    },
  );
  const tokenBytes = readToken(input.token);
  const cryptoDependency = dependencies.crypto ?? globalThis.crypto;
  const iv = new Uint8Array(12);

  try {
    cryptoDependency.getRandomValues(iv);
    const key = await importAesKey(
      cryptoDependency.subtle,
      keyBytes,
      "encrypt",
    );
    const encrypted = new Uint8Array(
      await cryptoDependency.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(
            buildAdditionalData(tenantId, tokenVersion, kekVersion),
          ),
          tagLength: 128,
        },
        key,
        toArrayBuffer(tokenBytes),
      ),
    );

    if (encrypted.length !== 48) {
      return vaultFailure();
    }

    return {
      tenantId,
      bearerTokenCiphertext: encodeCanonicalBase64Url(encrypted),
      bearerTokenFingerprint: await fingerprintBytes(
        tokenBytes,
        cryptoDependency.subtle,
      ),
      bearerTokenIv: encodeCanonicalBase64Url(iv),
      bearerTokenKekVersion: kekVersion,
      bearerTokenVersion: tokenVersion,
    };
  } catch (error) {
    if (error instanceof CentralUserManagerTokenVaultError) {
      throw error;
    }
    return vaultFailure();
  } finally {
    keyBytes.fill(0);
    tokenBytes.fill(0);
    iv.fill(0);
  }
}

export async function decryptTenantToken(
  record: EncryptedTenantToken,
  dependencies: TenantTokenVaultDependencies = {},
): Promise<string> {
  const tenantId = readTenantId(record.tenantId);
  const tokenVersion = readVersion(record.bearerTokenVersion);
  const kekVersion = readVersion(record.bearerTokenKekVersion);
  const keyBytes = withResolvedKeyring(dependencies.keyring, (keyring) =>
    readKey(keyring, kekVersion),
  );
  const ciphertext = readEncodedBytes(record.bearerTokenCiphertext, 48);
  const iv = readEncodedBytes(record.bearerTokenIv, 12);
  const cryptoDependency = dependencies.crypto ?? globalThis.crypto;
  let plaintext: Uint8Array | null = null;

  try {
    const key = await importAesKey(
      cryptoDependency.subtle,
      keyBytes,
      "decrypt",
    );
    plaintext = new Uint8Array(
      await cryptoDependency.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(
            buildAdditionalData(tenantId, tokenVersion, kekVersion),
          ),
          tagLength: 128,
        },
        key,
        toArrayBuffer(ciphertext),
      ),
    );

    if (plaintext.length !== 32) {
      return vaultFailure();
    }

    return encodeCanonicalBase64Url(plaintext);
  } catch (error) {
    if (error instanceof CentralUserManagerTokenVaultError) {
      throw error;
    }
    return vaultFailure();
  } finally {
    keyBytes.fill(0);
    ciphertext.fill(0);
    iv.fill(0);
    plaintext?.fill(0);
  }
}

export async function rewrapTenantToken(
  record: EncryptedTenantToken,
  dependencies: TenantTokenVaultDependencies = {},
): Promise<EncryptedTenantToken> {
  const token = await decryptTenantToken(record, dependencies);
  const rewrapped = await encryptTenantToken(
    {
      tenantId: record.tenantId,
      token,
      tokenVersion: record.bearerTokenVersion,
    },
    dependencies,
  );
  if (
    rewrapped.bearerTokenKekVersion === record.bearerTokenKekVersion ||
    rewrapped.bearerTokenFingerprint !== record.bearerTokenFingerprint
  ) {
    return vaultFailure();
  }
  return rewrapped;
}
