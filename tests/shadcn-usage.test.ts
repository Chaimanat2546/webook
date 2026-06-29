import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const agentsSource = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const dialogSource = readFileSync(
  new URL("../components/ui/dialog.tsx", import.meta.url),
  "utf8",
);

describe("shadcn usage rules", () => {
  it("allows shadcn source components without treating them like npm dependency installs", () => {
    assert.match(agentsSource, /ShadcnUI components are treated as approved reusable source components/);
    assert.match(agentsSource, /agents may add it with `npx shadcn@latest add <component>`/);
    assert.match(agentsSource, /If shadcn would add or change npm dependencies/);
  });

  it("keeps the dialog component aligned with the shadcn source component", () => {
    assert.match(dialogSource, /fixed inset-0 isolate z-50 bg-black\/10/);
    assert.match(dialogSource, /ring-1 ring-foreground\/10/);
    assert.match(dialogSource, /DialogOverlay,/);
    assert.match(dialogSource, /showCloseButton = false/);
  });
});
