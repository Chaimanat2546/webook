import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildPwa } from "../scripts/build-pwa.mjs";

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
