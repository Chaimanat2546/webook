import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { QuotationCustomerInput } from "../lib/quotation-customer-types.ts";
import {
  insertQuotationCustomer,
  QuotationCustomerDuplicateError,
  setQuotationCustomerActive,
  updateQuotationCustomer,
} from "../server/repositories/quotation-customers.ts";
import { searchActiveQuotationCustomers } from "../server/services/quotation-customer-search.ts";

const actorId = "11111111-1111-4111-8111-111111111111";
const input: QuotationCustomerInput = {
  address: "Address",
  branchNumber: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  customerType: "juristic",
  id: "22222222-2222-4222-8222-222222222222",
  name: "Customer",
  officeType: "head_office",
  saveUnverified: false,
  taxId: "0107544000108",
};

const row = {
  address: input.address,
  branch_number: input.branchNumber,
  contact_email: input.contactEmail,
  contact_name: input.contactName,
  contact_phone: input.contactPhone,
  customer_type: input.customerType,
  dbd_address: null,
  dbd_name: null,
  dbd_status: null,
  dbd_verified_at: null,
  id: input.id,
  is_active: true,
  name: input.name,
  office_type: input.officeType,
  tax_id: input.taxId,
  updated_at: "2026-07-22T00:00:00.000Z",
};

function mutationClient(capture: (value: Record<string, unknown>) => void): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "quotation_customers");
      const chain = {
        eq() { return chain; },
        insert(value: Record<string, unknown>) { capture(value); return chain; },
        select() { return chain; },
        single: async () => ({ data: row, error: null }),
        update(value: Record<string, unknown>) { capture(value); return chain; },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("quotation customer repository mutation boundary", () => {
  it("records the authenticated actor on privileged inserts", async () => {
    let payload: Record<string, unknown> = {};
    const insert = insertQuotationCustomer as unknown as (
      client: SupabaseClient,
      value: QuotationCustomerInput,
      defaults: null,
      actor: string,
    ) => Promise<unknown>;

    await insert(mutationClient((value) => { payload = value; }), input, null, actorId);

    assert.equal(payload.created_by, actorId);
    assert.equal(payload.updated_by, actorId);
  });

  it("does not update immutable identity and records the authenticated actor", async () => {
    let payload: Record<string, unknown> = {};
    const update = updateQuotationCustomer as unknown as (
      client: SupabaseClient,
      value: QuotationCustomerInput,
      actor: string,
    ) => Promise<unknown>;

    await update(mutationClient((value) => { payload = value; }), input, actorId);

    assert.equal(payload.updated_by, actorId);
    assert.equal("tax_id" in payload, false);
    assert.equal("customer_type" in payload, false);
  });

  it("limits active-state changes to the flag and authenticated actor", async () => {
    let payload: Record<string, unknown> = {};
    const setActive = setQuotationCustomerActive as unknown as (
      client: SupabaseClient,
      id: string,
      active: boolean,
      actor: string,
    ) => Promise<unknown>;

    await setActive(mutationClient((value) => { payload = value; }), input.id!, false, actorId);

    assert.deepEqual(payload, { is_active: false, updated_by: actorId });
  });

  it("maps a unique conflict back to the inactive master", async () => {
    const inactiveRow = { ...row, is_active: false };
    const chain = {
      eq() { return chain; },
      insert() { return chain; },
      maybeSingle: async () => ({ data: inactiveRow, error: null }),
      select() { return chain; },
      single: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }),
    };
    const client = { from: () => chain } as unknown as SupabaseClient;

    await assert.rejects(
      insertQuotationCustomer(client, input, null, actorId),
      (error: unknown) => error instanceof QuotationCustomerDuplicateError
        && error.customer.isActive === false,
    );
  });
});

describe("quotation customer picker search boundary", () => {
  it("requests active rows and returns repository results", async () => {
    let params: Record<string, unknown> = {};
    const client = {
      rpc: async (_name: string, value: Record<string, unknown>) => {
        params = value;
        return { data: [{ ...row, total_count: 1 }], error: null };
      },
    } as unknown as SupabaseClient;

    const result = await searchActiveQuotationCustomers(client, " Customer ");

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.items.length, 1);
    assert.deepEqual(params, {
      p_active: true,
      p_page: 1,
      p_page_size: 50,
      p_search: "Customer",
    });
  });

  it("returns retryable feedback instead of an empty success on database failure", async (context) => {
    context.mock.method(console, "error", () => {});
    const client = {
      rpc: async () => ({ data: null, error: { message: "database offline" } }),
    } as unknown as SupabaseClient;

    const result = await searchActiveQuotationCustomers(client, "Customer");

    assert.deepEqual(result, {
      formError: "ไม่สามารถค้นหาลูกค้าได้ กรุณาลองอีกครั้ง",
      ok: false,
    });
  });
});
