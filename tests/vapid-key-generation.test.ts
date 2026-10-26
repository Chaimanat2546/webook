import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("VAPID setup writes a matching key pair to a new file, never stdout or an existing file", async () => {
  const directory = mkdtempSync(join(tmpdir(), "webook-vapid-test-"));
  const file = join(directory, ".env.push.staging");
  try {
    const run = () => spawnSync(process.execPath, ["scripts/generate-vapid-keys.mjs", "--out", file, "--subject", "mailto:ops@example.test"], { encoding: "utf8" });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const values = Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map(line => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
    assert.ok(!first.stdout.includes(values.VAPID_PRIVATE_KEY));
    const raw = Buffer.from(values.VAPID_PUBLIC_KEY, "base64url");
    assert.equal(raw.length, 65);
    const jwk = { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url"), d: values.VAPID_PRIVATE_KEY };
    const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const publicKey = await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const message = new TextEncoder().encode("webook-vapid-test");
    const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, message);
    assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, message), true);
    const original = readFileSync(file, "utf8");
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(file, "utf8"), original);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
