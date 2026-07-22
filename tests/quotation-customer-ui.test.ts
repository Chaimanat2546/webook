import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("quotation customer UI", () => {
  it("protects and renders the approved customer page", () => {
    const page = source("../app/admin/quotations/customers/page.tsx");
    assert.match(page, /requireAdmin\(\)/);
    assert.match(page, /canUseQuotation\(adminUser\)/);
    assert.match(page, /listQuotationCustomers/);
    assert.match(page, /ข้อมูลลูกค้า/);
  });

  it("uses cards on mobile and a table on larger screens", () => {
    const list = source("../components/admin/quotations/customers/customer-list.tsx");
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden[^\"]*md:block/);
    assert.match(list, /<Table/);
    assert.match(list, /setQuotationCustomerActiveAction/);
  });

  it("shows DBD only for juristic customers and keeps contacts master-only", () => {
    const form = source("../components/admin/quotations/customers/customer-form.tsx");
    assert.match(form, /customerType === "juristic"/);
    assert.match(form, /lookupQuotationCustomerDbdAction/);
    assert.match(form, /บันทึกแบบยังไม่ยืนยัน/);
    assert.match(form, /resetQuotationCustomerFromDbd/);
    assert.match(form, /contactName/);
    assert.match(form, /contactPhone/);
    assert.match(form, /contactEmail/);
  });

  it("keeps verified identity stable and surfaces DBD and duplicate state", () => {
    const form = source("../components/admin/quotations/customers/customer-form.tsx");
    const actions = source("../app/admin/quotations/customers/actions.ts");
    assert.match(actions, /prepared\.taxId !== stored\.taxId/);
    assert.match(actions, /prepared\.customerType !== stored\.customerType/);
    assert.match(form, /dbdDefaults\.name/);
    assert.match(form, /dbdDefaults\.address/);
    assert.match(form, /existingCustomer/);
    assert.match(form, /setQuotationCustomerActiveAction/);
    assert.match(form, /กำลังตรวจสอบ DBD/);
    assert.match(form, /confirmReactivation/);
    assert.match(form, /ยืนยันเปิดใช้งานลูกค้าเดิม/);
  });
});
