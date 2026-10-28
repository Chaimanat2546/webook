import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const quotationBaseline = "20260806173000_save_quotation_layout_snapshot_before_insert.sql";
const projectPattern = /^webook-ci-integration-[a-f0-9]{8}$/;

export function integrationEnvironment(status, projectId) {
  if (!projectPattern.test(projectId)) throw new Error("Invalid isolated integration project");
  if (!status || status.API_URL !== "http://127.0.0.1:57321"
    || typeof status.ANON_KEY !== "string" || !status.ANON_KEY.trim()
    || typeof status.SERVICE_ROLE_KEY !== "string" || !status.SERVICE_ROLE_KEY.trim()) {
    throw new Error("Invalid isolated integration target or credentials");
  }
  return {
    LOCAL_SUPABASE_URL: status.API_URL,
    LOCAL_SUPABASE_ANON_KEY: status.ANON_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_DB_CONTAINER: `supabase_db_${projectId}`,
    RUN_BOOKING_DB_TESTS: "1",
    RUN_NOTIFICATION_DB_TESTS: "1",
    RUN_DASHBOARD_DB_TESTS: "1",
    RUN_LOCAL_SUPABASE_TESTS: "1",
    RUN_QUOTATION_MIGRATION_UPGRADE_TESTS: "1",
    ICAL_DB_INTEGRATION: "1",
    ICAL_WORKER_INTEGRATION: "1",
  };
}

export function assertCompleteTestRun(output, exitStatus) {
  const counts = Object.fromEntries(["tests", "pass", "fail", "cancelled", "skipped", "todo"].map((name) => {
    const match = output.match(new RegExp(`^# ${name} (\\d+)\\r?$`, "m"));
    return [name, match ? Number(match[1]) : undefined];
  }));
  if (exitStatus !== 0 || !(counts.tests > 0) || counts.pass !== counts.tests
    || counts.fail !== 0 || counts.cancelled !== 0 || counts.skipped !== 0 || counts.todo !== 0
    || /^\s*(?:ok|not ok) \d+[^\n]*# (?:SKIP|TODO)\b/im.test(output)) {
    throw new Error("Integration run must pass every test without skips, cancellations or TODOs");
  }
}

export function prepareIntegrationWorkspace(directory) {
  if (existsSync(directory)) throw new Error("Integration workspace already exists");
  const projectId = `webook-ci-integration-${randomUUID().slice(0, 8)}`;
  const supabase = join(directory, "supabase");
  mkdirSync(join(supabase, "migrations"), { recursive: true });
  const migrations = join(repository, "supabase/migrations");
  if (!existsSync(join(migrations, quotationBaseline))) throw new Error("Quotation integration baseline is missing");
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql") && name <= quotationBaseline).sort()) {
    copyFileSync(join(migrations, name), join(supabase, "migrations", name));
  }
  writeFileSync(join(supabase, "config.toml"), `project_id = "${projectId}"

[api]
enabled = true
port = 57321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]

[db]
port = 57322
shadow_port = 57320
major_version = 17

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"

[studio]
enabled = false

[local_smtp]
enabled = false

[storage]
enabled = false

[realtime]
enabled = false

[edge_runtime]
enabled = false

[analytics]
enabled = false
`);
  writeFileSync(join(supabase, "seed.sql"), `insert into public.roles(id, name)
values (3, '{"en":"Integration fixture member","th":"สมาชิกทดสอบ"}'::jsonb);
`);
  return projectId;
}

// Emit only fixed labels: CLI output may contain local Auth keys and passwords.
export function integrationFailureSummary(output, status) {
  const categories = [
    ["disk-space", /no space left|insufficient disk space/i],
    ["network", /i\/o timeout|TLS handshake|connection reset|network is unreachable|no such host|context deadline exceeded/i],
    ["image-pull", /failed to pull|pull access denied|toomanyrequests|rate limit|manifest unknown/i],
    ["healthcheck", /unhealthy|health check|healthcheck|not ready/i],
    ["port-conflict", /address already in use|port is already allocated/i],
    ["database-connection", /connection refused|could not connect|database system is starting up/i],
    ["migration", /failed to execute|syntax error|SQLSTATE/i],
  ].filter(([, pattern]) => pattern.test(output)).map(([label]) => label);
  return `exit=${Number.isInteger(status) ? status : "unknown"}; ${categories.join(",") || "unclassified"}`;
}

function supabaseCommand(directory, args) {
  const result = spawnSync(process.execPath, [join(repository, "node_modules/supabase/dist/supabase.js"), ...args, "--workdir", directory], {
    cwd: repository, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 480_000,
  });
  if (result.error || result.status !== 0) {
    const summary = integrationFailureSummary(`${result.stdout ?? ""}\n${result.stderr ?? ""}`, result.status);
    throw new Error(`Local Supabase ${args[0]} failed (${summary}); CLI output suppressed to protect credentials`);
  }
  return result.stdout;
}

function workspaceProject(directory) {
  const config = readFileSync(join(directory, "supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id = "([^"]+)"/m)?.[1];
  if (!projectPattern.test(projectId ?? "")) throw new Error("Invalid isolated integration project");
  return projectId;
}

export function runCiIntegration(command) {
  if (!process.env.RUNNER_TEMP || !isAbsolute(process.env.RUNNER_TEMP)) throw new Error("An absolute RUNNER_TEMP is required");
  const directory = join(process.env.RUNNER_TEMP, "webook-ci-integration");
  if (command === "prepare") {
    prepareIntegrationWorkspace(directory);
    console.log("Starting isolated local Supabase quotation fixture");
    supabaseCommand(directory, ["start"]);
    console.log("Isolated local Supabase fixture is ready");
  } else if (command === "test") {
    let status;
    try {
      status = JSON.parse(supabaseCommand(directory, ["status", "--output", "json"]));
    } catch {
      throw new Error("Cannot read isolated local Supabase status; sensitive output suppressed");
    }
    const environment = integrationEnvironment(status, workspaceProject(directory));
    const result = spawnSync(process.execPath, ["--import", "./tests/register-server-only.mjs", "--test", "--test-concurrency=2", "--test-reporter=tap", "tests/**/*.test.ts"], {
      cwd: repository, env: { ...process.env, ...environment }, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    assertCompleteTestRun(result.stdout ?? "", result.error ? null : result.status);
    console.log("Integration gate passed: every test ran with zero failures or skips");
  } else if (command === "stop") {
    if (!existsSync(join(directory, "supabase/config.toml"))) return;
    const projectId = workspaceProject(directory);
    supabaseCommand(directory, ["stop", "--no-backup", "--project-id", projectId]);
    console.log("Removed only the task-owned local Supabase containers and data");
  } else {
    throw new Error("Usage: node scripts/run-ci-integration.mjs <prepare|test|stop>");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCiIntegration(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "CI integration failed");
    process.exitCode = 1;
  }
}
