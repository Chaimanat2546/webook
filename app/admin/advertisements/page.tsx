import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { AdvertisementList } from "../../../components/admin/advertisements/advertisement-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import { Button } from "../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { canUseAccommodation, requireAdmin } from "../../../server/auth/admin";
import { getAdvertisements } from "../../../server/repositories/advertisements";
import { normalizePage } from "../../../server/services/houses";

const ADVERTISEMENT_PAGE_SIZE = 8;

export default async function AdvertisementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const currentPage = normalizePage(page);
  const search = q?.trim() ?? "";
  const { adminUser, supabase } = await requireAdmin();

  if (!canUseAccommodation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดโฆษณา</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_accommodation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const advertisements = await getAdvertisements(supabase);
  const visibleAdvertisements = search
    ? advertisements.filter((advertisement) => {
        const query = search.toLowerCase();
        return (
          advertisement.title.toLowerCase().includes(query) ||
          advertisement.id.toLowerCase().includes(query)
        );
      })
    : advertisements;
  const totalPages = Math.max(1, Math.ceil(visibleAdvertisements.length / ADVERTISEMENT_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const from = (safeCurrentPage - 1) * ADVERTISEMENT_PAGE_SIZE;
  const paginatedAdvertisements = visibleAdvertisements.slice(from, from + ADVERTISEMENT_PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">โฆษณา</h1>
          <p className="text-sm font-medium text-muted-foreground">จัดการรูปภาพและสถานะโฆษณา</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/advertisements/new">สร้างโฆษณา</Link>
        </Button>
      </div>

      <form className="mb-4 flex gap-2 md:max-w-sm">
        <Input
          className="min-w-0 flex-1"
          defaultValue={search}
          name="q"
          placeholder="ค้นหาโฆษณา, ID..."
          type="search"
        />
        <Button className="shrink-0" type="submit">
          <SearchIcon aria-hidden className="size-4" />
          ค้นหา
        </Button>
      </form>

      {visibleAdvertisements.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{search ? "ไม่พบโฆษณาที่ค้นหา" : "ยังไม่มีโฆษณา"}</EmptyTitle>
            <EmptyDescription>
              {search ? "ลองเปลี่ยนคำค้นหา" : "สร้างโฆษณาเพื่ออัปโหลดรูปภาพ"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <AdvertisementList advertisements={paginatedAdvertisements} />
          <Pagination
            basePath="/admin/advertisements"
            currentPage={safeCurrentPage}
            search={search}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
