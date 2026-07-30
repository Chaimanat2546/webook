import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { getCentralUserManagerTokenKekConfig } from "../../server/central-user-manager/config.ts";
import { rewrapTenantToken } from "../../server/central-user-manager/token-vault.ts";
import {
  countCustomerProjectsByKekVersion,
  listCustomerProjectsForKekRotation,
  rewrapCustomerProjectBearerKek,
} from "../../server/repositories/customer-projects.ts";
import {
  createCentralProvisioningClient,
  verifyCentralOperator,
} from "./provisioning/supabase-auth.mjs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_SQL_INTEGER = 2_147_483_647;
const MAX_BATCH_SIZE = 100;

function failure() {
  throw new Error("Central User Manager KEK rotation failed.");
}

function invalidArguments() {
  throw new Error("Invalid KEK rotation arguments.");
}

function readPositiveInteger(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    invalidArguments();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_SQL_INTEGER) {
    invalidArguments();
  }
  return parsed;
}

export function parseKekRotationArguments(argv) {
  const values = new Map();
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--apply") {
      if (apply) invalidArguments();
      apply = true;
      continue;
    }
    if (
      flag !== "--operator-uid" &&
      flag !== "--from-kek-version" &&
      flag !== "--to-kek-version" &&
      flag !== "--batch-size"
    ) invalidArguments();
    if (values.has(flag)) invalidArguments();
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      invalidArguments();
    }
    values.set(flag, value);
    index += 1;
  }
  const operatorUid = values.get("--operator-uid");
  const fromKekVersion = readPositiveInteger(
    values.get("--from-kek-version"),
  );
  const toKekVersion = readPositiveInteger(values.get("--to-kek-version"));
  const batchSize = values.has("--batch-size")
    ? readPositiveInteger(values.get("--batch-size"))
    : 50;
  if (
    typeof operatorUid !== "string" ||
    !UUID.test(operatorUid) ||
    toKekVersion <= fromKekVersion ||
    batchSize > MAX_BATCH_SIZE
  ) invalidArguments();
  return {
    apply,
    operatorUid,
    fromKekVersion,
    toKekVersion,
    batchSize,
  };
}

export async function rotateKek(config, dependencies) {
  await dependencies.verifyOperator(config.operatorUid);
  await dependencies.assertKeyring(
    config.fromKekVersion,
    config.toKekVersion,
  );
  const initial = await dependencies.countRemaining(config.fromKekVersion);
  if (!config.apply) {
    return { applied: false, rotated: 0, remaining: initial };
  }

  let rotated = 0;
  while (true) {
    const rows = await dependencies.listBatch(
      config.fromKekVersion,
      config.batchSize,
    );
    if (!Array.isArray(rows)) failure();
    if (rows.length === 0) break;
    if (rows.length > config.batchSize) failure();
    for (const row of rows) {
      if (row.bearerTokenKekVersion !== config.fromKekVersion) failure();
      const rewrapped = await dependencies.rewrap(row);
      if (rewrapped.bearerTokenKekVersion !== config.toKekVersion) failure();
      if (!(await dependencies.persist(row, rewrapped))) failure();
      rotated += 1;
    }
  }

  const remaining = await dependencies.countRemaining(config.fromKekVersion);
  if (remaining !== 0) failure();
  return { applied: true, rotated, remaining };
}

export async function runRotateKekCli(
  argv = process.argv.slice(2),
  environment = process.env,
  io = {},
) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  let keyring;
  try {
    const config = parseKekRotationArguments(argv);
    const client = createCentralProvisioningClient(environment);
    keyring = getCentralUserManagerTokenKekConfig(environment);
    const result = await rotateKek(config, {
      verifyOperator: (uid) => verifyCentralOperator(client, uid),
      assertKeyring: (fromVersion, toVersion) => {
        if (
          keyring.currentVersion !== toVersion ||
          !keyring.keys.has(fromVersion) ||
          !keyring.keys.has(toVersion)
        ) failure();
      },
      countRemaining: (version) =>
        countCustomerProjectsByKekVersion(client, version),
      listBatch: (version, limit) =>
        listCustomerProjectsForKekRotation(client, {
          kekVersion: version,
          limit,
        }),
      rewrap: (row) => rewrapTenantToken(row, { keyring }),
      persist: (expected, rewrapped) =>
        rewrapCustomerProjectBearerKek(client, {
          expected,
          rewrapped,
          actorUid: config.operatorUid,
          eventId: randomUUID(),
        }),
    });
    stdout.write(
      result.applied
        ? `KEK rotation completed; ${result.rotated} Tenant tokens rewrapped and old-version rows remaining: 0.\n`
        : `Dry run found ${result.remaining} Tenant tokens on KEK version ${config.fromKekVersion}; no changes applied.\n`,
    );
    return 0;
  } catch {
    stderr.write(
      "Central User Manager KEK rotation failed safely; keep both keys configured and retry.\n",
    );
    return 1;
  } finally {
    if (keyring) {
      for (const keyBytes of keyring.keys.values()) keyBytes.fill(0);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runRotateKekCli();
}
