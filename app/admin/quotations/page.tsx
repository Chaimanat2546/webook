import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { QuotationList } from "../../../components/admin/quotations/quotation-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Button } from "../../../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";
import { listQuotations } from "../../../server/repositories/quotations";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const search = q?.trim() ?? "";
  const { adminUser, supabase } = await requireAdmin();

  if (!canUseQuotation(adminUser)) {
    return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle><EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_quotation</EmptyDescription></EmptyHeader></Empty>;
  }

  let result = await listQuotations(supabase, { page: requestedPage, pageSize: 20, search });
  if (requestedPage > result.totalPages) {
    result = await listQuotations(supabase, { page: result.totalPages, pageSize: 20, search });
  }

  return <div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-xl font-semibold">ใบเสนอราคา</h1><p className="text-sm text-muted-foreground">สร้าง แก้ไข พิมพ์ และจัดการใบเสนอราคา</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline"><Link href="/admin/quotations/settings/company">ข้อมูลผู้ขายหลัก</Link></Button>
        <Button asChild><Link href="/admin/quotations/new">สร้างใบเสนอราคา</Link></Button>
      </div>
    </div>
    <form className="mb-4 flex gap-2 md:max-w-sm">
      <label className="sr-only" htmlFor="quotation-search">ค้นหาใบเสนอราคา</label>
      <input className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-sm" defaultValue={search} id="quotation-search" name="q" placeholder="เลขที่ ลูกค้า เลขอ้างอิง หรือหัวข้อ" type="search" />
      <Button className="shrink-0" type="submit"><SearchIcon aria-hidden className="size-4" />ค้นหา</Button>
    </form>
    {result.items.length === 0 ? <Empty><EmptyHeader><EmptyTitle>{search ? "ไม่พบใบเสนอราคาที่ค้นหา" : "ยังไม่มีใบเสนอราคา"}</EmptyTitle></EmptyHeader></Empty> : <>
      <QuotationList quotations={result.items} />
      <Pagination basePath="/admin/quotations" currentPage={result.page} search={search} totalPages={result.totalPages} />
    </>}
  </div>;
}
