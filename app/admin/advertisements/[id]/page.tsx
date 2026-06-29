import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdvertisementForm,
  type AdvertisementFormImage,
} from "../../../../components/admin/advertisements/advertisement-form";
import { AdvertisementSaveNotification } from "../../../../components/admin/advertisements/advertisement-save-notification";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/utils";
import { buildAdvertisementImageUrl } from "../../../../lib/advertisement-image-url";
import { getAdvertisementImageEnv } from "../../../../lib/env";
import { requireAdmin } from "../../../../server/auth/admin";
import {
  getAdvertisementById,
  type AdvertisementImageRow,
} from "../../../../server/repositories/advertisements";
import { updateAdvertisementAction } from "../actions";

function imageSrc(image: AdvertisementImageRow, workerUrl: string): string | null {
  try {
    return buildAdvertisementImageUrl(image.image_name, workerUrl);
  } catch {
    return null;
  }
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600",
      )}
      variant="outline"
    >
      {active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
    </Badge>
  );
}

function saveToastTitle(searchParams: { created?: string; saved?: string }) {
  if (searchParams.created === "1") {
    return "สร้างโฆษณาแล้ว";
  }

  if (searchParams.saved === "1") {
    return "บันทึกแล้ว";
  }

  return null;
}

export default async function AdvertisementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { id } = await params;
  const toastTitle = saveToastTitle(await searchParams);
  const { supabase } = await requireAdmin();
  const advertisement = await getAdvertisementById(supabase, id);
  if (!advertisement) notFound();

  const { workerUrl } = getAdvertisementImageEnv();
  const existingImages: AdvertisementFormImage[] = [...(advertisement.advertisement_images ?? [])]
    .sort((a, b) => a.image_order - b.image_order || a.id.localeCompare(b.id))
    .map((image) => ({
      id: image.id,
      image_name: image.image_name,
      image_order: image.image_order,
      src: imageSrc(image, workerUrl),
    }));
  const action = updateAdvertisementAction.bind(null, advertisement.id);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 border-b pb-4">
        <Button asChild className="w-fit px-0" size="sm" variant="ghost">
          <Link href="/admin/advertisements">
            <ArrowLeftIcon data-icon="inline-start" />
            กลับไปโฆษณา
          </Link>
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{advertisement.title}</h1>
            <StatusBadge active={advertisement.is_active} />
          </div>
          <p className="text-sm text-muted-foreground">
            จัดการรูปโฆษณา · {existingImages.length}/2 รูป
          </p>
        </div>
      </header>

      {toastTitle ? <AdvertisementSaveNotification title={toastTitle} /> : null}

      <AdvertisementForm
        action={action}
        defaultIsActive={advertisement.is_active}
        defaultTitle={advertisement.title}
        existingImages={existingImages}
        mode="edit"
      />
    </div>
  );
}
