import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { canUseQuotation } from "../server/auth/admin.ts";

describe("quotation authorization and navigation", () => {
  it("requires the dedicated quotation permission", () => {
    assert.equal(canUseQuotation({ allow_tools: { allow_quotation: true } }), true);
    assert.equal(canUseQuotation({ allow_tools: { allow_accommodation: true } }), false);
    assert.equal(canUseQuotation({ allow_tools: null }), false);
    assert.equal(canUseQuotation(null), false);
  });

  it("passes server authorization into the admin sidebar", () => {
    const layout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
    const shell = readFileSync(
      new URL("../components/layout/admin-shell.tsx", import.meta.url),
      "utf8",
    );
    const sidebar = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );

    assert.match(layout, /canUseQuotation\(adminUser\)/);
    assert.match(shell, /canUseQuotation: boolean/);
    assert.match(sidebar, /canUseQuotation: boolean/);
    assert.match(sidebar, /canUseQuotation \? \(/);
    assert.match(sidebar, /href="\/admin\/quotations"/);
  });

  it("creates the protected quotation list route", () => {
    const page = new URL("../app/admin/quotations/page.tsx", import.meta.url);
    assert.equal(existsSync(page), true);
    const source = readFileSync(page, "utf8");
    assert.match(source, /canUseQuotation\(adminUser\)/);
    assert.match(source, /ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา/);
  });
});
