import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repository = readFileSync(new URL("../server/repositories/quotation-customers.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/admin/quotations/customers/actions.ts", import.meta.url), "utf8");
const searchService = readFileSync(new URL("../server/services/quotation-customer-search.ts", import.meta.url), "utf8");

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
    assert.match(actions, /createSupabaseAdminClient/);
    assert.match(actions, /context\.user\.id/);
  });

  it("persists trusted DBD defaults only after a server lookup", () => {
    assert.match(actions, /lookupDbdJuristicPerson\(prepared\.taxId\)/);
    assert.match(actions, /requiresUnverifiedConfirmation: true/);
    assert.doesNotMatch(actions, /value\.dbd(?:Name|Address|Status|VerifiedAt)/);
  });

  it("surfaces non-normal DBD status and picker search failures", () => {
    assert.match(actions, /warning:\s*dbdStatusWarning/);
    assert.match(actions, /searchActiveQuotationCustomers\(supabase,/);
    assert.match(actions, /Promise<QuotationCustomerSearchResult>/);
    assert.match(searchService, /return \{ formError:[\s\S]*ok: false \}/);
  });
});
