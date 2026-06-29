"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangleIcon,
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CheckIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleCodeIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import {
  resizeHouseImageFile,
  type ResizedHouseImage,
} from "../../../lib/house-image-resize";
import { cn } from "../../../lib/utils";
import {
  formatImageMoveLabel,
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
  zone: "cover",
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

type UploadQueueStatus =
  | "pending-resize"
  | "resizing"
  | "pending-upload"
  | "uploading"
  | "uploaded"
  | "failed";

interface UploadQueueItem {
  error?: string;
  file: File;
  id: string;
  previewSrc: string;
  resized?: ResizedHouseImage;
  status: UploadQueueStatus;
  zone: string;
}

type BulkDeleteQueueStatus = "pending" | "deleting" | "deleted" | "failed";

interface BulkDeleteQueueItem {
  error?: string;
  id: number;
  image: HouseImageItem;
  status: BulkDeleteQueueStatus;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fallbackUploadQueueIdSuffix(): string {
  const cryptoProvider = globalThis.crypto;
  const getRandomValues = cryptoProvider?.getRandomValues;

  if (typeof getRandomValues === "function") {
    const values = new Uint32Array(4);
    getRandomValues.call(cryptoProvider, values);
    return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function uploadQueueIdSuffix(): string {
  const cryptoProvider = globalThis.crypto;
  const randomUUID = cryptoProvider?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(cryptoProvider);
  }

  return fallbackUploadQueueIdSuffix();
}

function shortImageName(imageName: string | null): string {
  if (!imageName) return "-";
  if (imageName.length <= 32) return imageName;
  return `${imageName.slice(0, 29)}...`;
}

function uploadQueueStatusLabel(status: UploadQueueStatus): string {
  switch (status) {
    case "pending-resize":
      return "รอแปลงรูป";
    case "resizing":
      return "กำลังแปลง";
    case "pending-upload":
      return "รออัปโหลด";
    case "uploading":
      return "กำลังอัปโหลด";
    case "uploaded":
      return "สำเร็จ";
    case "failed":
      return "ไม่สำเร็จ";
  }
}

function bulkDeleteStatusLabel(status: BulkDeleteQueueStatus): string {
  switch (status) {
    case "pending":
      return "รอลบ";
    case "deleting":
      return "กำลังลบ";
    case "deleted":
      return "ลบแล้ว";
    case "failed":
      return "ลบไม่สำเร็จ";
  }
}

function ZoneIcon({ icon }: { icon: ImageZoneIconName }) {
  const Icon = zoneIconByName[icon];

  return <Icon aria-hidden />;
}

function ImageCard({
  action,
  image,
  onSelect,
  previewEnabled = true,
  priority = false,
  selected = false,
}: {
  action?: ReactNode;
  image: HouseImageItem;
  onSelect?: () => void;
  previewEnabled?: boolean;
  priority?: boolean;
  selected?: boolean;
}) {
  const src = displayUrl(image);

  return (
    <AdminImageCard
      action={action}
      alt={image.image_name ?? "house image"}
      imageName={image.image_name ?? "-"}
      imageUnavailableText="แสดงรูปไม่ได้"
      loading={priority ? "eager" : "lazy"}
      onSelect={onSelect}
      orderLabel={formatImageMoveLabel(image.image_move)}
      previewDescription="ดูตัวอย่างรูปขนาดใหญ่"
      previewEnabled={previewEnabled}
      previewLabel={`เปิดตัวอย่างรูปขนาดใหญ่ ${image.image_name ?? "-"}`}
      selected={selected}
      selectionLabel={`เลือกรูป ${image.image_name ?? image.id}`}
      src={src}
    />
  );
}

function FailedUploadCard({
  disabled,
  item,
  onRemove,
  onRetry,
}: {
  disabled: boolean;
  item: UploadQueueItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      aria-label={`อัปโหลดไม่สำเร็จ ${item.file.name}`}
      className="w-full max-w-36 overflow-hidden rounded-md border border-dashed border-destructive/50 bg-muted/40 p-2 shadow-sm sm:max-w-40"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded bg-muted">
        <img
          alt={item.file.name}
          className="h-full w-full object-cover opacity-60 grayscale"
          src={item.previewSrc}
        />
        <Badge
          className="absolute left-2 top-2 max-w-[calc(100%-1rem)] gap-1 truncate px-1.5 py-0 text-[10px]"
          variant="destructive"
        >
          <AlertTriangleIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">อัปโหลดไม่สำเร็จ</span>
        </Badge>
      </div>
      <div className="mt-2 min-w-0 space-y-1">
        <p className="truncate text-xs font-medium">{item.file.name}</p>
        <p className="text-[10px] font-medium text-destructive">ยังไม่ถูกบันทึก</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {item.error ?? uploadQueueStatusLabel(item.status)}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">ขนาดเดิม {formatFileSize(item.file.size)}</p>
        <div className="flex items-center gap-1 pt-1">
          <Button
            className="size-7"
            disabled={disabled}
            onClick={onRetry}
            size="icon"
            title="ลองใหม่"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon aria-hidden className="size-3.5" />
            <span className="sr-only">ลองใหม่</span>
          </Button>
          <Button
            className="size-7"
            disabled={disabled}
            onClick={onRemove}
            size="icon"
            title="เอาออก"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden className="size-3.5" />
            <span className="sr-only">เอาออก</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ImageZoneViewerProps {
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
  const queuePreviewsRef = useRef<string[]>([]);
  const [isMutating, startMutationTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [bulkDeleteQueue, setBulkDeleteQueue] = useState<BulkDeleteQueueItem[]>([]);
  const [singleDeleteImage, setSingleDeleteImage] = useState<HouseImageItem | null>(null);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedBulkDeleteIds, setSelectedBulkDeleteIds] = useState<Set<number>>(new Set());
  const sidebarGroups = groups.length > 0 ? groups : [fallbackGroup];
  const selectedGroup = getSelectedImageZoneGroup(sidebarGroups, selectedZone) ?? fallbackGroup;
  const visibleImages = selectedGroup.images;
  const deletableImages = visibleImages.filter((image) =>
    isHouseImageFileOperationAllowed(image.image_url, "delete"),
  );
  const selectedBulkDeleteImages = deletableImages.filter((image) => selectedBulkDeleteIds.has(image.id));
  const allCurrentZoneImagesSelected =
    deletableImages.length > 0 && selectedBulkDeleteImages.length === deletableImages.length;
  const selectedMeta = getImageZoneMeta(selectedGroup.zone);
  const failedUploadItems = uploadQueue.filter(
    (item) => item.status === "failed" && item.zone === selectedGroup.zone,
  );
  const failedBulkDeleteItems = bulkDeleteQueue.filter((item) => item.status === "failed");
  const isBusy = isMutating || isUploading || isBulkDeleting;

  useEffect(() => {
    const activeZone = activeZoneRef.current;
    if (!activeZone || !window.matchMedia("(max-width: 1023px)").matches) return;

    activeZone.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, [selectedGroup.zone]);

  useEffect(() => {
    return () => {
      for (const src of queuePreviewsRef.current) {
        URL.revokeObjectURL(src);
      }
    };
  }, []);

  function updateUploadQueueItem(id: string, updates: Partial<UploadQueueItem>) {
    setUploadQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removeUploadQueueItems(ids: string[]) {
    if (ids.length === 0) return;
    const idsToRemove = new Set(ids);

    setUploadQueue((items) => {
      const removedPreviewSrcs = items
        .filter((queueItem) => idsToRemove.has(queueItem.id))
        .map((queueItem) => queueItem.previewSrc);
      const removedPreviewSrcSet = new Set(removedPreviewSrcs);

      for (const src of removedPreviewSrcs) {
        URL.revokeObjectURL(src);
      }

      queuePreviewsRef.current = queuePreviewsRef.current.filter(
        (src) => !removedPreviewSrcSet.has(src),
      );
      return items.filter((queueItem) => !idsToRemove.has(queueItem.id));
    });
  }

  function removeUploadQueueItem(id: string) {
    removeUploadQueueItems([id]);
  }

  function clearFailedUploads() {
    removeUploadQueueItems(failedUploadItems.map((item) => item.id));
  }

  function queueItemsForFiles(files: File[], zone: string) {
    const items = files.map((file) => {
      const previewSrc = URL.createObjectURL(file);
      queuePreviewsRef.current.push(previewSrc);
      return {
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${uploadQueueIdSuffix()}`,
        previewSrc,
        status: "pending-resize" as const,
        zone,
      };
    });

    setUploadQueue((existing) => [...existing, ...items]);
    return items;
  }

  function updateUploadProgressToast(
    uploadToastId: string | number,
    item: UploadQueueItem,
    current: number,
    total: number,
    status: UploadQueueStatus,
  ) {
    const label = status === "resizing" ? "กำลังเตรียมรูป" : "กำลังอัปโหลด";
    toast.loading(`${label} ${current}/${total}`, {
      description: item.file.name,
      id: uploadToastId,
    });
  }

  async function processUploadQueueItem(
    item: UploadQueueItem,
    onStatusChange?: (status: UploadQueueStatus) => void,
  ) {
    try {
      onStatusChange?.("resizing");
      updateUploadQueueItem(item.id, { error: undefined, status: "resizing" });
      const resized = await resizeHouseImageFile(item.file);
      updateUploadQueueItem(item.id, { resized, status: "pending-upload" });

      const formData = new FormData();
      formData.append("image_zone", item.zone);
      formData.append("images", resized.file);

      onStatusChange?.("uploading");
      updateUploadQueueItem(item.id, { status: "uploading" });
      await uploadAction(formData);
      updateUploadQueueItem(item.id, { resized, status: "uploaded" });
      removeUploadQueueItem(item.id);
    } catch (error) {
      updateUploadQueueItem(item.id, {
        error: error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ",
        status: "failed",
      });
      throw error;
    }
  }

  function uploadSelectedFiles(files: File[]) {
    if (files.length === 0) return;
    const items = queueItemsForFiles(files, selectedGroup.zone);
    const uploadToastId = toast.loading(`กำลังเตรียมรูป 1/${items.length}`, {
      description: items[0]?.file.name,
    });
    setIsUploading(true);

    startMutationTransition(() => {
      void (async () => {
        let failedCount = 0;
        try {
          for (const [index, item] of items.entries()) {
            try {
              await processUploadQueueItem(item, (status) =>
                updateUploadProgressToast(uploadToastId, item, index + 1, items.length, status),
              );
            } catch {
              failedCount += 1;
            }
          }

          toast.dismiss(uploadToastId);

          if (failedCount > 0) {
            toast.warning(`อัปโหลดสำเร็จ ${items.length - failedCount}/${items.length} รูป มีรูปไม่สำเร็จ ${failedCount} รูป`);
          } else {
            toast.success(`อัปโหลดรูปแล้ว ${items.length} รูป`);
          }

          router.refresh();
        } finally {
          if (inputRef.current) inputRef.current.value = "";
          setIsUploading(false);
        }
      })();
    });
  }

  function retryFailedUploads(itemIds?: string[]) {
    const retryIds = itemIds ? new Set(itemIds) : null;
    const failedItems = uploadQueue.filter(
      (item) =>
        item.status === "failed" &&
        item.zone === selectedGroup.zone &&
        (retryIds === null || retryIds.has(item.id)),
    );
    if (failedItems.length === 0) return;
    const uploadToastId = toast.loading(`กำลังลองใหม่ 1/${failedItems.length}`, {
      description: failedItems[0]?.file.name,
    });
    setIsUploading(true);

    startMutationTransition(() => {
      void (async () => {
        let failedCount = 0;
        try {
          for (const [index, item] of failedItems.entries()) {
            try {
              await processUploadQueueItem(item, (status) =>
                updateUploadProgressToast(uploadToastId, item, index + 1, failedItems.length, status),
              );
            } catch {
              failedCount += 1;
            }
          }

          toast.dismiss(uploadToastId);

          if (failedCount > 0) {
            toast.warning(`ลองใหม่แล้ว ยังมีรูปไม่สำเร็จ ${failedCount} รูป`);
          } else {
            toast.success("อัปโหลดรูปที่ไม่สำเร็จครบแล้ว");
          }
          router.refresh();
        } finally {
          setIsUploading(false);
        }
      })();
    });
  }

  function updateBulkDeleteQueueItem(id: number, updates: Partial<BulkDeleteQueueItem>) {
    setBulkDeleteQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function queueItemsForBulkDelete(images: HouseImageItem[]) {
    const items = images.map((image) => ({
      id: image.id,
      image,
      status: "pending" as const,
    }));

    setBulkDeleteQueue(items);
    return items;
  }

  function updateBulkDeleteProgressToast(
    deleteToastId: string | number,
    item: BulkDeleteQueueItem,
    current: number,
    total: number,
  ) {
    toast.loading(`กำลังลบ ${current}/${total}`, {
      description: shortImageName(item.image.image_name),
      id: deleteToastId,
    });
  }

  async function processBulkDeleteQueueItem(item: BulkDeleteQueueItem) {
    try {
      updateBulkDeleteQueueItem(item.id, { status: "deleting", error: undefined });
      const result = await deleteAction(item.image.id);
      updateBulkDeleteQueueItem(item.id, {
        status: "deleted",
        error: result.cleanupWarning ? "ลบรายการแล้ว แต่ลบไฟล์ใน storage ไม่ครบ" : undefined,
      });
    } catch (error) {
      updateBulkDeleteQueueItem(item.id, {
        error: error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ",
        status: "failed",
      });
      throw error;
    }
  }

  function processBulkDeleteItems(items: BulkDeleteQueueItem[]) {
    if (items.length === 0) return;

    const deleteToastId = toast.loading(`กำลังลบ 1/${items.length}`, {
      description: selectedMeta.label,
    });
    setIsBulkDeleting(true);

    startMutationTransition(() => {
      void (async () => {
        let failedCount = 0;
        let successCount = 0;

        try {
          for (const [index, item] of items.entries()) {
            updateBulkDeleteProgressToast(deleteToastId, item, index + 1, items.length);
            try {
              await processBulkDeleteQueueItem(item);
              successCount += 1;
            } catch {
              failedCount += 1;
            }
          }

          toast.dismiss(deleteToastId);
          if (failedCount > 0) {
            toast.warning(`ลบสำเร็จ ${successCount} รูป, ลบไม่สำเร็จ ${failedCount} รูป`);
          } else {
            toast.success(`ลบสำเร็จทั้งหมด ${successCount} รูป`);
            clearBulkDeleteSelection();
          }

          router.refresh();
        } finally {
          setIsBulkDeleting(false);
        }
      })();
    });
  }

  function retryFailedBulkDeletes(itemIds?: number[]) {
    const retryIds = itemIds ? new Set(itemIds) : null;
    const failedItems = bulkDeleteQueue.filter(
      (item) => item.status === "failed" && (retryIds === null || retryIds.has(item.id)),
    );
    if (failedItems.length === 0) return;

    const retryItems = failedItems.map((item) => ({
      ...item,
      error: undefined,
      status: "pending" as const,
    }));

    setBulkDeleteQueue((items) =>
      items.map((item) => {
        const retryItem = retryItems.find((candidate) => candidate.id === item.id);
        return retryItem ?? item;
      }),
    );
    processBulkDeleteItems(retryItems);
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadSelectedFiles(Array.from(event.currentTarget.files ?? []));
  }

  function confirmSingleDelete() {
    if (!singleDeleteImage) return;
    const imageToDelete = singleDeleteImage;
    const deleteToastId = toast.loading("กำลังลบรูป", {
      description: shortImageName(imageToDelete.image_name),
    });

    setSingleDeleteImage(null);
    startMutationTransition(() => {
      void (async () => {
        try {
          const result = await deleteAction(imageToDelete.id);
          toast.dismiss(deleteToastId);
          if (result.cleanupWarning) {
            toast.warning("ลบรายการรูปแล้ว แต่ลบไฟล์ใน storage ไม่ครบ");
          } else {
            toast.success("ลบรูปแล้ว");
          }
          router.refresh();
        } catch (error) {
          toast.dismiss(deleteToastId);
          toast.error(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
        }
      })();
    });
  }

  function clearBulkDeleteSelection() {
    setIsBulkSelecting(false);
    setIsBulkDeleteDialogOpen(false);
    setSingleDeleteImage(null);
    setBulkDeleteQueue([]);
    setSelectedBulkDeleteIds(new Set());
  }

  function openBulkDeleteDialog() {
    if (selectedBulkDeleteImages.length === 0) return;
    queueItemsForBulkDelete(selectedBulkDeleteImages);
    setIsBulkDeleteDialogOpen(true);
  }

  function toggleSelectAllInCurrentZone(checked: boolean) {
    setSelectedBulkDeleteIds(checked ? new Set(deletableImages.map((image) => image.id)) : new Set());
  }

  function toggleBulkDeleteImage(imageId: number, checked: boolean) {
    setSelectedBulkDeleteIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(imageId);
      } else {
        next.delete(imageId);
      }
      return next;
    });
  }

  function confirmBulkDelete() {
    const items =
      bulkDeleteQueue.length > 0 ? bulkDeleteQueue : queueItemsForBulkDelete(selectedBulkDeleteImages);
    const pendingItems = items.filter((item) => item.status === "pending");
    processBulkDeleteItems(pendingItems);
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
                  onClick={clearBulkDeleteSelection}
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
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ZoneIcon icon={selectedMeta.icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold" title={selectedGroup.zone}>
                {selectedMeta.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {visibleImages.length} รูป
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {isBulkSelecting ? (
              <>
                <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium">
                  <input
                    aria-label="เลือกทั้งหมดในโซนปัจจุบัน"
                    checked={allCurrentZoneImagesSelected}
                    className="size-4 accent-primary"
                    disabled={deletableImages.length === 0 || isBusy}
                    onChange={(event) => toggleSelectAllInCurrentZone(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  เลือกทั้งหมด
                </label>
                <Button
                  disabled={selectedBulkDeleteImages.length === 0 || isBusy}
                  onClick={openBulkDeleteDialog}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2Icon data-icon="inline-start" />
                  ลบที่เลือก ({selectedBulkDeleteImages.length})
                </Button>
                <Button disabled={isBusy} onClick={clearBulkDeleteSelection} size="sm" type="button" variant="outline">
                  ยกเลิก
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={deletableImages.length === 0 || isBusy}
                  onClick={() => setIsBulkSelecting(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2Icon data-icon="inline-start" />
                  เลือกลบ
                </Button>
                <Label
                  aria-disabled={isBusy}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer text-foreground",
                    isBusy && "pointer-events-none opacity-50",
                  )}
                  htmlFor="house-images-upload"
                >
                  {isBusy ? (
                    <Loader2Icon className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <UploadCloudIcon data-icon="inline-start" />
                  )}
                  {isBusy ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
                </Label>
                <input
                  accept="image/avif,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isBusy}
                  id="house-images-upload"
                  multiple
                  name="images"
                  onChange={onFilesChange}
                  ref={inputRef}
                  type="file"
                />
              </>
            )}
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] gap-3 p-2">
          <div className="min-h-0 overflow-y-auto overscroll-contain rounded-lg">
            {failedUploadItems.length > 0 ? (
              <section className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">
                    มี {failedUploadItems.length} รูปที่ยังอัปโหลดไม่สำเร็จ
                  </p>
                  <p className="text-xs text-muted-foreground">
                    รูปเหล่านี้ยังไม่ถูกบันทึก ลองใหม่หรือเอาออกจากรายการได้
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    disabled={isBusy}
                    onClick={() => retryFailedUploads()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    ลองใหม่ทั้งหมด
                  </Button>
                  <Button disabled={isBusy} onClick={clearFailedUploads} size="sm" type="button" variant="ghost">
                    เอาออกทั้งหมด
                  </Button>
                </div>
              </section>
            ) : null}
            {visibleImages.length === 0 && failedUploadItems.length === 0 ? (
              <div className="m-3 flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon aria-hidden className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium">โซนนี้ยังไม่มีรูป</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  อัปโหลดรูปเพื่อเพิ่มในโซน {selectedMeta.label}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-center gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
              {visibleImages.map((image, index) => {
                const canDelete = isHouseImageFileOperationAllowed(image.image_url, "delete");
                const isSelected = selectedBulkDeleteIds.has(image.id);
                const action = canDelete ? (
                  isBulkSelecting ? (
                    <div
                      aria-hidden
                      className={cn(
                        "flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background/95 shadow-sm",
                        isSelected && "border-primary bg-primary text-primary-foreground",
                      )}
                      title="เลือกรูปนี้"
                    >
                      {isSelected ? <CheckIcon aria-hidden className="size-4" /> : null}
                    </div>
                  ) : (
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
                  )
                ) : undefined;

                return (
                  <ImageCard
                    action={action}
                    image={image}
                    key={image.id}
                    onSelect={
                      isBulkSelecting && canDelete
                        ? () => toggleBulkDeleteImage(image.id, !selectedBulkDeleteIds.has(image.id))
                        : undefined
                    }
                    previewEnabled={!isBulkSelecting}
                    priority={index === 0}
                    selected={isSelected}
                  />
                );
              })}
              {failedUploadItems.map((item) => (
                <FailedUploadCard
                  disabled={isBusy}
                  item={item}
                  key={item.id}
                  onRemove={() => removeUploadQueueItem(item.id)}
                  onRetry={() => retryFailedUploads([item.id])}
                />
              ))}
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
            <Button disabled={isBusy} onClick={confirmSingleDelete} type="button" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              ลบรูปนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isBulkDeleting) setIsBulkDeleteDialogOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>ยืนยันลบรูปที่เลือก</DialogTitle>
            <DialogDescription>
              ลบเฉพาะรูปที่เลือกในโซน {selectedMeta.label} จำนวน {bulkDeleteQueue.length} รูป
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {bulkDeleteQueue.map((item) => {
                const image = item.image;
                const src = displayUrl(image);
                const statusLabel = bulkDeleteStatusLabel(item.status);
                const statusClassName = cn(
                  item.status === "deleted" && "text-emerald-600",
                  item.status === "failed" && "text-destructive",
                  item.status === "deleting" && "text-primary",
                );

                return (
                  <div className="min-w-0 space-y-2" key={item.id}>
                    <AdminImageCard
                      action={
                        item.status === "deleting" ? (
                          <span className="flex size-7 items-center justify-center rounded-md bg-background/90 shadow-sm">
                            <Loader2Icon aria-hidden className="size-4 animate-spin" />
                          </span>
                        ) : item.status === "deleted" ? (
                          <span className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                            <CheckIcon aria-hidden className="size-4" />
                          </span>
                        ) : item.status === "failed" ? (
                          <span className="flex size-7 items-center justify-center rounded-md bg-destructive text-destructive-foreground shadow-sm">
                            <AlertTriangleIcon aria-hidden className="size-4" />
                          </span>
                        ) : undefined
                      }
                      alt={image.image_name ?? "house image"}
                      className="max-w-none"
                      imageName={shortImageName(image.image_name)}
                      imageUnavailableText="แสดงรูปไม่ได้"
                      metaRows={[
                        { label: "ชื่อรูป", value: shortImageName(image.image_name) },
                        { label: "สถานะ", value: <span className={statusClassName}>{statusLabel}</span> },
                        ...(item.error ? [{ label: "สาเหตุ", value: item.error }] : []),
                      ]}
                      previewDescription="ดูรูปก่อนยืนยันลบ"
                      previewLabel={`เปิดดูรูป ${image.image_name ?? "-"}`}
                      src={src}
                    />
                    {item.status === "failed" ? (
                      <Button
                        className="w-full"
                        disabled={isBusy}
                        onClick={() => retryFailedBulkDeletes([item.id])}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        ลองใหม่
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={isBulkDeleting} type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            {failedBulkDeleteItems.length > 0 && !isBulkDeleting ? (
              <Button onClick={() => retryFailedBulkDeletes()} type="button" variant="outline">
                <RotateCcwIcon data-icon="inline-start" />
                ลองใหม่ทั้งหมด
              </Button>
            ) : null}
            <Button
              disabled={
                isBusy ||
                bulkDeleteQueue.length === 0 ||
                bulkDeleteQueue.every((item) => item.status !== "pending")
              }
              onClick={confirmBulkDelete}
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              ยืนยันลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
