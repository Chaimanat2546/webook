import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("quotation UI", () => {
  it("protects and renders the single seller profile page", () => {
    const page = source("../app/admin/quotations/settings/company/page.tsx");
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(page, /CompanyProfileForm/);
  });

  it("collects the approved seller snapshot fields and normalizes the logo", () => {
    const form = source("../components/admin/quotations/company-profile-form.tsx");
    for (const name of [
      "name", "address", "taxId", "officeType", "branchNumber", "phone", "email",
      "website", "contactName", "contactPhone", "contactEmail", "logo",
    ]) {
      assert.match(form, new RegExp(`name=["']${name}["']`));
    }
    assert.match(form, /resizeQuotationImageToMax/);
    assert.match(form, /image\/webp/);
    assert.match(form, /10 \* 1024 \* 1024/);
  });

  it("keeps the old asset after a successful profile replacement", () => {
    const actions = source("../app/admin/quotations/actions.ts");
    assert.match(actions, /saveCompanyProfileAction/);
    assert.match(actions, /getQuotationCompanyProfile\(supabase\)/);
    assert.match(actions, /cleanup newly uploaded quotation logo/i);
    assert.doesNotMatch(actions, /deleteQuotationAssetObject\([^)]*existing/i);
  });

  it("lists quotations with server search and pagination", () => {
    const page = source("../app/admin/quotations/page.tsx");
    const list = source("../components/admin/quotations/quotation-list.tsx");
    assert.match(page, /listQuotations\(supabase/);
    assert.match(page, /pageSize: 20/);
    assert.match(page, /name="q"/);
    assert.match(page, /href="\/admin\/quotations\/new"/);
    assert.match(page, /href="\/admin\/quotations\/settings\/company"/);
    assert.match(list, /"use client"/);
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden[^"']*md:block/);
    assert.match(list, /deleteQuotationAction/);
    assert.match(list, /\?print=1/);
    assert.doesNotMatch(list, /สถานะ/);
  });
});
