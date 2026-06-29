"use client";

import {
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleCodeIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import { cn } from "../../../lib/utils";
import {
  formatImageMoveLabel,
  formatThaiImageDateTime,
  getHouseImageStorageProvider,
  getImageZoneMeta,
  getSelectedImageZoneGroup,
  isHouseImageFileOperationAllowed,
  type HouseImageItem,
  type ImageZoneIconName,
  type ImageZoneGroup,
} from "../../../server/services/images";
import { AdminImageCard } from "../image-asset-card";
import { Badge } from "../../ui/badge";
import { Button, buttonVariants } from "../../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Label } from "../../ui/label";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

const fallbackGroup: ImageZoneGroup = {
  images: [],
  maxMove: 0,
  minMove: 0,
  zone: "inside",
};

const zoneIconByName = {
  armchair: ArmchairIcon,
  bath: BathIcon,
  "bed-double": BedDoubleIcon,
  "car-front": CarFrontIcon,
  "cooking-pot": CookingPotIcon,
  "door-closed": DoorClosedIcon,
  image: ImageIcon,
  "message-circle-code": MessageCircleCodeIcon,
} satisfies Record<ImageZoneIconName, LucideIcon>;

function displayUrl(image: HouseImageItem): string | null {
  const provider = getHouseImageStorageProvider(image.image_url);
  if (provider === "r2" && image.image_url) {
    return image.image_url;
  }

  if (!image.image_name) return null;

  try {
    return buildAwsImageUrl(image.image_name);
  } catch {
    return null;
  }
}

function imageZoneHref(propertyId: string, zone: string, returnTo?: string): string {
  const params = new URLSearchParams({ zone });
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function orderRangeLabel(group: ImageZoneGroup): string {
  if (group.images.length === 0) return "-";
  return `${formatImageMoveLabel(group.minMove)} - ${formatImageMoveLabel(group.maxMove)}`;
}

function ZoneIcon({ icon }: { icon: ImageZoneIconName }) {
  const Icon = zoneIconByName[icon];

  return <Icon aria-hidden />;
}

function ImageCard({
  action,
  image,
  priority = false,
  zone,
}: {
  action?: ReactNode;
  image: HouseImageItem;
  priority?: boolean;
  zone: string;
}) {
  const src = displayUrl(image);
  const zoneMeta = getImageZoneMeta(zone);

  return (
    <AdminImageCard
      action={action}
      alt={image.image_name ?? "house image"}
      imageName={image.image_name ?? "-"}
      imageUnavailableText="แสดงรูปไม่ได้"
      loading={priority ? "eager" : "lazy"}
      metaRows={[
        { label: "สร้าง", value: formatThaiImageDateTime(image.created_at) },
        { label: "อัปเดต", value: formatThaiImageDateTime(image.updated_at) },
      ]}
      orderLabel={formatImageMoveLabel(image.image_move)}
      previewDescription="ดูตัวอย่างรูปขนาดใหญ่"
      previewLabel={`เปิดตัวอย่างรูปขนาดใหญ่ ${image.image_name ?? "-"}`}
      secondaryLabel={zoneMeta.label}
      secondaryTitle={zone}
      src={src}
    />
  );
}

interface ImageZoneViewerProps {
  bulkDeleteAction: (imageIds: number[]) => Promise<{
    databaseFailed: Array<{ id: number; fileName: string | null; message: string }>;
    deleted: Array<{ id: number; fileName: string | null }>;
    skipped: Array<{ id: number; reason: string }>;
    storageFailed: Array<{ id: number; fileName: string | null; message: string }>;
  }>;
  deleteAction: (imageId: number) => Promise<{
    cleanupWarning: boolean;
    deletedId: number;
    fileName: string | null;
  }>;
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  selectedZone?: string;
  uploadAction: (formData: FormData) => Promise<{ uploadedCount: number }>;
}

export function ImageZoneViewer({
  deleteAction,
  groups,
  propertyId,
  returnTo,
  selectedZone,
  uploadAction,
}: ImageZoneViewerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeZoneRef = useRef<HTMLAnchorElement>(null);
  const [isMutating, startMutationTransition] = useTransition();
  const [singleDeleteImage, setSingleDeleteImage] = useState<HouseImageItem | null>(null);
  const sidebarGroups = groups.length > 0 ? groups : [fallbackGroup];
  const selectedGroup = getSelectedImageZoneGroup(sidebarGroups, selectedZone) ?? fallbackGroup;
  const visibleImages = selectedGroup.images;
  const selectedMeta = getImageZoneMeta(selectedGroup.zone);

  useEffect(() => {
    const activeZone = activeZoneRef.current;
    if (!activeZone || !window.matchMedia("(max-width: 1023px)").matches) return;

    activeZone.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, [selectedGroup.zone]);

  function uploadSelectedFiles(files: File[]) {
    if (files.length === 0) return;

    startMutationTransition(() => {
      void (async () => {
        const formData = new FormData();
        formData.append("image_zone", selectedGroup.zone);
        for (const file of files) {
          formData.append("images", file);
        }

        try {
          const result = await uploadAction(formData);
          toast.success(`อัปโหลดรูปแล้ว ${result.uploadedCount} รูป`);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
        } finally {
          if (inputRef.current) inputRef.current.value = "";
        }
      })();
    });
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadSelectedFiles(Array.from(event.currentTarget.files ?? []));
  }

  function confirmSingleDelete() {
    if (!singleDeleteImage) return;

    startMutationTransition(() => {
      void (async () => {
        try {
          const result = await deleteAction(singleDeleteImage.id);
          if (result.cleanupWarning) {
            toast.warning("ลบรายการรูปแล้ว แต่ลบไฟล์ใน storage ไม่ครบ");
          } else {
            toast.success("ลบรูปแล้ว");
          }
          setSingleDeleteImage(null);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
        }
      })();
    });
  }

  return (
    <>
      <div className="grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] rounded-xl border bg-background lg:grid-cols-[220px_1fr] lg:grid-rows-1">
      <aside className="min-w-0 min-h-0 border-b bg-muted/20 lg:grid lg:grid-rows-[auto_minmax(0,1fr)] lg:border-b-0 lg:border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Zones</h2>
        </div>
        <ScrollArea className="w-full min-w-0 lg:h-full">
          <nav
            className="flex w-max min-w-full gap-2 p-3 lg:w-auto lg:min-w-0 lg:flex-col"
            aria-label="Image zones"
          >
            {sidebarGroups.map((group) => {
              const isActive = group.zone === selectedGroup.zone;
              const meta = getImageZoneMeta(group.zone);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  href={imageZoneHref(propertyId, group.zone, returnTo)}
                  key={group.zone}
                  ref={isActive ? activeZoneRef : undefined}
                  title={group.zone}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
                      <ZoneIcon icon={meta.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{meta.label}</span>
                      <span
                        className={cn(
                          "block text-xs",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        Zone Order {orderRangeLabel(group)}
                      </span>
                    </span>
                  </span>
                  <Badge variant={isActive ? "secondary" : "outline"}>{group.images.length}</Badge>
                </Link>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ZoneIcon icon={selectedMeta.icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold" title={selectedGroup.zone}>
                {selectedMeta.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {visibleImages.length} รูป · Zone Order: {orderRangeLabel(selectedGroup)}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Label
              aria-disabled={isMutating}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer text-foreground",
                isMutating && "pointer-events-none opacity-50",
              )}
              htmlFor="house-images-upload"
            >
              {isMutating ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <UploadCloudIcon data-icon="inline-start" />
              )}
              {isMutating ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
            </Label>
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={isMutating}
              id="house-images-upload"
              multiple
              name="images"
              onChange={onFilesChange}
              ref={inputRef}
              type="file"
            />
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2">
          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-lg">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-center gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
              {visibleImages.map((image, index) => {
                const canDelete = isHouseImageFileOperationAllowed(image.image_url, "delete");

                return (
                  <ImageCard
                    action={
                      canDelete ? (
                        <Button
                          className="size-7 bg-background/90"
                          onClick={() => setSingleDeleteImage(image)}
                          size="icon"
                          type="button"
                          variant="destructive"
                        >
                          <Trash2Icon data-icon="inline-start" />
                          <span className="sr-only">ลบรูป</span>
                        </Button>
                      ) : undefined
                    }
                    image={image}
                    key={image.id}
                    priority={index === 0}
                    zone={selectedGroup.zone}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>

      <Dialog open={singleDeleteImage !== null} onOpenChange={(open) => !open && setSingleDeleteImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูป</DialogTitle>
            <DialogDescription>ตรวจสอบรูปก่อนยืนยันการลบ รูปที่ลบแล้วจะถูกนำออกจากบ้านพักนี้</DialogDescription>
          </DialogHeader>
          {singleDeleteImage ? (
            <div className="grid gap-3">
              <div className="overflow-hidden rounded-md bg-muted">
                {displayUrl(singleDeleteImage) ? (
                  <img
                    alt={singleDeleteImage.image_name ?? "house image"}
                    className="max-h-80 w-full object-contain"
                    src={displayUrl(singleDeleteImage) ?? undefined}
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                    แสดงรูปไม่ได้
                  </div>
                )}
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {singleDeleteImage.image_name ?? "-"}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button disabled={isMutating} onClick={confirmSingleDelete} type="button" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              ลบรูปนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
