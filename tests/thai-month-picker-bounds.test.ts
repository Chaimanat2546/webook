import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("optional maximum month disables future choices without changing other pickers", async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../components/ui/thai-month-picker.tsx", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "show-menu-for-render-test", setup(builder) {
    builder.onResolve({ filter: /^\.\/dropdown-menu$/ }, () => ({ path: "menu", namespace: "fixture" }));
    builder.onResolve({ filter: /^react$/, namespace: "fixture" }, () => ({ path: "react", external: true }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `import React from 'react'; export const DropdownMenu=({children})=>React.createElement('div',null,children); export const DropdownMenuContent=DropdownMenu; export const DropdownMenuTrigger=DropdownMenu; export const DropdownMenuItem=({disabled,children})=>React.createElement('button',{disabled},children);`, loader: "js" }));
  } }] });
  const loaded = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const Picker = loaded.exports.ThaiMonthPicker as ComponentType<Record<string, unknown>>;
  const bounded = renderToStaticMarkup(createElement(Picker, { month: "2026-10", maxMonth: "2026-10", onMonthChange() {} }));
  assert.match(bounded, /<button disabled="">พฤศจิกายน<\/button>/);
  assert.match(bounded, /<button>ตุลาคม<\/button>/);
  const unlimited = renderToStaticMarkup(createElement(Picker, { month: "2026-10", onMonthChange() {} }));
  assert.match(unlimited, /<button>พฤศจิกายน<\/button>/);
});
