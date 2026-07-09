"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowLeftRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleCodeIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import { scrollActiveItemToStart } from "../../../lib/scroll-active-item";
import { cn } from "../../../lib/utils";
import {
  HOUSE_COVER_SELECT_MAX,
  HOUSE_COVER_SELECT_MIN,
  getHouseCoverSelectedImages,
  getHouseImageStorageProvider,
  getImageZoneMeta,
  getSelectedImageZoneGroup,
  type HouseImageItem,
  type ImageZoneIconName,
  type ImageZoneGroup,
} from "../../../server/services/images";
import { AdminImageCard } from "../image-asset-card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

const allZonesKey = "__all__";

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

function ZoneIcon({ icon }: { icon: ImageZoneIconName }) {
  const Icon = zoneIconByName[icon];

  return <Icon aria-hidden />;
}

function displayUrl(image: HouseImageItem): string | null {
  const provider = getHouseImageStorageProvider(image.image_url);
  if (provider === "r2" && image.image_url) return image.image_url;
  if (!image.image_name) return null;

  try {
    return buildAwsImageUrl(image.image_name);
  } catch {
    return null;
  }
}

function coverSelectHref(propertyId: string, zone?: string, returnTo?: string): string {
  const params = new URLSearchParams({ mode: "cover-select" });
  if (zone && zone !== allZonesKey) params.set("zone", zone);
  if (returnTo) params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function normalImageHref(propertyId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return `/admin/houses/${encodeURIComponent(propertyId)}/images${query ? `?${query}` : ""}`;
}

function selectedCountLabel(count: number): string {
  return `${count}/${HOUSE_COVER_SELECT_MAX} รูป`;
}

function SortableSelectedImage({
  canMoveLeft,
  canMoveRight,
  image,
  index,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: {
  canMoveLeft: boolean;
  canMoveRight: boolean;
  image: HouseImageItem;
  index: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}) {
  const { isDragging, ref } = useSortable({
    group: "cover-select",
    id: image.id,
    index,
  });

  return (
    <div
      className={cn("w-36 shrink-0 sm:w-40", isDragging && "opacity-60")}
      data-dnd-kit-sortable
      ref={ref}
    >
      <AdminImageCard
        action={
          <Button
            className="size-7 bg-background/90"
            onClick={onRemove}
            size="icon"
            title="เอาออกจากรูปแสดง"
            type="button"
            variant="outline"
          >
            <XIcon data-icon="inline-start" />
            <span className="sr-only">เอาออกจากรูปแสดง</span>
          </Button>
        }
        alt={image.image_name ?? "house image"}
        imageName={image.image_name ?? "-"}
        orderLabel={`# ${index + 1}`}
        previewEnabled={false}
        secondaryLabel={getImageZoneMeta(image.image_zone ?? "").label}
        src={displayUrl(image)}
      />
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Button disabled={!canMoveLeft} onClick={onMoveLeft} size="sm" type="button" variant="outline">
          <ArrowLeftIcon data-icon="inline-start" />
          <span className="sr-only">เลื่อนไปซ้าย</span>
        </Button>
        <Button disabled={!canMoveRight} onClick={onMoveRight} size="sm" type="button" variant="outline">
          <ArrowRightIcon data-icon="inline-start" />
          <span className="sr-only">เลื่อนไปขวา</span>
        </Button>
      </div>
    </div>
  );
}

interface CoverSelectViewerProps {
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  saveAction: (imageIds: number[]) => Promise<{ savedCount: number }>;
  selectedZone?: string;
}

interface CoverSelectViewerContentProps extends CoverSelectViewerProps {
  allImages: HouseImageItem[];
  initialSelectedIds: number[];
}

export function CoverSelectViewer(props: CoverSelectViewerProps) {
  const allImages = useMemo(() => props.groups.flatMap((group) => group.images), [props.groups]);
  const initialSelectedIds = useMemo(
    () => getHouseCoverSelectedImages(allImages).map((image) => image.id),
    [allImages],
  );
  const initialSelectedKey = initialSelectedIds.join(",");

  return (
    <CoverSelectViewerContent
      {...props}
      allImages={allImages}
      initialSelectedIds={initialSelectedIds}
      key={initialSelectedKey}
    />
  );
}

function CoverSelectViewerContent({
  allImages,
  groups,
  initialSelectedIds,
  propertyId,
  returnTo,
  saveAction,
  selectedZone,
}: CoverSelectViewerContentProps) {
  const router = useRouter();
  const activeZoneRef = useRef<HTMLAnchorElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const imageById = useMemo(() => new Map(allImages.map((image) => [image.id, image])), [allImages]);
  const selectedImages = selectedIds
    .map((id) => imageById.get(id))
    .filter((image): image is HouseImageItem => Boolean(image));
  const selectedGroup = selectedZone ? getSelectedImageZoneGroup(groups, selectedZone) : null;
  const selectedMeta = selectedZone ? getImageZoneMeta(selectedZone) : null;
  const visibleImages = selectedGroup ? selectedGroup.images : allImages;
  const canSave =
    selectedIds.length >= HOUSE_COVER_SELECT_MIN &&
    selectedIds.length <= HOUSE_COVER_SELECT_MAX &&
    !isPending;
  const canSort = selectedIds.length > 1 && !isPending;

  useEffect(() => {
    const activeZone = activeZoneRef.current;
    if (!activeZone || !window.matchMedia("(max-width: 1023px)").matches) return;

    scrollActiveItemToStart(activeZone);
  }, [selectedZone]);

  function toggleImage(image: HouseImageItem) {
    setSelectedIds((ids) => {
      if (ids.includes(image.id)) return ids.filter((id) => id !== image.id);

      if (ids.length >= HOUSE_COVER_SELECT_MAX) {
        toast.warning(`เลือกได้สูงสุด ${HOUSE_COVER_SELECT_MAX} รูป`);
        return ids;
      }

      return [...ids, image.id];
    });
  }

  function removeSelectedImage(imageId: number) {
    setSelectedIds((ids) => ids.filter((id) => id !== imageId));
  }

  function moveSelectedImage(fromIndex: number, toIndex: number) {
    setSelectedIds((ids) => {
      if (toIndex < 0 || toIndex >= ids.length) return ids;
      const next = [...ids];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }

  function openSortDialog() {
    setIsConfirmDialogOpen(true);
  }

  function saveSelection() {
    if (selectedIds.length < HOUSE_COVER_SELECT_MIN) {
      toast.error(`ต้องเลือกอย่างน้อย ${HOUSE_COVER_SELECT_MIN} รูป`);
      return;
    }

    if (selectedIds.length > HOUSE_COVER_SELECT_MAX) {
      toast.error(`เลือกได้สูงสุด ${HOUSE_COVER_SELECT_MAX} รูป`);
      return;
    }

    openSortDialog();
  }

  function confirmSaveSelection() {
    if (!canSave) return;

    startTransition(() => {
      void (async () => {
        try {
          await saveAction(selectedIds);
          setIsConfirmDialogOpen(false);
          toast.success("บันทึกลำดับรูปแสดงแล้ว");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "บันทึกลำดับรูปแสดงไม่สำเร็จ");
        }
      })();
    });
  }

  return (
    <>
    <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background lg:grid-cols-[220px_1fr] lg:grid-rows-1">
      <aside className="min-h-0 min-w-0 border-b bg-muted/20 lg:grid lg:grid-rows-[auto_minmax(0,1fr)] lg:border-b-0 lg:border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Zones</h2>
        </div>
        <ScrollArea className="w-full min-w-0 lg:h-full">
          <nav
            aria-label="Cover select image zones"
            className="flex w-max min-w-full gap-2 p-3 lg:w-auto lg:min-w-0 lg:flex-col"
          >
            <Link
              className={cn(
                "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                !selectedZone && "bg-primary text-primary-foreground hover:bg-primary",
              )}
              href={coverSelectHref(propertyId, allZonesKey, returnTo)}
              ref={!selectedZone ? activeZoneRef : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
                  <ImageIcon aria-hidden className="size-4" />
                </span>
                <span className="font-medium">ทั้งหมด</span>
              </span>
              <Badge className="shrink-0" variant={!selectedZone ? "secondary" : "outline"}>
                {allImages.length} รูป
              </Badge>
            </Link>
            {groups.map((group) => {
              const isActive = group.zone === selectedZone;
              const meta = getImageZoneMeta(group.zone);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  href={coverSelectHref(propertyId, group.zone, returnTo)}
                  key={group.zone}
                  ref={isActive ? activeZoneRef : undefined}
                  title={group.zone}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
                      <ZoneIcon icon={meta.icon} />
                    </span>
                    <span className="block min-w-0 truncate font-medium">{meta.label}</span>
                  </span>
                  <Badge className="shrink-0" variant={isActive ? "secondary" : "outline"}>
                    {group.images.length} รูป
                  </Badge>
                </Link>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
              {selectedMeta ? <ZoneIcon icon={selectedMeta.icon} /> : <ImageIcon aria-hidden className="size-4" />}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">จัดลำดับรูปแสดง</h2>
              <p className="text-xs text-muted-foreground">
                เลือก {HOUSE_COVER_SELECT_MIN}-{HOUSE_COVER_SELECT_MAX} รูป · {selectedCountLabel(selectedIds.length)}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button asChild size="sm" type="button" variant="outline">
              <Link
                aria-disabled={isPending}
                className={cn(isPending && "pointer-events-none opacity-50")}
                href={normalImageHref(propertyId, returnTo)}
              >
                <XIcon data-icon="inline-start" />
                ยกเลิก
              </Link>
            </Button>
            <Button disabled={!canSort} onClick={openSortDialog} size="sm" type="button" variant="outline">
              <ArrowLeftRightIcon data-icon="inline-start" />
              เรียงรูป
            </Button>
            <Button disabled={!canSave} onClick={saveSelection} size="sm" type="button">
              {isPending ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              บันทึก ({selectedIds.length})
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2">
          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-lg">
            {visibleImages.length === 0 ? (
              <div className="m-3 flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon aria-hidden />
                </div>
                <p className="mt-3 text-sm font-medium">ยังไม่มีรูปในมุมมองนี้</p>
              </div>
            ) : null}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-center gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
              {visibleImages.map((image) => {
                const selectedIndex = selectedIds.indexOf(image.id);
                const isSelected = selectedIndex !== -1;
                const zoneMeta = getImageZoneMeta(image.image_zone ?? "");

                return (
                  <AdminImageCard
                    alt={image.image_name ?? "house image"}
                    imageName={image.image_name ?? "-"}
                    key={image.id}
                    onSelect={() => toggleImage(image)}
                    orderLabel={isSelected ? `# ${selectedIndex + 1}` : undefined}
                    previewEnabled={false}
                    secondaryLabel={zoneMeta.label}
                    selected={isSelected}
                    selectionLabel={`${isSelected ? "เอาออก" : "เลือก"} ${image.image_name ?? image.id}`}
                    src={displayUrl(image)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>

    <Dialog
      open={isConfirmDialogOpen}
      onOpenChange={(open) => {
        if (!isPending) setIsConfirmDialogOpen(open);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-0.5rem)] max-w-7xl flex-col overflow-hidden sm:w-[calc(100vw-2rem)] sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>ยืนยันรูปที่เลือก</DialogTitle>
          <DialogDescription>
            ตรวจสอบรายการและจัดลำดับรูปก่อนบันทึกจริง
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-hidden">
          {selectedImages.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed bg-background text-sm text-muted-foreground">
              ยังไม่ได้เลือกรูป
            </div>
          ) : (
            <DragDropProvider
              onDragEnd={(event) => {
                if (event.canceled) return;
                setSelectedIds((ids) => move(ids, event) as number[]);
              }}
            >
              <ScrollArea className="w-full min-w-0 overflow-hidden">
                <div className="flex w-max gap-3 pb-3">
                  {selectedImages.map((image, index) => (
                    <SortableSelectedImage
                      canMoveLeft={index > 0}
                      canMoveRight={index < selectedImages.length - 1}
                      image={image}
                      index={index}
                      key={image.id}
                      onMoveLeft={() => moveSelectedImage(index, index - 1)}
                      onMoveRight={() => moveSelectedImage(index, index + 1)}
                      onRemove={() => removeSelectedImage(image.id)}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </DragDropProvider>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => setIsConfirmDialogOpen(false)}
            type="button"
            variant="outline"
          >
            ยกเลิก
          </Button>
          <Button disabled={!canSave} onClick={confirmSaveSelection} type="button">
            {isPending ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            ยืนยันบันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
