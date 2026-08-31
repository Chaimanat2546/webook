import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { QuotationList } from "../../../components/admin/quotations/quotation-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Button } from "../../../components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { requireQuotationAdmin } from "../../../server/auth/admin";
import {
  listQuotations,
  type QuotationListResult,
} from "../../../server/repositories/quotations";

function QuotationListSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายการใบเสนอราคา" className="space-y-3">
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="space-y-4 rounded-xl border p-4" key={index}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
      <div className="hidden rounded-xl border p-4 md:block">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="mt-3 h-10 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

async function loadQuotationResults(
  supabase: SupabaseClient,
  requestedPage: number,
  search: string,
): Promise<QuotationListResult | null> {
  try {
    let result = await listQuotations(supabase, {
      page: requestedPage,
      pageSize: 20,
      search,
    });
    if (requestedPage > result.totalPages) {
      result = await listQuotations(supabase, {
        page: result.totalPages,
        pageSize: 20,
        search,
      });
    }
    return result;
  } catch (error) {
    console.error(
      "Failed to list quotations",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  }
}

async function QuotationResults({
  requestedPage,
  search,
  supabase,
}: {
  requestedPage: number;
  search: string;
  supabase: SupabaseClient;
}) {
  const result = await loadQuotationResults(supabase, requestedPage, search);
  if (!result) {
    return (
      <Empty role="alert">
        <EmptyHeader>
          <EmptyTitle>ไม่สามารถโหลดรายการใบเสนอราคาได้</EmptyTitle>
          <EmptyDescription>กรุณาลองใหม่อีกครั้ง</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/admin/quotations">ลองใหม่</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {search ? "ไม่พบใบเสนอราคาที่ค้นหา" : "ยังไม่มีใบเสนอราคา"}
          </EmptyTitle>
          <EmptyDescription>
            {search ? "ลองเปลี่ยนคำค้นหา" : "สร้างใบเสนอราคาแรกเพื่อเริ่มใช้งาน"}
          </EmptyDescription>
        </EmptyHeader>
        {!search ? (
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/quotations/new">สร้างใบเสนอราคาแรก</Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <>
      <QuotationList quotations={result.items} />
      <Pagination
        basePath="/admin/quotations"
        currentPage={result.page}
        search={search}
        totalPages={result.totalPages}
      />
    </>
  );
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const search = q?.trim() ?? "";
  const { supabase } = await requireQuotationAdmin();

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">ใบเสนอราคา</h1>
          <p className="text-sm font-medium text-muted-foreground">
            สร้าง แก้ไข พิมพ์ และจัดการใบเสนอราคา
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/admin/quotations/customers">ข้อมูลลูกค้า</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/admin/quotations/settings/company">ตั้งค่าใบเสนอราคา</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/quotations/new">สร้างใบเสนอราคา</Link>
          </Button>
        </div>
      </div>
      <form className="mb-4 flex gap-2 md:max-w-sm">
        <label className="sr-only" htmlFor="quotation-search">
          ค้นหาใบเสนอราคา
        </label>
        <Input
          className="min-w-0 flex-1"
          defaultValue={search}
          id="quotation-search"
          name="q"
          placeholder="ค้นหาเลขที่ ลูกค้า อ้างอิง หรือเรื่องงาน"
          type="search"
        />
        <Button className="shrink-0" type="submit">
          <SearchIcon aria-hidden className="size-4" />
          ค้นหา
        </Button>
      </form>
      <Suspense fallback={<QuotationListSkeleton />}>
        <QuotationResults requestedPage={requestedPage} search={search} supabase={supabase} />
      </Suspense>
    </div>
  );
}
