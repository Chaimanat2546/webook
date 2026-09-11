import assert from "node:assert/strict";
import { test } from "node:test";
import { documentFitScale } from "../lib/document-preview.ts";

test("preview fits both dimensions without enlarging the original document", () => {
  assert.equal(documentFitScale(320, 600, 800, 1200), 0.4);
  assert.equal(documentFitScale(800, 300, 800, 1200), 0.25);
  assert.equal(documentFitScale(1600, 2400, 800, 1200), 1);
  assert.equal(documentFitScale(320, 600, 800, 2400), 0.25);
  assert.equal(documentFitScale(0, 600, 800, 1200), 1);
});
