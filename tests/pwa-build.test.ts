import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildPwa, releaseRevision } from "../scripts/build-pwa.mjs";

test("app releases change the worker identity without hashing secrets or OS line endings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-release-test-"));
  try {
    await mkdir(join(directory, "app"));
    const file = join(directory, "app/page.tsx");
    await writeFile(file, "first\nrelease\n");
    const first = releaseRevision(directory);
    await writeFile(file, "first\r\nrelease\r\n");
    await writeFile(join(directory, ".env.production"), "FAKE_TEST_VALUE=not-a-secret");
    assert.equal(releaseRevision(directory), first);
    await writeFile(file, "second release");
    assert.notEqual(releaseRevision(directory), first);
    const second = releaseRevision(directory);
    await mkdir(join(directory, "hooks"));
    await writeFile(join(directory, "hooks/use-mobile.ts"), "export const mobile = true;");
    assert.notEqual(releaseRevision(directory), second);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("shipped worker is reproducible and public file changes invalidate its revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-pwa-test-"));
  try {
    const destination = join(directory, "sw.js");
    await buildPwa({ destination });
    const original = await readFile(destination, "utf8");
    assert.equal(original, await readFile(new URL("../public/sw.js", import.meta.url), "utf8"));
    assert.equal(original.includes("self.__WB_MANIFEST"), false);
    assert.equal(original.includes("importScripts("), false);
    const publicDirectory = join(directory, "public");
    await cp(new URL("../public/pwa", import.meta.url), join(publicDirectory, "pwa"), { recursive: true });
    await writeFile(join(publicDirectory, "pwa/offline.html"), "updated offline page");
    await buildPwa({ destination, publicDirectory });
    assert.notEqual(await readFile(destination, "utf8"), original);
  } finally {
    // This exact task-owned directory was created by mkdtemp under the OS temp root.
    await rm(directory, { recursive: true, force: true });
  }
});
