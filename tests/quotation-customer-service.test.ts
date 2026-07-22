import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  quotationCustomerToSnapshot,
  type QuotationCustomerInput,
} from "../lib/quotation-customer-types.ts";
import {
  dbdStatusWarning,
  prepareQuotationCustomerInput,
  resetQuotationCustomerFromDbd,
} from "../server/services/quotation-customers.ts";

const valid: QuotationCustomerInput = {
  address: "ที่อยู่ลูกค้า",
  branchNumber: "",
  contactEmail: " account@example.com ",
  contactName: " ฝ่ายบัญชี ",
  contactPhone: " 0812345678 ",
  customerType: "juristic",
  id: null,
  name: " บริษัท ตัวอย่าง จำกัด ",
  officeType: "head_office",
  saveUnverified: false,
  taxId: "0107544000108",
};

describe("quotation customer service", () => {
  it("warns when DBD reports a status other than active", () => {
    assert.equal(dbdStatusWarning("ยังดำเนินกิจการอยู่"), undefined);
    assert.match(dbdStatusWarning("เลิกกิจการ") ?? "", /กรุณาตรวจสอบก่อนใช้งาน/);
  });

  it("trims valid input and keeps contacts optional", () => {
    const result = prepareQuotationCustomerInput(valid);
    assert.equal(result.name, "บริษัท ตัวอย่าง จำกัด");
    assert.equal(result.contactEmail, "account@example.com");
  });

  it("rejects malformed tax ID, email, branch, and required fields", () => {
    assert.throws(() => prepareQuotationCustomerInput({
      ...valid,
      address: "",
      contactEmail: "invalid",
      officeType: "branch",
      taxId: "๐107544000108",
    }));
  });

  it("resets only current DBD-backed fields", () => {
    const result = resetQuotationCustomerFromDbd({
      ...valid,
      branchNumber: "00001",
      officeType: "branch",
    }, {
      address: "ที่อยู่ DBD",
      name: "ชื่อ DBD",
      status: "ยังดำเนินกิจการอยู่",
      taxId: valid.taxId,
      verifiedAt: "2026-07-22T00:00:00.000Z",
    });
    assert.equal(result.name, "ชื่อ DBD");
    assert.equal(result.address, "ที่อยู่ DBD");
    assert.equal(result.officeType, "head_office");
    assert.equal(result.branchNumber, "");
    assert.equal(result.contactName, " ฝ่ายบัญชี ");
  });

  it("copies only quotation snapshot fields", () => {
    const snapshot = quotationCustomerToSnapshot({
      address: "ที่อยู่ลูกค้า",
      branchNumber: "00001",
      contactEmail: "account@example.com",
      contactName: "ฝ่ายบัญชี",
      contactPhone: "0812345678",
      customerType: "juristic",
      dbdAddress: "ที่อยู่ DBD",
      dbdName: "ชื่อ DBD",
      dbdStatus: "ยังดำเนินกิจการอยู่",
      dbdVerifiedAt: "2026-07-22T00:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      isActive: true,
      name: "ชื่อลูกค้า",
      officeType: "branch",
      taxId: "0107544000108",
      updatedAt: "2026-07-22T00:00:00.000Z",
    });
    assert.deepEqual(snapshot, {
      address: "ที่อยู่ลูกค้า",
      branchNumber: "00001",
      name: "ชื่อลูกค้า",
      officeType: "branch",
      taxId: "0107544000108",
    });
  });
});
