import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { patchBraces } from "../scripts/patch-braces-depth.mjs";

const require = createRequire(import.meta.url);
interface BraceNode { type: string; value?: string; nodes?: BraceNode[] }
interface Braces {
  (input: string): string[];
  parse(input: string): BraceNode;
  compile(input: string | BraceNode): string;
  expand(input: string | BraceNode): string[];
  stringify(input: string | BraceNode): string;
}
const braces = require("braces") as Braces;
const boundedDepthError = (error: unknown) => error instanceof RangeError
  && /nesting depth/i.test(error.message) && !/call stack/i.test(error.message);

test("braces rejects deeply nested patterns before recursive walkers overflow", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"], ["{(", ")}"]]) {
    for (const suffix of [close.repeat(3500), ""]) {
      const pattern = open.repeat(3500) + "a,b" + suffix;
      if (pattern.length > 10000) continue;
      for (const run of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => run(pattern), boundedDepthError);
      }
    }
  }
});

test("braces bounds caller-supplied ASTs including cycles", () => {
  let ast: BraceNode = { type: "text", value: "a" };
  for (let index = 0; index < 500; index++) ast = { type: "root", nodes: [ast] };
  const cycle: BraceNode = { type: "root", nodes: [] };
  cycle.nodes?.push(cycle);
  for (const input of [ast, cycle]) {
    for (const run of [braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => run(input), boundedDepthError);
    }
  }
});

test("patched braces preserves normal glob expansion and escaped literals", () => {
  assert.equal(braces.compile("src/{app,lib}/**/*.{ts,tsx}"), "src/(app|lib)/**/*.(ts|tsx)");
  assert.deepEqual(braces.expand("file-{1..3}.{ts,js}"), ["file-1.ts", "file-1.js", "file-2.ts", "file-2.js", "file-3.ts", "file-3.js"]);
  assert.deepEqual(braces.expand("a/{b,{c,d}}/e"), ["a/b/e", "a/c/e", "a/d/e"]);
  assert.equal(braces.stringify(braces.parse("a/{b,c}/d")), "a/{b,c}/d");
  assert.equal(braces.compile("\\{".repeat(200)), "{".repeat(200));
});

test("security backport is repeatable and refuses changed upstream source before writing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-braces-test-"));
  try {
    await cp(dirname(require.resolve("braces/package.json")), directory, { recursive: true });
    await patchBraces(directory);
    await patchBraces(directory);
    const file = join(directory, "lib/compile.js");
    const changed = await readFile(file, "utf8") + "\n// Unexpected source\n";
    await writeFile(file, changed);
    assert.throws(() => patchBraces(directory), /Unexpected braces source/);
    assert.equal(await readFile(file, "utf8"), changed);
  } finally {
    // This exact task-owned directory was created by mkdtemp under the OS temp root.
    await rm(directory, { recursive: true, force: true });
  }
});

test("security backport refuses a partial patch that never increments recursion depth", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webook-braces-partial-test-"));
  try {
    await cp(dirname(require.resolve("braces/package.json")), directory, { recursive: true });
    const file = join(directory, "lib/compile.js");
    await writeFile(file, (await readFile(file, "utf8")).replace("walk(child, node, depth + 1)", "walk(child, node)"));
    assert.throws(() => patchBraces(directory), /partial braces patch/i);
  } finally {
    // This exact task-owned directory was created by mkdtemp under the OS temp root.
    await rm(directory, { recursive: true, force: true });
  }
});
