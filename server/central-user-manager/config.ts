import "server-only";

const MAX_SQL_INTEGER = 2_147_483_647;
const CANONICAL_BASE64URL = /^[A-Za-z0-9_-]+$/;

export class CentralUserManagerTokenConfigError extends Error {
  constructor() {
    super("Central User Manager token configuration is invalid");
    this.name = "CentralUserManagerTokenConfigError";
  }
}

export function encodeCanonicalBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeCanonicalBase64Url(
  value: unknown,
  expectedByteLength: number,
): Uint8Array | null {
  if (
    typeof value !== "string" ||
    !CANONICAL_BASE64URL.test(value) ||
    value.includes("=")
  ) {
    return null;
  }

  try {
    const standard = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = standard.padEnd(
      standard.length + ((4 - (standard.length % 4)) % 4),
      "=",
    );
    const binary = atob(padded);
    const decoded = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );

    if (
      decoded.length !== expectedByteLength ||
      encodeCanonicalBase64Url(decoded) !== value
    ) {
      decoded.fill(0);
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function readKekVersion(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw new CentralUserManagerTokenConfigError();
  }

  const version = Number(value);
  if (!Number.isSafeInteger(version) || version > MAX_SQL_INTEGER) {
    throw new CentralUserManagerTokenConfigError();
  }

  return version;
}

export function getCentralUserManagerTokenKekConfig(
  environment: Record<string, string | undefined> = process.env,
): {
  currentVersion: number;
  keys: ReadonlyMap<number, Uint8Array>;
} {
  const currentVersion = readKekVersion(
    environment.CENTRAL_USER_MANAGER_TOKEN_KEK_VERSION,
  );
  const key = decodeCanonicalBase64Url(
    environment.CENTRAL_USER_MANAGER_TOKEN_KEK,
    32,
  );

  if (!key) {
    throw new CentralUserManagerTokenConfigError();
  }

  const previousRaw = environment.CENTRAL_USER_MANAGER_TOKEN_KEK_PREVIOUS;
  const previousVersionRaw =
    environment.CENTRAL_USER_MANAGER_TOKEN_KEK_PREVIOUS_VERSION;
  const previousPairAbsent =
    (previousRaw === undefined && previousVersionRaw === undefined) ||
    (previousRaw === "" && previousVersionRaw === "");
  const previousPairPresent =
    typeof previousRaw === "string" &&
    previousRaw.length > 0 &&
    typeof previousVersionRaw === "string" &&
    previousVersionRaw.length > 0;
  if (!previousPairAbsent && !previousPairPresent) {
    key.fill(0);
    throw new CentralUserManagerTokenConfigError();
  }

  const keys = new Map([[currentVersion, key]]);
  if (previousPairPresent) {
    let previousVersion: number;
    try {
      previousVersion = readKekVersion(previousVersionRaw);
    } catch {
      key.fill(0);
      throw new CentralUserManagerTokenConfigError();
    }
    const previousKey = decodeCanonicalBase64Url(previousRaw, 32);
    if (
      !previousKey ||
      previousVersion >= currentVersion ||
      previousKey.every((byte, index) => byte === key[index])
    ) {
      key.fill(0);
      previousKey?.fill(0);
      throw new CentralUserManagerTokenConfigError();
    }
    keys.set(previousVersion, previousKey);
  }

  return { currentVersion, keys };
}
