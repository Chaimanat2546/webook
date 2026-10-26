import { readFileSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

// Dedicated container only: no ports, no remote connection, no user databases.
const container = "webook-login-history-tests";
function sql(source) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: source, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "local_database_test_failed");
}
sql("drop schema if exists test cascade; drop schema if exists login_history_private cascade; drop schema if exists auth cascade; drop schema public cascade; create schema public; drop role if exists anon; drop role if exists authenticated; drop role if exists service_role;");
sql(readFileSync(new URL("../tests/fixtures/login-history-db.sql", import.meta.url), "utf8"));
for (const name of readdirSync("supabase/migrations").filter(name => /login_history|webook_user_role_guard/.test(name)).sort()) {
  sql(readFileSync(`supabase/migrations/${name}`, "utf8"));
}
for (const name of readdirSync("supabase/tests").filter(name => /^login-history.*\.sql$/.test(name)).sort()) {
  sql(readFileSync(`supabase/tests/${name}`, "utf8"));
  console.log(`PASS ${name}`);
}

function concurrentSql(source) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"]);
    let diagnostic = "";
    child.stderr.on("data", chunk => { diagnostic += String(chunk); });
    child.stdout.resume();
    child.on("error", reject);
    child.on("close", code => resolve({ code, diagnostic }));
    child.stdin.end(source);
  });
}
const user = "10000000-0000-4000-8000-000000000001";
const session = "30000000-0000-4000-8000-000000000001";
const records = await Promise.all(["first", "second"].map(os => concurrentSql(`set role service_role; select public.login_history_record('${user}','${session}',now(),null,'${os}','unknown','unknown');`)));
assert.ok(records.every(result => result.code === 0), "concurrent inserts both return the one history record");
sql(`select test.ok((select count(*)=1 from public.login_history where user_id='${user}'),'concurrent inserts do not duplicate');`);
const reports = await Promise.all(["skipped", "denied"].map(status => concurrentSql(`set role service_role; select public.login_history_attach('${user}','${session}',(select id from public.login_history where user_id='${user}'),'${status}',null,null,null,null);`)));
assert.equal(reports.filter(result => result.code === 0).length, 1, "exactly one concurrent terminal report wins");
assert.ok(reports.some(result => result.diagnostic.includes("history_already_reported")), "losing report gets a conflict");
sql(`insert into public.login_history(user_id,session_id,logged_in_at) select '${user}',gen_random_uuid(),now()-interval '91 days' from generate_series(1,1001);`);
const purges = await Promise.all([concurrentSql("set role service_role; select public.login_history_purge();"), concurrentSql("set role service_role; select public.login_history_purge();")]);
assert.ok(purges.every(result => result.code === 0), "overlapping cleanup is safe");
sql("select test.ok((select count(*)=0 from public.login_history where logged_in_at<now()-interval '90 days'),'concurrent purges drain expired data');");
console.log("PASS concurrent record, attach, and purge");
