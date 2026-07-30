import { access, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const MAX_CHILD_OUTPUT = 32_768;

function safeFailure(step) {
  throw new Error(`Target deployment failed at ${step}.`);
}

function readEmbeddedAttestation(vars) {
  const value = {
    version: vars?.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION,
    digest: vars?.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST,
    checkedAt: vars?.CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT,
  };
  const checkedAt = new Date(value.checkedAt);
  if (
    value.version !== "v1" ||
    typeof value.digest !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.digest) ||
    typeof value.checkedAt !== "string" ||
    Number.isNaN(checkedAt.getTime()) ||
    checkedAt.toISOString() !== value.checkedAt
  ) safeFailure("target_validation");
  return value;
}

export function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        output += current;
      }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inString && current === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!inString && current === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    output += current;
    if (inString && current === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (current === '"' && !escaped) inString = !inString;
    escaped = false;
  }
  return output;
}

function removeTrailingCommas(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (!inString && current === ",") {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] ?? "")) lookahead += 1;
      if (source[lookahead] === "}" || source[lookahead] === "]") continue;
    }
    output += current;
    if (inString && current === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (current === '"' && !escaped) inString = !inString;
    escaped = false;
  }
  return output;
}

export async function validateTargetRepository(config, attestation = null) {
  const requiredFiles = [
    "package.json",
    "wrangler.jsonc",
    join("app", "(admin)", "api", "internal", "central-user-manager", "v1", "health", "route.ts"),
    join("app", "(admin)", "api", "internal", "central-user-manager", "v1", "operations", "route.ts"),
  ];
  await Promise.all(requiredFiles.map((file) => access(join(config.targetRepo, file))));
  const raw = await readFile(join(config.targetRepo, "wrangler.jsonc"), "utf8");
  if (raw.length > 1_000_000) safeFailure("target_validation");
  let parsed;
  try {
    parsed = JSON.parse(removeTrailingCommas(stripJsonComments(raw)));
  } catch {
    safeFailure("target_validation");
  }
  const vars = parsed?.env?.[config.wranglerEnvironment]?.vars;
  const workerName = parsed?.env?.[config.wranglerEnvironment]?.name;
  const embeddedAttestation = readEmbeddedAttestation(vars);
  const expectedAttestation = attestation ?? embeddedAttestation;
  const packageValue = JSON.parse(
    await readFile(join(config.targetRepo, "package.json"), "utf8"),
  );
  const expected = {
    CENTRAL_USER_MANAGER_AGENT_ENABLED: "true",
    CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED: "true",
    CENTRAL_USER_MANAGER_TENANT_ID: config.tenantId,
    CENTRAL_USER_MANAGER_PROJECT_REF: config.targetSupabaseProjectRef,
    CENTRAL_USER_MANAGER_AGENT_VERSION: config.expectedAgentVersion,
    CENTRAL_USER_MANAGER_SCHEMA_VERSION: config.expectedSchemaVersion,
    CENTRAL_USER_MANAGER_TOKEN_VERSION: String(config.nextTokenVersion),
    CENTRAL_USER_MANAGER_AUTH_ATTESTATION_VERSION: expectedAttestation.version,
    CENTRAL_USER_MANAGER_AUTH_ATTESTATION_DIGEST: expectedAttestation.digest,
    CENTRAL_USER_MANAGER_AUTH_ATTESTATION_CHECKED_AT: expectedAttestation.checkedAt,
  };
  if (
    packageValue?.name === "webook" ||
    workerName !== config.workerName ||
    typeof vars !== "object" ||
    vars === null ||
    Object.entries(expected).some(([key, value]) => vars[key] !== value)
  ) safeFailure("target_validation");
  return embeddedAttestation;
}

const SYSTEM_ENV_KEYS = [
  "PATH",
  "Path",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "CI",
];
const TARGET_PUBLIC_BUILD_ENV_KEYS = [
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];
const COMPILED_PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
  ...TARGET_PUBLIC_BUILD_ENV_KEYS,
];
const CLOUDFLARE_ENV_KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
];

function pickEnvironment(environment, keys) {
  const child = Object.create(null);
  for (const key of keys) {
    if (typeof environment[key] === "string") child[key] = environment[key];
  }
  return child;
}

export function buildTargetBuildEnvironment(
  environment = process.env,
  config = /** @type {{ agentOrigin: string; targetSupabaseProjectRef: string } | null} */ (null),
) {
  const child = pickEnvironment(environment, [
    ...SYSTEM_ENV_KEYS,
    ...TARGET_PUBLIC_BUILD_ENV_KEYS,
  ]);
  if (config !== null) {
    if (
      TARGET_PUBLIC_BUILD_ENV_KEYS.some(
        (key) => typeof child[key] !== "string" || child[key].length === 0,
      )
    ) {
      safeFailure("target_build_environment");
    }
    child.NEXT_PUBLIC_SITE_URL = config.agentOrigin;
    child.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL =
      `https://${config.targetSupabaseProjectRef}.supabase.co`;
  }
  return child;
}

export function buildTargetCloudflareEnvironment(
  environment = process.env,
  cloudflareAccountId = /** @type {string | null} */ (null),
) {
  const child = pickEnvironment(environment, [
    ...SYSTEM_ENV_KEYS,
    ...CLOUDFLARE_ENV_KEYS,
  ]);
  if (typeof cloudflareAccountId === "string") {
    child.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
  }
  return child;
}

export const buildTargetChildEnvironment = buildTargetCloudflareEnvironment;

function serializePublicEnvironment(environment) {
  const value = Object.create(null);
  for (const key of COMPILED_PUBLIC_ENV_KEYS) {
    if (typeof environment[key] === "string") {
      value[key] = environment[key];
    }
  }
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export async function sanitizeTargetCompiledEnvironment(
  config,
  buildEnvironment,
  dependencies = {},
) {
  const artifact = join(
    config.targetRepo,
    ".open-next",
    "cloudflare",
    "next-env.mjs",
  );
  const readStat = dependencies.stat ?? stat;
  const write = dependencies.writeFile ?? writeFile;
  try {
    const metadata = await readStat(artifact);
    if (
      !metadata.isFile() ||
      metadata.size < 1 ||
      metadata.size > 1_000_000
    ) {
      safeFailure("compiled_environment_sanitization");
    }
    const serialized = serializePublicEnvironment(buildEnvironment);
    const source = ["production", "development", "test"]
      .map((mode) => `export const ${mode} = ${serialized};`)
      .join("\n");
    await write(artifact, `${source}\n`, "utf8");
  } catch {
    safeFailure("compiled_environment_sanitization");
  }
}

export async function verifyCloudflareTarget(
  config,
  environment = process.env,
  dependencies = {},
) {
  const token = environment.CLOUDFLARE_API_TOKEN;
  if (typeof token !== "string" || token.length === 0) {
    safeFailure("cloudflare_binding");
  }
  let response;
  try {
    response = await (dependencies.fetch ?? fetch)(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/workers/scripts/${config.workerName}`,
      {
        method: "GET",
        redirect: "error",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  } catch {
    safeFailure("cloudflare_binding");
  }
  if (!response.ok) safeFailure("cloudflare_binding");
  await response.body?.cancel().catch(() => {});
}

function defaultResolveTool(repo, tool) {
  return join(repo, "node_modules", ...tool.split("/"));
}

function defaultRun(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? buildTargetBuildEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let outputBytes = 0;
    const consume = (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_CHILD_OUTPUT) child.kill();
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("child_failed")));
    child.stdin.end(options.input);
  });
}

export async function installTargetToken(config, token, dependencies = {}) {
  const run = dependencies.run ?? defaultRun;
  const resolveTool = dependencies.resolveTool ?? defaultResolveTool;
  const childEnvironment = buildTargetCloudflareEnvironment(
    dependencies.environment ?? process.env,
    config.cloudflareAccountId,
  );
  const wrangler = resolveTool(config.targetRepo, "wrangler/bin/wrangler.js");
  try {
    await run(process.execPath, [
      wrangler,
      "secret",
      "put",
      "CENTRAL_USER_MANAGER_BEARER_TOKEN",
      "--env",
      config.wranglerEnvironment,
    ], {
      cwd: config.targetRepo,
      input: `${token}\n`,
      env: childEnvironment,
    });
  } catch {
    safeFailure("target_secret_install");
  }
}

export async function deployTargetOnly(config, dependencies = {}) {
  const run = dependencies.run ?? defaultRun;
  const resolveTool = dependencies.resolveTool ?? defaultResolveTool;
  const sanitizeCompiledEnvironment =
    dependencies.sanitizeCompiledEnvironment ??
    sanitizeTargetCompiledEnvironment;
  const buildEnvironment = buildTargetBuildEnvironment(
    dependencies.environment ?? process.env,
    config,
  );
  const deployEnvironment = buildTargetCloudflareEnvironment(
    dependencies.environment ?? process.env,
    config.cloudflareAccountId,
  );
  const openNext = resolveTool(
    config.targetRepo,
    "@opennextjs/cloudflare/dist/cli/index.js",
  );
  try {
    await run(process.execPath, [openNext, "build"], {
      cwd: config.targetRepo,
      env: buildEnvironment,
    });
    await sanitizeCompiledEnvironment(config, buildEnvironment);
    await run(process.execPath, [
      openNext,
      "deploy",
      "--env",
      config.wranglerEnvironment,
    ], {
      cwd: config.targetRepo,
      env: deployEnvironment,
    });
  } catch {
    safeFailure("target_only_deploy");
  }
}

export async function installTargetTokenAndDeploy(config, token, dependencies = {}) {
  await installTargetToken(config, token, dependencies);
  await deployTargetOnly(config, dependencies);
}
