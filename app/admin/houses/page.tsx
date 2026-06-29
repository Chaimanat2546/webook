import { HouseList } from "../../../components/admin/houses/house-list";
import { Pagination } from "../../../components/admin/houses/pagination";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { requireAdmin } from "../../../server/auth/admin";
import { getPaginatedListings } from "../../../server/repositories/listings";
import {
  HOUSE_PAGE_SIZE,
  normalizeHouseSearch,
  normalizePage,
} from "../../../server/services/houses";
import { canUseAccommodation } from "../../../server/auth/admin";

export default async function HousesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const search = normalizeHouseSearch(params.q);
  const { adminUser, supabase } = await requireAdmin();

  if (!canUseAccommodation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดบ้านพัก</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_accommodation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { count, houses } = await getPaginatedListings(supabase, { page, search });
  const totalPages = Math.max(1, Math.ceil(count / HOUSE_PAGE_SIZE));
  const returnToParams = new URLSearchParams();
  returnToParams.set("page", String(page));
  if (search) returnToParams.set("q", search);
  const returnTo = `/admin/houses?${returnToParams}`;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">บ้านพัก</h1>
        <p className="text-sm font-medium text-muted-foreground">จัดการข้อมูลบ้านพัก</p>
      </div>

      <form className="mb-4">
        <Input
          className="md:max-w-sm"
          defaultValue={search}
          name="q"
          placeholder="ค้นหาบ้านพัก..."
          type="search"
        />
      </form>

      {houses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{search ? "ไม่พบบ้านพักที่ค้นหา" : "ยังไม่มีข้อมูลบ้านพัก"}</EmptyTitle>
            <EmptyDescription>ลองเปลี่ยนคำค้นหา หรือกลับมาที่หน้าแรกของรายการ</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <HouseList houses={houses} returnTo={returnTo} />
          <Pagination currentPage={page} search={search} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
