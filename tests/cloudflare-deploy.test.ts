import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Cloudflare web deployment", () => {
  it("configures the Next.js app for OpenNext on Workers", () => {
    const configPath = new URL("../wrangler.jsonc", import.meta.url);
    const openNextConfigPath = new URL("../open-next.config.ts", import.meta.url);

    assert.ok(existsSync(configPath));
    assert.ok(existsSync(openNextConfigPath));

    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.name, "webook-admin");
    assert.equal(config.main, ".open-next/worker.js");
    assert.equal(config.compatibility_date, "2026-06-26");
    assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
    assert.deepEqual(config.assets, {
      binding: "ASSETS",
      directory: ".open-next/assets",
    });
    assert.equal(config.observability.enabled, true);

    const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
    assert.match(gitignore, /^\/\.open-next\/$/m);

    const eslintConfig = readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");
    assert.match(eslintConfig, /"\.open-next\/\*\*"/);
    assert.match(eslintConfig, /"\.wrangler\/\*\*"/);
  });

  it("uses OpenNext scripts for Worker preview and deploy", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

    assert.match(packageJson.dependencies["@opennextjs/cloudflare"], /^\^/);
    assert.match(packageJson.scripts["cf:assert-linux"], /process\.platform === 'win32'/);
    assert.equal(
      packageJson.scripts.preview,
      "npm run cf:assert-linux && opennextjs-cloudflare build && opennextjs-cloudflare preview",
    );
    assert.equal(
      packageJson.scripts.deploy,
      "npm run cf:assert-linux && opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    );
  });

  it("deploys the admin app from GitHub Actions on Ubuntu only", () => {
    const workflowPath = new URL("../.github/workflows/deploy-admin.yml", import.meta.url);

    assert.ok(existsSync(workflowPath));

    const workflow = readFileSync(workflowPath, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /branches:\s*\[\s*main\s*\]/);
    assert.match(workflow, /runs-on:\s*ubuntu-latest/);
    assert.match(workflow, /environment:\s*Cloudflare-Staging/);
    assert.match(workflow, /node-version:\s*22/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /npm run typecheck/);
    assert.match(workflow, /npm run lint/);
    assert.match(workflow, /npm run test/);
    assert.match(workflow, /npm run deploy/);
    assert.match(workflow, /name:\s*Verify deployment secrets/);
    assert.match(workflow, /Missing GitHub secret: CLOUDFLARE_API_TOKEN/);
    assert.match(workflow, /CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/);
    assert.doesNotMatch(workflow, /workers\/media\/wrangler\.jsonc/);
  });
});
