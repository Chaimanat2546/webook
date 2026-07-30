import { createHash } from "node:crypto";

const MAX_RESPONSE_BYTES = 65_536;
const REQUIRED_PASSWORD_CHARACTERS =
  "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

function failure() {
  throw new Error("Auth attestation failed.");
}

function canonicalTimestamp(clock) {
  const value = clock().toISOString();
  if (new Date(value).toISOString() !== value) failure();
  return value;
}

export async function fetchAuthAttestation(
  projectRef,
  environment = process.env,
  dependencies = {},
  expected = null,
) {
  const accessToken = environment.SUPABASE_ACCESS_TOKEN;
  if (typeof accessToken !== "string" || accessToken.length < 1) failure();
  const fetcher = dependencies.fetch ?? fetch;
  let response;
  try {
    response = await fetcher(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch {
    failure();
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (!response.ok || !Number.isFinite(length) || length > MAX_RESPONSE_BYTES) failure();
  let text;
  try {
    text = await response.text();
  } catch {
    failure();
  }
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) failure();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    failure();
  }
  const checkedAt = expected?.checkedAt ??
    canonicalTimestamp(dependencies.clock ?? (() => new Date()));
  const passwordRequiredCharacters = value.password_required_characters ?? "";
  const values = {
    version: "v1",
    projectRef,
    checkedAt,
    disableSignup: value.disable_signup,
    anonymousSignInsEnabled: value.external_anonymous_users_enabled,
    passwordMinLength: value.password_min_length,
    passwordRequiredCharacters,
    passwordHibpEnabled: value.password_hibp_enabled,
    updatePasswordRequireReauthentication:
      value.security_update_password_require_reauthentication,
  };
  if (
    values.disableSignup !== true ||
    values.anonymousSignInsEnabled !== false ||
    !Number.isSafeInteger(values.passwordMinLength) ||
    values.passwordMinLength !== 8 ||
    passwordRequiredCharacters !== REQUIRED_PASSWORD_CHARACTERS ||
    typeof values.passwordHibpEnabled !== "boolean" ||
    values.updatePasswordRequireReauthentication !== false
  ) failure();
  const result = {
    version: "v1",
    digest: createHash("sha256").update(JSON.stringify(values), "utf8").digest("hex"),
    checkedAt,
  };
  if (
    expected !== null &&
    (
      expected.version !== result.version ||
      expected.digest !== result.digest ||
      expected.checkedAt !== result.checkedAt
    )
  ) failure();
  return result;
}
