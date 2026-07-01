import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

describe("Supabase runtime TLS", () => {
  it("runs Next server commands with the Windows system CA store", () => {
    for (const scriptName of ["dev", "build", "start"]) {
      assert.match(packageJson.scripts?.[scriptName] ?? "", /--use-system-ca/);
    }
  });
});
