import { isAbsolute, resolve } from "node:path";
import { realpathSync } from "node:fs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const WRANGLER_ENV = /^[A-Za-z0-9_-]{1,64}$/;
const VALUE_FLAGS = new Set([
  "--tenant-id",
  "--display-name",
  "--target-project-ref",
  "--agent-origin",
  "--wrangler-environment",
  "--target-repo",
  "--operator-uid",
  "--agent-version",
  "--schema-version",
  "--expected-token-version",
  "--cloudflare-account-id",
  "--worker-name",
]);

function invalid() {
  throw new Error("Invalid provisioning arguments.");
}

function readPairs(argv) {
  const values = new Map();
  let apply = false;
  let rotate = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (typeof flag !== "string" || flag.startsWith("--token") || flag.includes("bearer-token")) {
      invalid();
    }
    if (flag === "--apply") {
      if (apply) invalid();
      apply = true;
      continue;
    }
    if (flag === "--rotate") {
      if (rotate) invalid();
      rotate = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag) || values.has(flag)) invalid();
    const value = argv[index + 1];
    if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) invalid();
    values.set(flag, value);
    index += 1;
  }
  return { values, apply, rotate };
}

export function parseProvisionArguments(argv, dependencies = {}) {
  const { values, apply, rotate } = readPairs(argv);
  const required = [
    "--tenant-id",
    "--display-name",
    "--target-project-ref",
    "--agent-origin",
    "--wrangler-environment",
    "--target-repo",
    "--operator-uid",
    "--agent-version",
    "--schema-version",
    "--cloudflare-account-id",
    "--worker-name",
  ];
  if (required.some((flag) => !values.has(flag))) invalid();
  const tenantId = values.get("--tenant-id");
  const operatorUid = values.get("--operator-uid");
  const displayName = values.get("--display-name");
  const projectRef = values.get("--target-project-ref");
  const agentOrigin = values.get("--agent-origin");
  const wranglerEnvironment = values.get("--wrangler-environment");
  const agentVersion = values.get("--agent-version");
  const schemaVersion = values.get("--schema-version");
  const targetInput = values.get("--target-repo");
  const cloudflareAccountId = values.get("--cloudflare-account-id");
  const workerName = values.get("--worker-name");
  if (
    !UUID.test(tenantId) ||
    !UUID.test(operatorUid) ||
    displayName.trim() !== displayName ||
    displayName.length < 1 ||
    displayName.length > 120 ||
    !PROJECT_REF.test(projectRef) ||
    !WRANGLER_ENV.test(wranglerEnvironment) ||
    !VERSION.test(agentVersion) ||
    !VERSION.test(schemaVersion) ||
    !/^[0-9a-f]{32}$/.test(cloudflareAccountId) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(workerName) ||
    !isAbsolute(targetInput)
  ) invalid();
  let origin;
  try {
    const url = new URL(agentOrigin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.includes(".")
    ) invalid();
    origin = url.origin;
  } catch {
    invalid();
  }
  const resolveTargetRepo =
    dependencies.resolveTargetRepo ??
    ((value) => realpathSync(resolve(value)));
  const targetRepo = resolveTargetRepo(targetInput);
  const expectedRaw = values.get("--expected-token-version");
  if ((rotate && expectedRaw === undefined) || (!rotate && expectedRaw !== undefined)) invalid();
  const expectedTokenVersion = expectedRaw === undefined ? 0 : Number(expectedRaw);
  if (
    !Number.isSafeInteger(expectedTokenVersion) ||
    expectedTokenVersion < 0 ||
    (rotate && expectedTokenVersion === 0)
  ) invalid();
  return {
    apply,
    mode: rotate ? "rotate" : "onboard",
    tenantId,
    displayName,
    targetSupabaseProjectRef: projectRef,
    agentOrigin: origin,
    wranglerEnvironment,
    targetRepo,
    operatorUid,
    expectedAgentVersion: agentVersion,
    expectedSchemaVersion: schemaVersion,
    expectedTokenVersion,
    nextTokenVersion: expectedTokenVersion + 1,
    cloudflareAccountId,
    workerName,
  };
}
