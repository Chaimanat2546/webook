import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repository = readFileSync(new URL("../server/repositories/quotation-customers.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/admin/quotations/customers/actions.ts", import.meta.url), "utf8");

describe("quotation customer repository and actions", () => {
  it("uses the safe list RPC and never hard deletes", () => {
    assert.match(repository, /\.rpc\("list_quotation_customers"/);
    assert.match(repository, /\.from\("quotation_customers"\)/);
    assert.doesNotMatch(repository, /\.delete\(\)/);
  });

  it("checks permission before every action", () => {
    assert.match(actions, /requireAdmin\(\)/);
    assert.match(actions, /canUseQuotation\(context\.adminUser\)/);
    assert.match(actions, /lookupDbdJuristicPerson/);
    assert.doesNotMatch(actions, /serviceRole|SUPABASE_SERVICE_ROLE/i);
  });

  it("persists trusted DBD defaults only after a server lookup", () => {
    assert.match(actions, /lookupDbdJuristicPerson\(prepared\.taxId\)/);
    assert.match(actions, /requiresUnverifiedConfirmation: true/);
    assert.doesNotMatch(actions, /value\.dbd(?:Name|Address|Status|VerifiedAt)/);
  });
});
