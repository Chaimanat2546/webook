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
    assert.equal(page.match(/pageSize: 8/g)?.length, 2);
    assert.match(page, /ข้อมูลลูกค้า/);
  });

  it("uses cards on mobile and a table on larger screens", () => {
    const list = source("../components/admin/quotations/customers/customer-list.tsx");
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden[^\"]*md:block/);
    assert.match(list, /<Table/);
    assert.match(list, /setQuotationCustomerActiveAction/);
  });

  it("uses the Thai customer-data label throughout customer UI", () => {
    const customerUi = [
      source("../app/admin/quotations/customers/page.tsx"),
      source("../components/admin/quotations/customers/customer-list.tsx"),
      source("../components/admin/quotations/customers/customer-picker-dialog.tsx"),
    ].join("\n");
    assert.doesNotMatch(customerUi, /Customer Master/);
    assert.match(customerUi, /ข้อมูลลูกค้า/);
  });

  it("uses one status dropdown toolbar with add customer at the far right", () => {
    const page = source("../app/admin/quotations/customers/page.tsx");
    const list = source("../components/admin/quotations/customers/customer-list.tsx");
    assert.match(page, /QuotationCustomerToolbar/);
    assert.match(page, /params\.set\("q", search\)/);
    assert.doesNotMatch(page, /params\.set\("page"/);
    assert.doesNotMatch(page, /ทั้งหมด \{result\.total/);
    assert.doesNotMatch(page, /<Link href=\{statusHref/);
    assert.match(list, /export function QuotationCustomerToolbar/);
    assert.match(list, /DropdownMenuRadioGroup/);
    assert.match(list, /DropdownMenuRadioItem value="active">ใช้งานอยู่/);
    assert.match(list, /DropdownMenuRadioItem value="inactive">ปิดใช้งานแล้ว/);
    assert.match(list, /ChevronDownIcon/);
    assert.match(list, /className="ml-auto"[\s\S]*เพิ่มลูกค้า/);
    assert.ok((list.match(/<CustomerFormDialog/g) ?? []).length >= 2);
  });

  it("shows DBD only for juristic customers and keeps contacts in customer data", () => {
    const form = source("../components/admin/quotations/customers/customer-form.tsx");
    const actions = source("../app/admin/quotations/customers/actions.ts");
    assert.match(form, /customerType === "juristic"/);
    assert.match(form, /function changeCustomerType\(next: QuotationCustomerInput\["customerType"\]\)/);
    assert.match(form, /setValue\(\(current\) => changeQuotationCustomerType\(current, next\)\)/);
    assert.match(form, /onValueChange=\{\(next\) => changeCustomerType/);
    assert.match(form, /branchNumber: customer\.branchNumber/);
    assert.match(form, /officeType: customer\.officeType/);
    assert.match(form, /<fieldset[\s\S]*disabled=\{isPending \|\| Boolean\(customer\)\}/);
    assert.doesNotMatch(form, /หลังสร้าง Master|ใน Master/);
    assert.doesNotMatch(actions, /หลังสร้าง Master|ใน Master/);
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
    assert.match(form, /existingCustomer\.branchNumber/);
    assert.match(form, /setQuotationCustomerActiveAction/);
    assert.match(form, /กำลังตรวจสอบ DBD/);
    assert.match(form, /confirmReactivation/);
    assert.match(form, /result\.warning/);
    assert.match(form, /toast\.warning\(result\.warning\)/);
    assert.match(form, /ยืนยันเปิดใช้งานลูกค้าเดิม/);
  });

  it("selects quotation customers only through the customer-data combobox", () => {
    const picker = source("../components/admin/quotations/customers/customer-picker-dialog.tsx");
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const customerSection = editor.slice(
      editor.indexOf("data-customer-section"),
      editor.indexOf("data-document-section"),
    );

    assert.match(picker, /ComboboxInput/);
    assert.match(picker, /aria-label="ลูกค้า"/);
    assert.match(picker, /inputValue=\{open \? query : current\.name\}/);
    assert.match(picker, /itemToStringLabel=\{\(customer: QuotationCustomerMaster\) => customer\.name\}/);
    assert.match(picker, /eventDetails\.reason === "input-change"/);
    assert.match(
      picker,
      /const hasCurrent = current\.name\.trim\(\) !== "" \|\| current\.taxId\.trim\(\) !== ""/,
    );
    assert.match(picker, /if \(hasCurrent && differs\)/);
    assert.match(picker, /filter=\{null\}/);
    assert.match(picker, /searchActiveQuotationCustomersAction/);
    assert.match(picker, /search\.length === 1/);
    assert.match(picker, /requestIdRef\.current/);
    assert.match(picker, /พิมพ์อย่างน้อย 2 ตัวอักษร/);
    assert.match(picker, /เพิ่มลูกค้าใหม่/);
    assert.match(picker, /QuotationCustomerForm/);
    assert.match(picker, /quotationCustomerToSnapshot/);
    assert.match(picker, /customer\.branchNumber/);
    assert.match(picker, /data-selected-customer-details/);
    assert.doesNotMatch(picker, /เปลี่ยนลูกค้า|data-customer-summary/);
    assert.doesNotMatch(picker, /ComboboxClear|showClear/);
    assert.match(picker, /แทนที่ข้อมูลลูกค้า/);
    assert.match(picker, /searchError/);
    assert.match(picker, /role="alert"/);
    assert.match(picker, /result\.ok/);
    assert.match(editor, /QuotationCustomerPicker/);
    assert.match(editor, /function replaceCustomerSnapshot/);
    assert.match(
      editor,
      /firstField\.startsWith\("customer\."\)\s*\?\s*"customer\.name"\s*:\s*firstField/,
    );
    assert.doesNotMatch(customerSection, /<TextInput|<Textarea|<OfficeTypeControls/);
    assert.doesNotMatch(editor, /customer\.(contactName|contactPhone|contactEmail)/);
  });
});
