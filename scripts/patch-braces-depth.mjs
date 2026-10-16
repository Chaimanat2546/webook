import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Temporary backport for GHSA-vfj7-8cjw-p6xm. Keep the real package version:
// npm audit must continue to disclose the upstream advisory until it is fixed.
const root = fileURLToPath(new URL("../", import.meta.url));
const guard = "if (depth > 100) throw new RangeError('braces nesting depth exceeds 100');";
const walkerReplacements = [
  ["const walk = (node, parent = {}) => {", `const walk = (node, parent = {}, depth = 0) => {\n    ${guard}`],
  ["walk(child, node)", "walk(child, node, depth + 1)"],
];
const patches = [
  {
    file: "parse.js", hash: "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310",
    replacements: [["stack.push(block);", "if (stack.length > 100) throw new RangeError('braces nesting depth exceeds 100');\n      stack.push(block);"]],
  },
  { file: "compile.js", hash: "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f", replacements: walkerReplacements },
  { file: "expand.js", hash: "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7", replacements: walkerReplacements },
  {
    file: "stringify.js", hash: "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
    replacements: [
      ["const stringify = (node, parent = {}) => {", `const stringify = (node, parent = {}, depth = 0) => {\n    ${guard}`],
      ["stringify(child)", "stringify(child, {}, depth + 1)"],
    ],
  },
];
const sha256 = source => createHash("sha256").update(source).digest("hex");

export function patchBraces(directory) {
  const metadata = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  if (metadata.name !== "braces" || metadata.version !== "3.0.3") {
    throw new Error("Review the braces security backport before changing its version.");
  }
  // Validate every file before modifying any. Undoing our exact replacements
  // must recover the audited upstream source; this also makes reruns safe.
  const updates = patches.map(({ file, hash, replacements }) => {
    const path = resolve(directory, "lib", file);
    const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    let original = source;
    if (sha256(original) !== hash) {
      for (const [before, after] of replacements) original = original.replaceAll(after, before);
    }
    if (sha256(original) !== hash) throw new Error(`Unexpected braces source: ${file}; refusing to patch.`);
    let patched = original;
    for (const [before, after] of replacements) patched = patched.replaceAll(before, after);
    if (source !== original && source !== patched) throw new Error(`Partial braces patch: ${file}; refusing to proceed.`);
    return source === patched ? undefined : { path, source: patched };
  });
  for (const update of updates) if (update) writeFileSync(update.path, update.source);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  for (const path of Object.keys(lock.packages)) {
    if (!/^node_modules\/(?:[^.][^/]*\/)*braces$/.test(path)) continue;
    const directory = resolve(root, path);
    if (existsSync(directory)) patchBraces(directory);
  }
}
