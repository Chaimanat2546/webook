import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageZoneViewer } from "../../../../../components/admin/images/image-zone-viewer";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../../../components/ui/empty";
import {
  canUseAccommodation,
  requireAdmin,
} from "../../../../../server/auth/admin";
import { getImagesByPropertyId } from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import { groupImagesByZone } from "../../../../../server/services/images";
import {
  deleteHouseImageAction,
  uploadHouseImagesAction,
} from "./actions";

function getSafeReturnTo(value?: string): string | null {
  if (value === "/admin/houses" || value?.startsWith("/admin/houses?")) {
    return value;
  }

  return null;
}

export default async function HouseImagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ zone?: string; returnTo?: string }>;
}) {
  const { propertyId } = await params;
  const { returnTo, zone } = await searchParams;
  const safeReturnTo = getSafeReturnTo(returnTo);
  const backHref = safeReturnTo ?? "/admin/houses";
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

  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const images = await getImagesByPropertyId(supabase, propertyId);
  const groups = groupImagesByZone(images);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Button asChild className="w-fit px-0" size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeftIcon data-icon="inline-start" />
              กลับไปบ้านพัก
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{house.title || "ไม่พบชื่อบ้านพัก"}</h1>
              <Badge variant="secondary">DV-{house.property_id}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              จัดการรูปภาพบ้านพัก · {images.length} รูป
            </p>
          </div>
        </div>
      </header>

      <ImageZoneViewer
        deleteAction={deleteHouseImageAction.bind(null, propertyId)}
        groups={groups}
        propertyId={propertyId}
        returnTo={safeReturnTo ?? undefined}
        selectedZone={zone}
        uploadAction={uploadHouseImagesAction.bind(null, propertyId)}
      />
    </div>
  );
}
