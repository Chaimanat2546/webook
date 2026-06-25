import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const files = [
  new URL("../components/layout/admin-shell.tsx", import.meta.url),
  new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
];

const source = files
  .filter((file) => existsSync(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

describe("admin layout sidebar UI", () => {
  it("uses a narrower desktop sidebar that can collapse to an icon rail", () => {
    assert.match(source, /w-44/);
    assert.match(source, /w-16/);
    assert.match(source, /aria-expanded/);
    assert.match(source, /PanelLeftCloseIcon/);
    assert.match(source, /PanelLeftOpenIcon/);
  });
});
