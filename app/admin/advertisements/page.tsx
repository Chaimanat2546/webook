import Link from "next/link";

import { AdvertisementList } from "../../../components/admin/advertisements/advertisement-list";
import { Button } from "../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { requireAdmin } from "../../../server/auth/admin";
import { getAdvertisements } from "../../../server/repositories/advertisements";

export default async function AdvertisementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const { supabase } = await requireAdmin();
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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">โฆษณา</h1>
        <p className="text-sm font-medium text-muted-foreground">จัดการรูปภาพและสถานะโฆษณา</p>
      </div>

      {advertisements.length === 0 && !search ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>ยังไม่มีโฆษณา</EmptyTitle>
            <EmptyDescription>สร้างโฆษณาเพื่ออัปโหลดรูปภาพ</EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link href="/admin/advertisements/new">สร้างโฆษณา</Link>
          </Button>
        </Empty>
      ) : (
        <AdvertisementList advertisements={visibleAdvertisements} search={search} />
      )}
    </div>
  );
}
