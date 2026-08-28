import { notFound } from "next/navigation";

import { HouseTaskHeader } from "../../../../../components/admin/houses/house-task-header";
import { CoverSelectViewer } from "../../../../../components/admin/images/cover-select-viewer";
import { ImageZoneViewer } from "../../../../../components/admin/images/image-zone-viewer";
import { requireAccommodationAdmin } from "../../../../../server/auth/admin";
import { getImagesByPropertyId } from "../../../../../server/repositories/images";
import { getListingByPropertyId } from "../../../../../server/repositories/listings";
import { groupImagesByZone } from "../../../../../server/services/images";
import {
  deleteHouseImageAction,
  saveHouseCoverSelectAction,
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
  searchParams: Promise<{ zone?: string; returnTo?: string; mode?: string }>;
}) {
  const { propertyId } = await params;
  const { mode, returnTo, zone } = await searchParams;
  const safeReturnTo = getSafeReturnTo(returnTo);
  const backHref = safeReturnTo ?? "/admin/houses";
  const { supabase } = await requireAccommodationAdmin();

  const house = await getListingByPropertyId(supabase, propertyId);

  if (!house) {
    notFound();
  }

  const images = await getImagesByPropertyId(supabase, propertyId);
  const groups = groupImagesByZone(images);
  const isCoverSelectMode = mode === "cover-select";
  const imageTaskLabel = isCoverSelectMode ? "เรียงลำดับรูป" : "จัดการรูป";

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 flex-col gap-4">
      <HouseTaskHeader
        backHref={backHref}
        propertyId={house.property_id}
        subtitle={imageTaskLabel}
        title={house.title || "ไม่พบชื่อบ้านพัก"}
      />

      {isCoverSelectMode ? (
        <CoverSelectViewer
          groups={groups}
          propertyId={propertyId}
          returnTo={safeReturnTo ?? undefined}
          saveAction={saveHouseCoverSelectAction.bind(null, propertyId)}
          selectedZone={zone}
        />
      ) : (
        <ImageZoneViewer
          deleteAction={deleteHouseImageAction.bind(null, propertyId)}
          groups={groups}
          propertyId={propertyId}
          returnTo={safeReturnTo ?? undefined}
          selectedZone={zone}
          uploadAction={uploadHouseImagesAction.bind(null, propertyId)}
        />
      )}
    </div>
  );
}
