import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { AdvertisementForm } from "../../../../components/admin/advertisements/advertisement-form";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../../components/ui/empty";
import { canUseAccommodation, requireAdmin } from "../../../../server/auth/admin";
import {
  createAdvertisementAction,
  uploadAdvertisementImagesAction,
} from "../actions";

export default async function NewAdvertisementPage() {
  const { adminUser } = await requireAdmin();

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
            <h1 className="text-xl font-semibold">สร้างโฆษณา</h1>
            <Badge variant="secondary">ใหม่</Badge>
          </div>
          <p className="text-sm text-muted-foreground">จัดการรูปโฆษณา · 0/2 รูป</p>
        </div>
      </header>

      <AdvertisementForm
        action={createAdvertisementAction}
        createUploadAction={uploadAdvertisementImagesAction}
        mode="create"
      />
    </div>
  );
}
