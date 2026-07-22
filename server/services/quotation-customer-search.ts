import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { QuotationCustomerSearchResult } from "../../lib/quotation-customer-types.ts";
import { listQuotationCustomers } from "../repositories/quotation-customers.ts";

export async function searchActiveQuotationCustomers(
  supabase: SupabaseClient,
  search: string,
): Promise<QuotationCustomerSearchResult> {
  try {
    const result = await listQuotationCustomers(supabase, {
      active: true,
      page: 1,
      pageSize: 50,
      search: typeof search === "string" ? search : "",
    });
    return { items: result.items, ok: true };
  } catch (error) {
    console.error(
      "quotation_customer_search_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return { formError: "ไม่สามารถค้นหาลูกค้าได้ กรุณาลองอีกครั้ง", ok: false };
  }
}
