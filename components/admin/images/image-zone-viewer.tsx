"use client";

import {
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  MessageCircleCodeIcon,
  SaveIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

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
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

interface DraftPreview {
  file: File;
  src: string;
}

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

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

function DraftImageCard({
  action,
  imageOrder,
  preview,
  zone,
}: {
  action: ReactNode;
  imageOrder: number;
  preview: DraftPreview;
  zone: string;
}) {
  return (
    <AdminImageCard
      action={action}
      alt={preview.file.name}
      imageName={preview.file.name}
      metaRows={[{ label: "ขนาด", value: formatFileSize(preview.file.size) }]}
      orderLabel={formatImageMoveLabel(imageOrder)}
      previewDescription="ดูตัวอย่างรูปขนาดใหญ่"
      previewLabel={`เปิดตัวอย่างรูปขนาดใหญ่ ${preview.file.name}`}
      secondaryLabel={getImageZoneMeta(zone).label}
      secondaryTitle={zone}
      src={preview.src}
    />
  );
}

export function ImageZoneViewer({
  action,
  groups,
  propertyId,
  returnTo,
  selectedZone,
}: {
  action: (formData: FormData) => void | Promise<void>;
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  selectedZone?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<DraftPreview[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [previews, setPreviews] = useState<DraftPreview[]>([]);
  const sidebarGroups = groups.length > 0 ? groups : [fallbackGroup];
  const selectedGroup = getSelectedImageZoneGroup(sidebarGroups, selectedZone) ?? fallbackGroup;
  const visibleImages = selectedGroup.images.filter((image) => !deletedImageIds.includes(String(image.id)));
  const selectedMeta = getImageZoneMeta(selectedGroup.zone);
  const maxMove = Math.max(0, ...selectedGroup.images.map((image) => image.image_move ?? 0));

  useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview.src);
      }
    };
  }, []);

  function syncInputFiles(files: File[]) {
    if (!inputRef.current) return;

    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  function replacePreviews(files: File[], syncInput = false) {
    for (const preview of previewsRef.current) {
      URL.revokeObjectURL(preview.src);
    }

    const nextPreviews = files.map((file) => ({
      file,
      src: URL.createObjectURL(file),
    }));
    previewsRef.current = nextPreviews;
    setPreviews(nextPreviews);
    if (syncInput) syncInputFiles(files);
  }

  function appendPreviews(files: File[], syncInput = false) {
    const newPreviews = files.map((file) => ({
      file,
      src: URL.createObjectURL(file),
    }));
    const nextPreviews = [...previewsRef.current, ...newPreviews];

    previewsRef.current = nextPreviews;
    setPreviews(nextPreviews);
    if (syncInput) syncInputFiles(nextPreviews.map((preview) => preview.file));
  }

  function markDirty() {
    setIsDirty(true);
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    markDirty();
    appendPreviews(Array.from(event.currentTarget.files ?? []), true);
  }

  function removeDraftFile(indexToRemove: number) {
    markDirty();
    replacePreviews(
      previewsRef.current.filter((_, index) => index !== indexToRemove).map((preview) => preview.file),
      true,
    );
  }

  function markImageDeleted(imageId: number) {
    markDirty();
    setDeletedImageIds((imageIds) => {
      const value = String(imageId);
      return imageIds.includes(value) ? imageIds : [...imageIds, value];
    });
  }

  function resetDraft() {
    formRef.current?.reset();
    replacePreviews([], true);
    setDeletedImageIds([]);
    setIsDirty(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isDirty) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="grid min-w-0 overflow-hidden rounded-xl border bg-background lg:grid-cols-[220px_1fr]" onSubmit={onSubmit} ref={formRef}>
      <input name="image_zone" type="hidden" value={selectedGroup.zone} />
      {returnTo ? <input name="return_to" type="hidden" value={returnTo} /> : null}
      {deletedImageIds.map((imageId) => (
        <input key={imageId} name="deleted_image_ids" type="hidden" value={imageId} />
      ))}

      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Zones</h2>
        </div>
        <ScrollArea className="w-full min-w-0">
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

      <section className="min-w-0">
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
                {visibleImages.length + previews.length} รูป · Zone Order: {orderRangeLabel(selectedGroup)}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{visibleImages.length + previews.length} รูป</Badge>
        </header>

        <div className="grid min-w-0 gap-4 p-2">
          <div className="rounded-lg border border-dashed bg-muted/20">
            <Label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center" htmlFor="house-images-upload">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UploadCloudIcon className="size-5" />
              </span>
              <span className="font-medium">อัปโหลดรูปในหมวดนี้</span>
              <span className="text-xs text-muted-foreground">รองรับ AVIF, GIF, JPG, PNG, WEBP ไม่เกิน 10 MB</span>
            </Label>
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              id="house-images-upload"
              multiple
              name="images"
              onChange={onFilesChange}
              ref={inputRef}
              type="file"
            />
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-start gap-2 p-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
            {visibleImages.map((image, index) => {
              const canDelete = isHouseImageFileOperationAllowed(image.image_url, "delete");

              return (
                <ImageCard
                  action={
                    canDelete ? (
                      <Button
                        className="size-7 bg-background/90"
                        onClick={() => markImageDeleted(image.id)}
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

            {previews.map((preview, index) => (
              <DraftImageCard
                action={
                  <Button
                    className="size-7 bg-background/90"
                    onClick={() => removeDraftFile(index)}
                    size="icon"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    <span className="sr-only">ลบรูป draft</span>
                  </Button>
                }
                imageOrder={maxMove + index + 1}
                key={`${preview.file.name}-${preview.file.size}-${index}`}
                preview={preview}
                zone={selectedGroup.zone}
              />
            ))}
          </div>

          <div className="sticky bottom-0 z-10 -mx-2 border-t bg-background/95 px-2 py-3 backdrop-blur lg:flex lg:justify-end">
            <div className="flex gap-2 lg:w-auto">
              <Button className="flex-1 lg:flex-none" disabled={!isDirty} onClick={resetDraft} type="button" variant="outline">
                <XIcon data-icon="inline-start" />
                ยกเลิก
              </Button>
              <Button className="flex-1 lg:flex-none" disabled={!isDirty} type="submit">
                <SaveIcon data-icon="inline-start" />
                บันทึกการเปลี่ยนแปลง
              </Button>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
