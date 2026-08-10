import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Cloudflare deployment boundary", () => {
  it("configures the Next.js admin app as a separate Cloudflare Worker", () => {
    const configPath = new URL("../wrangler.jsonc", import.meta.url);
    const openNextConfigPath = new URL("../open-next.config.ts", import.meta.url);
    const nextConfigPath = new URL("../next.config.ts", import.meta.url);
    const baseUiArrowShimPath = new URL("../lib/base-ui-arrow-middleware.ts", import.meta.url);
    const workflowPath = new URL("../.github/workflows/deploy-admin.yml", import.meta.url);

    assert.ok(existsSync(configPath));
    assert.ok(existsSync(openNextConfigPath));
    assert.ok(existsSync(nextConfigPath));
    assert.ok(existsSync(baseUiArrowShimPath));
    assert.equal(existsSync(workflowPath), false);

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.name, "webook-admin");
    assert.equal(config.main, ".open-next/worker.js");
    assert.deepEqual(config.assets, {
      directory: ".open-next/assets",
      binding: "ASSETS",
    });
    assert.deepEqual(config.r2_buckets, [
      {
        binding: "NEXT_INC_CACHE_R2_BUCKET",
        bucket_name: "webook-admin-next-cache",
      },
    ]);
    assert.deepEqual(config.services, [
      {
        binding: "CUM_BAANPARTY",
        service: "baan-pool-villa",
        entrypoint: "CentralUserManagerEntrypoint",
      },
      {
        binding: "CUM_POOLVILLAPATTAYA",
        service: "baan-pool-villa02",
        entrypoint: "CentralUserManagerEntrypoint",
      },
      {
        binding: "CUM_BAANPMHEE",
        service: "baan-pool-villa03",
        entrypoint: "CentralUserManagerEntrypoint",
      },
      {
        binding: "CUM_FLUK_NASA_POOLVILLA",
        service: "fluk-nasa-poolvilla",
        entrypoint: "CentralUserManagerEntrypoint",
      },
      {
        binding: "CUM_VILLA_MEDIA_POOLVILLA",
        service: "villa-media-poolvilla",
        entrypoint: "CentralUserManagerEntrypoint",
      },
    ]);
    assert.equal(Object.hasOwn(config, "durable_objects"), false);
    assert.equal(Object.hasOwn(config, "migrations"), false);

    const openNextConfig = readFileSync(openNextConfigPath, "utf8");
    assert.match(openNextConfig, /r2-incremental-cache/);
    assert.doesNotMatch(openNextConfig, /do-queue/);
    assert.doesNotMatch(openNextConfig, /do-sharded-tag-cache/);

    const nextConfig = readFileSync(nextConfigPath, "utf8");
    assert.match(nextConfig, /base-ui-arrow-middleware/);
    assert.match(nextConfig, /\.\.\/floating-ui-react\/middleware\/arrow\.mjs/);
    assert.match(nextConfig, /\.\.\/floating-ui-react\/middleware\/arrow/);

    const baseUiArrowShim = readFileSync(baseUiArrowShimPath, "utf8");
    assert.match(baseUiArrowShim, /export function arrow/);
    assert.match(baseUiArrowShim, /name: middleware\.name/);
    assert.match(baseUiArrowShim, /fn: middleware\.fn/);
    assert.match(baseUiArrowShim, /options: \[options, deps\]/);
    assert.doesNotMatch(baseUiArrowShim, /\.\.\.baseArrow\(options\)/);

    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
      packages?: Record<string, { dependencies?: Record<string, string> }>;
    };

    assert.equal(Object.hasOwn(packageJson.dependencies ?? {}, "@opennextjs/cloudflare"), true);
    assert.equal(Object.hasOwn(packageLock.packages?.[""]?.dependencies ?? {}, "@opennextjs/cloudflare"), true);
    assert.equal(
      Object.keys(packageLock.packages ?? {}).some((key) => key.startsWith("node_modules/@opennextjs/")),
      true,
    );
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "cf:assert-linux"), false);
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "preview"), false);
    assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "deploy"), false);
    assert.equal(
      packageJson.scripts?.build,
      "node --use-system-ca ./node_modules/next/dist/bin/next build --webpack",
    );
    assert.equal(packageJson.scripts?.["preview:cf"], "opennextjs-cloudflare build && opennextjs-cloudflare preview");
    assert.equal(packageJson.scripts?.["deploy:cf"], "opennextjs-cloudflare build && opennextjs-cloudflare deploy");
  });

  it("keeps the image media Worker deploy config separate", () => {
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
    assert.match(gitignore, /^\/\.open-next\/$/m);
    assert.match(gitignore, /^\/\.wrangler\/$/m);

    const eslintConfig = readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");
    assert.match(eslintConfig, /"\.open-next\/\*\*"/);
    assert.match(eslintConfig, /"\.wrangler\/\*\*"/);
  });
});
