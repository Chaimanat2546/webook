import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url)).find((name) =>
  name.endsWith("_data_api_read_request_logging.sql"),
);

describe("data API read request logging migration", () => {
  it("logs each GET request with its table path, client IP, and user agent before PostgREST serves it", () => {
    assert.ok(migrationName, "data API read request logging migration must exist");

    const sql = readFileSync(
      new URL(`../supabase/migrations/${migrationName}`, import.meta.url),
      "utf8",
    );

    assert.match(sql, /create or replace function private\.log_data_api_read_request\(\)/i);
    assert.match(sql, /current_setting\('request\.method', true\)/i);
    assert.match(sql, /request_method\s*(?:<>|!=)\s*'GET'/i);
    assert.match(sql, /current_setting\('request\.path', true\)/i);
    assert.match(sql, /cf-connecting-ip/i);
    assert.match(sql, /user-agent/i);
    assert.match(sql, /raise log/i);
    assert.match(sql, /alter role authenticator\s+set pgrst\.db_pre_request\s*=\s*'private\.log_data_api_read_request'/i);
    assert.match(sql, /notify pgrst, 'reload config'/i);
  });

  it("formats the log message as a staff-readable UA, IP, host, client, and path record", () => {
    const formattingMigration = readdirSync(new URL("../supabase/migrations/", import.meta.url)).find(
      (name) => name.endsWith("_data_api_read_log_message_format.sql"),
    );

    assert.ok(formattingMigration, "data API read log message formatting migration must exist");

    const sql = readFileSync(
      new URL(`../supabase/migrations/${formattingMigration}`, import.meta.url),
      "utf8",
    );

    assert.match(sql, /Host:\s*%/i);
    assert.match(sql, /UA:\s*%/i);
    assert.match(sql, /IP:\s*%/i);
    assert.match(sql, /X-Client:\s*%/i);
    assert.match(sql, /Path:\s*%/i);
  });

  it("prefers the original browser metadata forwarded by the trusted web server", () => {
    const forwardingMigration = readdirSync(new URL("../supabase/migrations/", import.meta.url)).find(
      (name) => name.endsWith("_data_api_read_forwarded_client_metadata.sql"),
    );

    assert.ok(forwardingMigration, "forwarded client metadata migration must exist");

    const sql = readFileSync(
      new URL(`../supabase/migrations/${forwardingMigration}`, import.meta.url),
      "utf8",
    );
    const serverClient = readFileSync(new URL("../lib/supabase/server.ts", import.meta.url), "utf8");

    assert.match(sql, /x-webook-origin-ip/i);
    assert.match(sql, /x-webook-origin-user-agent/i);
    assert.match(serverClient, /x-webook-origin-ip/i);
    assert.match(serverClient, /x-webook-origin-user-agent/i);
  });
});
