import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { loadBindings, transform } from "next/dist/build/swc/index.js";

await loadBindings();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const path = resolvePath(process.cwd(), specifier.slice(2));
    for (const extension of [".ts", ".tsx", ".js"]) {
      try {
        return await nextResolve(pathToFileURL(`${path}${extension}`).href, context);
      } catch {
        // Try the next project extension.
      }
    }
  }
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    return nextResolve(`${specifier}.js`, context);
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const extension of [".ts", ".tsx"]) {
      try {
        return await nextResolve(`${specifier}${extension}`, context);
      } catch {
        // Try the next TypeScript extension.
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(new URL(url), "utf8");
    const output = await transform(source, {
      filename: url,
      jsc: { parser: { syntax: "typescript", tsx: url.endsWith(".tsx") }, target: "es2022", transform: { react: { runtime: "automatic" } } },
      module: { type: "es6" },
    });
    return { format: "module", shortCircuit: true, source: output.code };
  }
  return nextLoad(url, context);
}
