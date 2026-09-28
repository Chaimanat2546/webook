import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CommandExitError, withProductionEnvironmentExcluded } from "../scripts/staging-build-environment.mjs";

test("a failed staging child command keeps its original exit status", () => {
  const error = new CommandExitError(2, "build failed");
  assert.equal(error.exitCode, 2);
});

test("staging builds exclude the production environment file and restore it afterwards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-staging-build-"));
  const productionEnvironment = join(directory, ".env.production");
  await writeFile(productionEnvironment, "PUBLIC_VALUE=production");

  try {
    await withProductionEnvironmentExcluded(directory, async () => {
      assert.equal(existsSync(productionEnvironment), false);
    });

    assert.equal(await readFile(productionEnvironment, "utf8"), "PUBLIC_VALUE=production");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("staging builds restore the production environment file when the build fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-staging-build-"));
  const productionEnvironment = join(directory, ".env.production");
  await writeFile(productionEnvironment, "PUBLIC_VALUE=production");

  try {
    await assert.rejects(
      () => withProductionEnvironmentExcluded(directory, async () => { throw new Error("build failed"); }),
      /build failed/,
    );
    assert.equal(await readFile(productionEnvironment, "utf8"), "PUBLIC_VALUE=production");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
