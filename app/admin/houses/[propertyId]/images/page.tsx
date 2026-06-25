import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageZoneViewer } from "../../../../../components/admin/images/image-zone-viewer";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { requireAdmin } from "../../../../../server/auth/admin";
import { getImagesByPropertyId } from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import { groupImagesByZone } from "../../../../../server/services/images";

export default async function HouseImagesPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { supabase } = await requireAdmin();
  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const images = await getImagesByPropertyId(supabase, propertyId);
  const groups = groupImagesByZone(images);

  return (
    <div>
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/houses">
          <ArrowLeftIcon data-icon="inline-start" />
          กลับไปบ้านพัก
        </Link>
      </Button>

      <div className="mb-4 mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{house.property_id}</p>
          <h1 className="text-xl font-semibold">{house.title || "ไม่พบชื่อบ้านพัก"}</h1>
        </div>
        <Badge className="w-fit" variant="secondary">
          ดูอย่างเดียว
        </Badge>
      </div>

      <ImageZoneViewer groups={groups} />
    </div>
  );
}
