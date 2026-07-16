import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repository = readFileSync(
  new URL("../server/repositories/quotations.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../app/admin/quotations/actions.ts", import.meta.url),
  "utf8",
);

describe("quotation repository and actions", () => {
  it("uses the transactional RPC for writes", () => {
    assert.match(repository, /\.rpc\("save_quotation"/);
    assert.match(repository, /\.rpc\("soft_delete_quotation"/);
    assert.match(repository, /\.rpc\("list_quotations"/);
    assert.doesNotMatch(repository, /\.from\("quotation_items"\)\.insert/);
  });

  it("loads public quotations only through the token RPC", () => {
    assert.match(repository, /\.rpc\("get_public_quotation"/);
    assert.match(repository, /publicToken/);
    assert.match(repository, /public_token/);
    assert.doesNotMatch(repository, /serviceRole/i);
  });

  it("checks the quotation permission before every action mutation", () => {
    assert.match(actions, /canUseQuotation\(adminUser\)/);
    assert.match(actions, /prepareQuotationPayload\(value\)/);
    assert.match(actions, /saveQuotation\(supabase, prepared\.rpcPayload\)/);
    assert.match(actions, /softDeleteQuotation\(supabase, id\)/);
  });

  it("returns field validation without leaking database errors", () => {
    assert.match(actions, /error instanceof QuotationValidationError/);
    assert.match(actions, /fieldErrors: error\.fieldErrors/);
    assert.match(actions, /ไม่สามารถบันทึกใบเสนอราคาได้/);
    assert.doesNotMatch(actions, /formError: error\.message/);
  });
});
