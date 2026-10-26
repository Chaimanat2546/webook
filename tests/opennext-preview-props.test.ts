import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ContentUpdater } from "@opennextjs/aws/plugins/content-updater.js";
import { inlineLoadManifest } from "../node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js";

test("OpenNext inlines Next 16.4 preview props before a Worker initializes its server", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "webook-preview-props-"));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("webook-preview-props-"));
    rmSync(directory, { recursive: true, force: true });
  });
  const outputDir = join(directory, "output");
  const server = join(outputDir, "server-functions/default/.next/server");
  mkdirSync(server, { recursive: true });
  writeFileSync(join(server, "preview-props.json"), JSON.stringify({ previewModeId: "fixture-mode", previewModeSigningKey: "fixture-signing", previewModeEncryptionKey: "fixture-encryption" }));
  const options = { outputDir, monorepoRoot: directory, appBuildOutputPath: directory, nextVersion: "16.4.2" } as Parameters<typeof inlineLoadManifest>[1];
  const updater = new ContentUpdater(options);
  inlineLoadManifest(updater, options);
  const transform = updater.updaters.get("inline-load-manifest")![0].callback;
  const nextModule = new URL("../node_modules/next/dist/server/load-manifest.external.js", import.meta.url);
  const patched = await transform({ contents: readFileSync(nextModule, "utf8"), path: "next/dist/server/load-manifest.external.js" });
  assert.ok(patched);
  const context = () => ({ exports: {}, require: createRequire(nextModule), process: { env: {} } });
  const result = runInNewContext(`${patched}\n; loadManifest("/.next/server/preview-props.json");`, context());
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { previewModeId: "fixture-mode", previewModeSigningKey: "fixture-signing", previewModeEncryptionKey: "fixture-encryption" });
  assert.throws(() => runInNewContext(`${patched}\n; loadManifest("/.next/server/unknown-private-file.json");`, context()), /Unexpected loadManifest/);
});
