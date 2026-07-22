import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIcon } from "lucide-react";
import { Suspense } from "react";

import { Pagination } from "../../../../components/admin/houses/pagination";
import {
  QuotationCustomerList,
  QuotationCustomerToolbar,
} from "../../../../components/admin/quotations/customers/customer-list";
import { Button } from "../../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../../components/ui/empty";
import { Input } from "../../../../components/ui/input";
import { Skeleton } from "../../../../components/ui/skeleton";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin";
import {
  listQuotationCustomers,
  type QuotationCustomerListResult,
} from "../../../../server/repositories/quotation-customers";

function CustomerListSkeleton() {
  return (
    <div aria-label="กำลังโหลดข้อมูลลูกค้า" className="space-y-3">
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-44 w-full rounded-xl" key={index} />)}
      </div>
      <div className="hidden space-y-3 rounded-xl border p-4 md:block">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-10 w-full" key={index} />)}
      </div>
    </div>
  );
}

async function loadCustomers(
  supabase: SupabaseClient,
  options: { active: boolean; page: number; search: string },
): Promise<QuotationCustomerListResult | null> {
  try {
    let result = await listQuotationCustomers(supabase, { ...options, pageSize: 8 });
    if (options.page > result.totalPages) {
      result = await listQuotationCustomers(supabase, { ...options, page: result.totalPages, pageSize: 8 });
    }
    return result;
  } catch (error) {
    console.error("quotation_customer_list_failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  }
}

async function CustomerResults({
  active,
  page,
  search,
  supabase,
}: {
  active: boolean;
  page: number;
  search: string;
  supabase: SupabaseClient;
}) {
  const result = await loadCustomers(supabase, { active, page, search });
  if (!result) {
    return (
      <Empty role="alert">
        <EmptyHeader>
          <EmptyTitle>ไม่สามารถโหลดข้อมูลลูกค้าได้</EmptyTitle>
          <EmptyDescription>กรุณาลองใหม่อีกครั้ง</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!result.items.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{search ? "ไม่พบลูกค้าที่ค้นหา" : active ? "ยังไม่มีข้อมูลลูกค้า" : "ไม่มีลูกค้าที่ปิดใช้งาน"}</EmptyTitle>
          <EmptyDescription>{search ? "ลองเปลี่ยนคำค้นหา" : "เพิ่มลูกค้าหรือเลือกดูสถานะอื่น"}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <QuotationCustomerList customers={result.items} />
      <Pagination
        basePath="/admin/quotations/customers"
        currentPage={result.page}
        query={active ? undefined : { status: "inactive" }}
        search={search}
        totalPages={result.totalPages}
      />
    </>
  );
}

export default async function QuotationCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const { page, q, status } = await searchParams;
  const active = status !== "inactive";
  const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const search = q?.trim() ?? "";
  const { adminUser, supabase } = await requireAdmin();

  if (!canUseQuotation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงข้อมูลลูกค้า</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_quotation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const statusHref = (next: "active" | "inactive") => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (next === "inactive") params.set("status", "inactive");
    const query = params.toString();
    return `/admin/quotations/customers${query ? `?${query}` : ""}`;
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">ข้อมูลลูกค้า</h1>
        <p className="text-sm font-medium text-muted-foreground">Customer Master สำหรับใช้ในใบเสนอราคา</p>
      </div>

      <QuotationCustomerToolbar
        active={active}
        activeHref={statusHref("active")}
        inactiveHref={statusHref("inactive")}
      >
        <form className="flex min-w-0 basis-full gap-2 md:max-w-xl md:basis-auto md:flex-1">
          {!active ? <input name="status" type="hidden" value="inactive" /> : null}
          <label className="sr-only" htmlFor="quotation-customer-search">ค้นหาข้อมูลลูกค้า</label>
          <Input
            className="min-w-0 flex-1"
            defaultValue={search}
            id="quotation-customer-search"
            name="q"
            placeholder="ค้นหาชื่อ เลขผู้เสียภาษี ผู้ติดต่อ เบอร์โทร หรืออีเมล"
            type="search"
          />
          <Button className="shrink-0" type="submit"><SearchIcon aria-hidden />ค้นหา</Button>
        </form>
      </QuotationCustomerToolbar>

      <Suspense fallback={<CustomerListSkeleton />}>
        <CustomerResults active={active} page={requestedPage} search={search} supabase={supabase} />
      </Suspense>
    </div>
  );
}
