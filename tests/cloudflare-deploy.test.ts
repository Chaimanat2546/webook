import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Cloudflare deployment boundary", () => {
  it("does not configure the Next.js admin app for Cloudflare Workers", () => {
    const configPath = new URL("../wrangler.jsonc", import.meta.url);
    const openNextConfigPath = new URL("../open-next.config.ts", import.meta.url);
    const workflowPath = new URL("../.github/workflows/deploy-admin.yml", import.meta.url);

    assert.equal(existsSync(configPath), false);
    assert.equal(existsSync(openNextConfigPath), false);
    assert.equal(existsSync(workflowPath), false);

    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
      packages?: Record<string, { dependencies?: Record<string, string> }>;
    };

    assert.equal(Object.hasOwn(packageJson.dependencies ?? {}, "@opennextjs/cloudflare"), false);
    assert.equal(Object.hasOwn(packageLock.packages?.[""]?.dependencies ?? {}, "@opennextjs/cloudflare"), false);
    assert.equal(
      Object.keys(packageLock.packages ?? {}).some((key) => key.startsWith("node_modules/@opennextjs/")),
      false,
    );
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "cf:assert-linux"), false);
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "preview"), false);
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "deploy"), false);
  });

  it("keeps Cloudflare config only for the image media Worker", () => {
    const configPath = new URL("../workers/media/wrangler.jsonc", import.meta.url);

    assert.ok(existsSync(configPath));

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.name, "webook-media");
    assert.equal(config.main, "src/index.ts");
    assert.equal(config.compatibility_date, "2026-06-26");
    assert.deepEqual(config.r2_buckets, [
      {
        binding: "MEDIA_BUCKET",
        bucket_name: "webook-media",
      },
    ]);

    const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
    assert.doesNotMatch(gitignore, /^\/\.open-next\/$/m);
    assert.match(gitignore, /^\/\.wrangler\/$/m);

    const eslintConfig = readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(eslintConfig, /"\.open-next\/\*\*"/);
    assert.match(eslintConfig, /"\.wrangler\/\*\*"/);
  });
});
