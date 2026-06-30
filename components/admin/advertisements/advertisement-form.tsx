"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangleIcon,
  CheckIcon,
  ImageIcon,
  Loader2Icon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { resizeToMax } from "../../../lib/advertisement-image-resize";
import { cn } from "../../../lib/utils";
import { AdminImageCard } from "../image-asset-card";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button, buttonVariants } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Separator } from "../../ui/separator";
import { Switch } from "../../ui/switch";

const MAX_IMAGES = 2;
const RESIZED_IMAGE_TYPE = "image/webp";
const RESIZED_IMAGE_QUALITY = 0.82;
const supportedAdvertisementInputTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface AdvertisementFormImage {
  created_at?: string | null;
  id: string;
  image_name: string;
  image_order: number;
  src: string | null;
  updated_at?: string | null;
}

interface AdvertisementDeleteResult {
  cleanupWarning?: string;
  deletedId: string;
  fileName: string | null;
}

type AdvertisementUploadQueueStatus =
  | "pending-resize"
  | "resizing"
  | "pending-upload"
  | "uploading"
  | "uploaded"
  | "failed";
type AdvertisementBulkDeleteQueueStatus =
  | "pending"
  | "deleting"
  | "deleted"
  | "failed";

interface DraftPreview {
  file: File;
  src: string;
}

interface AdvertisementUploadQueueItem {
  error?: string;
  file: File;
  id: string;
  previewSrc: string;
  resized?: File;
  status: AdvertisementUploadQueueStatus;
}

interface AdvertisementBulkDeleteQueueItem {
  error?: string;
  id: string;
  image: AdvertisementFormImage;
  status: AdvertisementBulkDeleteQueueStatus;
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function outputFileName(fileName: string): string {
  const baseName =
    fileName.replace(/\.[^.]+$/, "").trim() || "advertisement-image";
  return `${baseName}.webp`;
}

function fallbackQueueIdSuffix(): string {
  const cryptoProvider = globalThis.crypto;
  const getRandomValues = cryptoProvider?.getRandomValues;

  if (typeof getRandomValues === "function") {
    const values = new Uint32Array(4);
    getRandomValues.call(cryptoProvider, values);
    return Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function uploadQueueIdSuffix(): string {
  const cryptoProvider = globalThis.crypto;
  const randomUUID = cryptoProvider?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(cryptoProvider);
  }

  return fallbackQueueIdSuffix();
}

function shortImageName(imageName: string | null): string {
  if (!imageName) return "-";
  if (imageName.length <= 32) return imageName;
  return `${imageName.slice(0, 29)}...`;
}

function uploadQueueStatusLabel(
  status: AdvertisementUploadQueueStatus,
): string {
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

function bulkDeleteStatusLabel(
  status: AdvertisementBulkDeleteQueueStatus,
): string {
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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot read advertisement image"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Cannot resize advertisement image"));
      },
      RESIZED_IMAGE_TYPE,
      RESIZED_IMAGE_QUALITY,
    );
  });
}

async function resizeAdvertisementImageFile(file: File): Promise<File> {
  if (
    file.type === "image/gif" ||
    !supportedAdvertisementInputTypes.has(file.type)
  ) {
    throw new Error("Unsupported image type");
  }

  const image = await loadImage(file);
  const size = resizeToMax(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot resize advertisement image");

  context.drawImage(image, 0, 0, size.width, size.height);

  const blob = await canvasToBlob(canvas);
  return new File([blob], outputFileName(file.name), {
    lastModified: Date.now(),
    type: RESIZED_IMAGE_TYPE,
  });
}

function FailedAdvertisementUploadCard({
  disabled,
  item,
  onRemove,
  onRetry,
}: {
  disabled: boolean;
  item: AdvertisementUploadQueueItem;
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
        <p className="text-[10px] font-medium text-destructive">
          ยังไม่ถูกบันทึก
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {item.error ?? uploadQueueStatusLabel(item.status)}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          ขนาดเดิม {formatFileSize(item.file.size)}
        </p>
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

export function AdvertisementForm({
  action,
  deleteAction,
  defaultIsActive = true,
  defaultTitle = "",
  existingImages = [],
  mode,
  uploadAction,
}: {
  action: (formData: FormData) => void | Promise<void>;
  deleteAction?: (imageId: string) => Promise<AdvertisementDeleteResult>;
  defaultIsActive?: boolean;
  defaultTitle?: string;
  existingImages?: AdvertisementFormImage[];
  mode: "create" | "edit";
  uploadAction?: (formData: FormData) => Promise<{ uploadedCount: number }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const activeId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<DraftPreview[]>([]);
  const queuePreviewsRef = useRef<string[]>([]);
  const resizeRunRef = useRef(0);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isResizingImages, setIsResizingImages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [previews, setPreviews] = useState<DraftPreview[]>([]);
  const [uploadQueue, setUploadQueue] = useState<
    AdvertisementUploadQueueItem[]
  >([]);
  const [bulkDeleteQueue, setBulkDeleteQueue] = useState<
    AdvertisementBulkDeleteQueueItem[]
  >([]);
  const [selectedBulkDeleteIds, setSelectedBulkDeleteIds] = useState<
    Set<string>
  >(new Set());
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [singleDeleteImage, setSingleDeleteImage] =
    useState<AdvertisementFormImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usesOperationImages =
    mode === "edit" && Boolean(uploadAction && deleteAction);
  const visibleExistingImages = usesOperationImages
    ? existingImages
    : existingImages.filter((image) => !deletedImageIds.includes(image.id));
  const failedUploadItems = uploadQueue.filter(
    (item) => item.status === "failed",
  );
  const failedBulkDeleteItems = bulkDeleteQueue.filter(
    (item) => item.status === "failed",
  );
  const totalImages =
    visibleExistingImages.length + (usesOperationImages ? 0 : previews.length);
  const remainingSlots = Math.max(0, MAX_IMAGES - totalImages);
  const isBusy =
    isPending ||
    isResizingImages ||
    isUploading ||
    isDeleting ||
    isBulkDeleting;
  const canDeleteExistingImages = visibleExistingImages.length > 0;
  const selectedBulkDeleteImages = visibleExistingImages.filter((image) =>
    selectedBulkDeleteIds.has(image.id),
  );
  const allCurrentImagesSelected =
    visibleExistingImages.length > 0 &&
    selectedBulkDeleteIds.size === visibleExistingImages.length;

  useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview.src);
      }
      for (const src of queuePreviewsRef.current) {
        URL.revokeObjectURL(src);
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
    setError(null);
  }

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === "file"
    )
      return;
    markDirty();
  }

  async function resizeSelectedFiles(selected: File[], runId: number) {
    setIsResizingImages(true);

    try {
      const resizedFiles = await Promise.all(
        selected.map(resizeAdvertisementImageFile),
      );
      if (resizeRunRef.current !== runId) return;
      appendPreviews(resizedFiles, true);
    } catch {
      if (resizeRunRef.current !== runId) return;
      syncInputFiles(previewsRef.current.map((preview) => preview.file));
      setError("ปรับขนาดรูปภาพไม่ได้ กรุณาเลือกรูปใหม่");
    } finally {
      if (resizeRunRef.current === runId) setIsResizingImages(false);
    }
  }

  function queueItemsForFiles(files: File[]) {
    const items = files.map((file) => {
      const previewSrc = URL.createObjectURL(file);
      queuePreviewsRef.current.push(previewSrc);
      return {
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${uploadQueueIdSuffix()}`,
        previewSrc,
        status: "pending-resize" as const,
      };
    });

    setUploadQueue((existing) => [...existing, ...items]);
    return items;
  }

  function updateUploadQueueItem(
    id: string,
    updates: Partial<AdvertisementUploadQueueItem>,
  ) {
    setUploadQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removeUploadQueueItem(id: string) {
    setUploadQueue((items) => {
      const removed = items.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewSrc);
        queuePreviewsRef.current = queuePreviewsRef.current.filter(
          (src) => src !== removed.previewSrc,
        );
      }
      return items.filter((item) => item.id !== id);
    });
  }

  function clearFailedUploads() {
    const failedIds = new Set(failedUploadItems.map((item) => item.id));
    setUploadQueue((items) => {
      for (const item of items) {
        if (failedIds.has(item.id)) {
          URL.revokeObjectURL(item.previewSrc);
          queuePreviewsRef.current = queuePreviewsRef.current.filter(
            (src) => src !== item.previewSrc,
          );
        }
      }
      return items.filter((item) => !failedIds.has(item.id));
    });
  }

  function updateUploadProgressToast(
    uploadToastId: string | number,
    item: AdvertisementUploadQueueItem,
    current: number,
    total: number,
    status: AdvertisementUploadQueueStatus,
  ) {
    const label = status === "resizing" ? "กำลังเตรียมรูป" : "กำลังอัปโหลด";
    toast.loading(`${label} ${current}/${total}`, {
      description: item.file.name,
      id: uploadToastId,
    });
  }

  async function processUploadQueueItem(
    item: AdvertisementUploadQueueItem,
    onStatusChange?: (status: AdvertisementUploadQueueStatus) => void,
  ) {
    if (!uploadAction) return;

    try {
      onStatusChange?.("resizing");
      updateUploadQueueItem(item.id, { error: undefined, status: "resizing" });
      const resized = await resizeAdvertisementImageFile(item.file);
      updateUploadQueueItem(item.id, { resized, status: "pending-upload" });

      const formData = new FormData();
      formData.append("images", resized);

      onStatusChange?.("uploading");
      updateUploadQueueItem(item.id, { status: "uploading" });
      await uploadAction(formData);
      updateUploadQueueItem(item.id, { resized, status: "uploaded" });
      removeUploadQueueItem(item.id);
    } catch (uploadError) {
      updateUploadQueueItem(item.id, {
        error:
          uploadError instanceof Error
            ? uploadError.message
            : "อัปโหลดรูปไม่สำเร็จ",
        status: "failed",
      });
      throw uploadError;
    }
  }

  function processUploadItems(items: AdvertisementUploadQueueItem[]) {
    if (items.length === 0) return;

    const uploadToastId = toast.loading(`กำลังเตรียมรูป 1/${items.length}`, {
      description: items[0]?.file.name,
    });
    setIsUploading(true);

    startTransition(() => {
      void (async () => {
        let failedCount = 0;
        try {
          for (const [index, item] of items.entries()) {
            try {
              await processUploadQueueItem(item, (status) =>
                updateUploadProgressToast(
                  uploadToastId,
                  item,
                  index + 1,
                  items.length,
                  status,
                ),
              );
            } catch {
              failedCount += 1;
            }
          }

          toast.dismiss(uploadToastId);
          if (failedCount > 0) {
            toast.warning(
              `อัปโหลดสำเร็จ ${items.length - failedCount}/${items.length} รูป มีรูปไม่สำเร็จ ${failedCount} รูป`,
            );
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

  function uploadSelectedFiles(files: File[]) {
    if (files.length === 0) return;
    if (!uploadAction) return;
    if (remainingSlots <= 0) {
      toast.warning("โฆษณารองรับสูงสุด 2 รูป");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (filesToUpload.length < files.length) {
      toast.warning(`เลือกได้อีก ${remainingSlots} รูปสำหรับโฆษณานี้`);
    }
    const items = queueItemsForFiles(filesToUpload);
    processUploadItems(items);
  }

  function retryFailedUploads(itemIds?: string[]) {
    const retryIds = itemIds ? new Set(itemIds) : null;
    const failedItems = uploadQueue.filter(
      (item) =>
        item.status === "failed" &&
        (retryIds === null || retryIds.has(item.id)),
    );
    if (failedItems.length === 0) return;

    const retryItems = failedItems.map((item) => ({
      ...item,
      error: undefined,
      status: "pending-resize" as const,
    }));

    setUploadQueue((items) =>
      items.map(
        (item) =>
          retryItems.find((candidate) => candidate.id === item.id) ?? item,
      ),
    );
    processUploadItems(retryItems);
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);

    if (usesOperationImages) {
      uploadSelectedFiles(selected);
      return;
    }

    markDirty();
    resizeRunRef.current += 1;
    void resizeSelectedFiles(selected, resizeRunRef.current);
  }

  function removeDraftFile(indexToRemove: number) {
    markDirty();
    replacePreviews(
      previewsRef.current
        .filter((_, index) => index !== indexToRemove)
        .map((preview) => preview.file),
      true,
    );
  }

  function markImageDeleted(imageId: string) {
    if (usesOperationImages) return;
    markDirty();
    setDeletedImageIds((imageIds) =>
      imageIds.includes(imageId) ? imageIds : [...imageIds, imageId],
    );
  }

  function resetDraft() {
    resizeRunRef.current += 1;
    formRef.current?.reset();
    replacePreviews([], true);
    setDeletedImageIds([]);
    setError(null);
    setIsResizingImages(false);
    setIsDirty(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (isBusy) {
      event.preventDefault();
      setError("กรุณารอให้การทำงานปัจจุบันเสร็จก่อน");
      return;
    }

    if (isResizingImages) {
      event.preventDefault();
      setError("กรุณารอให้ระบบปรับขนาดรูปภาพให้เสร็จก่อน");
      return;
    }

    if (totalImages > MAX_IMAGES) {
      event.preventDefault();
      setError(`โฆษณารองรับสูงสุด ${MAX_IMAGES} รูป`);
    }
  }

  function clearBulkDeleteSelection() {
    setSelectedBulkDeleteIds(new Set());
    setBulkDeleteQueue([]);
    setIsBulkDeleteDialogOpen(false);
    setIsBulkDeleteMode(false);
  }

  function toggleBulkDeleteSelection(imageId: string) {
    setSelectedBulkDeleteIds((imageIds) => {
      const next = new Set(imageIds);
      if (next.has(imageId)) {
        next.delete(imageId);
        return next;
      }

      next.add(imageId);
      return next;
    });
  }

  function toggleSelectAllImages(checked: boolean) {
    setSelectedBulkDeleteIds(
      checked
        ? new Set(visibleExistingImages.map((image) => image.id))
        : new Set(),
    );
  }

  function queueItemsForBulkDelete(images: AdvertisementFormImage[]) {
    const items = images.map((image) => ({
      id: image.id,
      image,
      status: "pending" as const,
    }));

    setBulkDeleteQueue(items);
    return items;
  }

  function openBulkDeleteDialog() {
    if (selectedBulkDeleteImages.length === 0) return;
    queueItemsForBulkDelete(selectedBulkDeleteImages);
    setIsBulkDeleteDialogOpen(true);
  }

  function updateBulkDeleteQueueItem(
    id: string,
    updates: Partial<AdvertisementBulkDeleteQueueItem>,
  ) {
    setBulkDeleteQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function updateBulkDeleteProgressToast(
    deleteToastId: string | number,
    item: AdvertisementBulkDeleteQueueItem,
    current: number,
    total: number,
  ) {
    toast.loading(`กำลังลบ ${current}/${total}`, {
      description: shortImageName(item.image.image_name),
      id: deleteToastId,
    });
  }

  async function processBulkDeleteQueueItem(
    item: AdvertisementBulkDeleteQueueItem,
  ) {
    if (!deleteAction) return;

    try {
      updateBulkDeleteQueueItem(item.id, {
        error: undefined,
        status: "deleting",
      });
      const result = await deleteAction(item.image.id);
      updateBulkDeleteQueueItem(item.id, {
        error: result.cleanupWarning
          ? "ลบรายการแล้ว แต่ลบไฟล์ใน storage ไม่ครบ"
          : undefined,
        status: "deleted",
      });
    } catch (deleteError) {
      updateBulkDeleteQueueItem(item.id, {
        error:
          deleteError instanceof Error ? deleteError.message : "ลบรูปไม่สำเร็จ",
        status: "failed",
      });
      throw deleteError;
    }
  }

  function processBulkDeleteItems(items: AdvertisementBulkDeleteQueueItem[]) {
    if (items.length === 0) return;

    const deleteToastId = toast.loading(`กำลังลบ 1/${items.length}`, {
      description: "รูปโฆษณา",
    });
    setIsBulkDeleting(true);

    startTransition(() => {
      void (async () => {
        let failedCount = 0;
        let successCount = 0;

        try {
          for (const [index, item] of items.entries()) {
            updateBulkDeleteProgressToast(
              deleteToastId,
              item,
              index + 1,
              items.length,
            );
            try {
              await processBulkDeleteQueueItem(item);
              successCount += 1;
            } catch {
              failedCount += 1;
            }
          }

          toast.dismiss(deleteToastId);
          if (failedCount > 0) {
            toast.warning(
              `ลบสำเร็จ ${successCount} รูป, ลบไม่สำเร็จ ${failedCount} รูป`,
            );
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

  function confirmBulkDelete() {
    const pendingItems =
      bulkDeleteQueue.length > 0
        ? bulkDeleteQueue.filter((item) => item.status === "pending")
        : queueItemsForBulkDelete(selectedBulkDeleteImages);
    processBulkDeleteItems(pendingItems);
  }

  function retryFailedBulkDeletes(itemIds?: string[]) {
    const retryIds = itemIds ? new Set(itemIds) : null;
    const failedItems = bulkDeleteQueue.filter(
      (item) =>
        item.status === "failed" &&
        (retryIds === null || retryIds.has(item.id)),
    );
    if (failedItems.length === 0) return;

    const retryItems = failedItems.map((item) => ({
      ...item,
      error: undefined,
      status: "pending" as const,
    }));

    setBulkDeleteQueue((items) =>
      items.map(
        (item) =>
          retryItems.find((candidate) => candidate.id === item.id) ?? item,
      ),
    );
    processBulkDeleteItems(retryItems);
  }

  function confirmSingleDelete() {
    if (!singleDeleteImage || !deleteAction) return;

    const image = singleDeleteImage;
    setSingleDeleteImage(null);
    setIsDeleting(true);
    const deleteToastId = toast.loading("กำลังลบรูปโฆษณา", {
      description: shortImageName(image.image_name),
    });

    startTransition(() => {
      void (async () => {
        try {
          const result = await deleteAction(image.id);
          toast.dismiss(deleteToastId);
          if (result.cleanupWarning) {
            toast.warning("ลบรายการรูปแล้ว แต่ลบไฟล์ใน storage ไม่ครบ");
          } else {
            toast.success("ลบรูปโฆษณาแล้ว");
          }
          router.refresh();
        } catch (deleteError) {
          toast.dismiss(deleteToastId);
          toast.error(
            deleteError instanceof Error
              ? deleteError.message
              : "ลบรูปโฆษณาไม่สำเร็จ",
          );
        } finally {
          setIsDeleting(false);
        }
      })();
    });
  }

  return (
    <form
      action={action}
      className="grid min-w-0 gap-5 pb-20 lg:pb-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]"
      onChange={onFormChange}
      onSubmit={onSubmit}
      ref={formRef}
    >
      {!usesOperationImages
        ? deletedImageIds.map((imageId) => (
            <input
              key={imageId}
              name="deleted_image_ids"
              type="hidden"
              value={imageId}
            />
          ))
        : null}
      <Card className="min-w-0 h-fit lg:order-2">
        <CardHeader>
          <CardTitle>ตั้งค่าโฆษณา</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor={titleId}>ชื่อแคมเปญโฆษณา</Label>
            <Input
              className="h-10"
              defaultValue={defaultTitle}
              id={titleId}
              name="title"
              required
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor={activeId}>สถานะการแสดงผล</Label>
              <p className="text-sm text-muted-foreground">
                เปิดเพื่อให้ผู้ใช้เห็นโฆษณานี้
              </p>
            </div>
            <input name="is_active" type="hidden" value="false" />
            <Switch
              defaultChecked={defaultIsActive}
              id={activeId}
              name="is_active"
              value="true"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 bg-muted/20">
            <div className="flex gap-2 lg:w-auto">
              <Button
                className="flex-1 lg:flex-none"
                disabled={!isDirty || isBusy}
                onClick={resetDraft}
                type="button"
                variant="outline"
              >
                <XIcon data-icon="inline-start" />
                ยกเลิก
              </Button>
              <Button
                className="flex-1 lg:flex-none"
                disabled={!isDirty || isBusy}
                type="submit"
              >
                {mode === "create" ? (
                  <UploadIcon data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                {isBusy
                  ? "กำลังทำงาน..."
                  : mode === "create"
                    ? "สร้างโฆษณา"
                    : "บันทึกการเปลี่ยนแปลง"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 overflow-hidden min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] rounded-xl border bg-background lg:order-1">
        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ImageIcon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <h2
                  className="truncate text-base font-semibold"
                  title="รูปภาพโฆษณา"
                >
                  รูปภาพโฆษณา
                </h2>
                <p className="text-xs text-muted-foreground">
                  {totalImages} รูป
                </p>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              {isBulkDeleteMode ? (
                <>
                  <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium">
                    <input
                      aria-label="เลือกทั้งหมด"
                      checked={allCurrentImagesSelected}
                      className="size-4 accent-primary"
                      disabled={visibleExistingImages.length === 0 || isBusy}
                      onChange={(event) =>
                        toggleSelectAllImages(event.currentTarget.checked)
                      }
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
                  <Button
                    disabled={isBusy}
                    onClick={clearBulkDeleteSelection}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    ยกเลิก
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    disabled={
                      !usesOperationImages || !canDeleteExistingImages || isBusy
                    }
                    onClick={() => setIsBulkDeleteMode(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    เลือกลบ
                  </Button>
                  <Label
                    aria-disabled={isBusy || remainingSlots === 0}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer text-foreground",
                      (isBusy || remainingSlots === 0) &&
                        "pointer-events-none opacity-50",
                    )}
                    htmlFor="advertisement-images-upload"
                  >
                    {isBusy ? (
                      <Loader2Icon
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <UploadCloudIcon data-icon="inline-start" />
                    )}
                    {isBusy ? "กำลังอัปโหลด" : "อัปโหลดรูป"}
                  </Label>
                  <input
                    accept="image/avif,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isBusy || remainingSlots === 0}
                    id="advertisement-images-upload"
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
              {error ? (
                <Alert className="mx-3 mt-3" variant="destructive">
                  <AlertTitle>บันทึกไม่ได้</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
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
                    <Button
                      disabled={isBusy}
                      onClick={clearFailedUploads}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      เอาออกทั้งหมด
                    </Button>
                  </div>
                </section>
              ) : null}
              {visibleExistingImages.length === 0 &&
              previews.length === 0 &&
              failedUploadItems.length === 0 ? (
                <div className="m-3 flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ImageIcon aria-hidden className="size-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium">ยังไม่มีรูปโฆษณา</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    อัปโหลดรูปเพื่อเพิ่มในโฆษณานี้
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-center gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
                {visibleExistingImages.map((image, index) => {
                  const selected = selectedBulkDeleteIds.has(image.id);
                  const action = usesOperationImages ? (
                    isBulkDeleteMode ? (
                      <div
                        aria-hidden
                        className={cn(
                          "flex size-7 cursor-pointer items-center justify-center rounded-md border bg-background/95 shadow-sm",
                          selected &&
                            "border-primary bg-primary text-primary-foreground",
                        )}
                        title="เลือกรูปนี้"
                      >
                        {selected ? (
                          <CheckIcon aria-hidden className="size-4" />
                        ) : null}
                      </div>
                    ) : (
                      <Button
                        className="size-7 bg-background/90"
                        disabled={isBusy}
                        onClick={() => setSingleDeleteImage(image)}
                        size="icon"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        <span className="sr-only">ลบรูป</span>
                      </Button>
                    )
                  ) : (
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
                  );

                  return (
                    <AdminImageCard
                      action={action}
                      alt={image.image_name}
                      imageName={image.image_name}
                      key={image.id}
                      loading={index === 0 ? "eager" : "lazy"}
                      onSelect={
                        isBulkDeleteMode && usesOperationImages
                          ? () => toggleBulkDeleteSelection(image.id)
                          : undefined
                      }
                      orderLabel={`# ${index + 1}`}
                      previewDescription="ดูตัวอย่างรูปขนาดใหญ่"
                      previewEnabled={!isBulkDeleteMode}
                      previewLabel={`เปิดตัวอย่างรูปขนาดใหญ่ ${image.image_name}`}
                      selected={selected}
                      selectionLabel={`เลือกรูป ${image.image_name}`}
                      src={image.src}
                    />
                  );
                })}

                {previews.map((preview, index) => (
                  <AdminImageCard
                    action={
                      <Button
                        className="size-7 bg-background/90"
                        onClick={() => removeDraftFile(index)}
                        size="icon"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        <span className="sr-only">ลบรูป</span>
                      </Button>
                    }
                    alt={preview.file.name}
                    imageName={preview.file.name}
                    key={`${preview.file.name}-${preview.file.size}-${index}`}
                    metaRows={[
                      {
                        label: "ขนาด",
                        value: formatFileSize(preview.file.size),
                      },
                    ]}
                    orderLabel={`# ${visibleExistingImages.length + index + 1}`}
                    previewDescription="ดูตัวอย่างรูปขนาดใหญ่"
                    previewLabel={`เปิดตัวอย่างรูปขนาดใหญ่ ${preview.file.name}`}
                    src={preview.src}
                  />
                ))}

                {failedUploadItems.map((item) => (
                  <FailedAdvertisementUploadCard
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

      <Dialog
        open={singleDeleteImage !== null}
        onOpenChange={(open) => !open && setSingleDeleteImage(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูปโฆษณา</DialogTitle>
            <DialogDescription>
              ตรวจสอบรูปก่อนยืนยันการลบ รูปที่ลบแล้วจะถูกนำออกจากโฆษณานี้
            </DialogDescription>
          </DialogHeader>
          {singleDeleteImage ? (
            <div className="grid gap-3">
              <div className="overflow-hidden rounded-md bg-muted">
                {singleDeleteImage.src ? (
                  <img
                    alt={singleDeleteImage.image_name}
                    className="max-h-80 w-full object-contain"
                    src={singleDeleteImage.src}
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                    แสดงรูปไม่ได้
                  </div>
                )}
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {singleDeleteImage.image_name}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button
              disabled={isBusy}
              onClick={confirmSingleDelete}
              type="button"
              variant="destructive"
            >
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
            <DialogTitle>ยืนยันลบรูปโฆษณาที่เลือก</DialogTitle>
            <DialogDescription>
              ลบรูปโฆษณาที่เลือกจำนวน {bulkDeleteQueue.length} รูป
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {bulkDeleteQueue.map((item) => {
                const image = item.image;
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
                            <Loader2Icon
                              aria-hidden
                              className="size-4 animate-spin"
                            />
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
                      alt={image.image_name}
                      className="max-w-none"
                      imageName={shortImageName(image.image_name)}
                      imageUnavailableText="แสดงรูปไม่ได้"
                      metaRows={[
                        {
                          label: "สถานะ",
                          value: (
                            <span className={statusClassName}>
                              {statusLabel}
                            </span>
                          ),
                        },
                        ...(item.error
                          ? [{ label: "สาเหตุ", value: item.error }]
                          : []),
                      ]}
                      previewDescription="ดูรูปก่อนยืนยันลบ"
                      previewEnabled={!isBulkDeleting}
                      previewLabel={`เปิดดูรูป ${image.image_name}`}
                      src={image.src}
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
            {failedBulkDeleteItems.length > 0 && !isBulkDeleting ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                มีรูปที่ลบไม่สำเร็จ {failedBulkDeleteItems.length} รูป
                สามารถลองใหม่เฉพาะรายการที่ fail ได้
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={isBulkDeleting} type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            {failedBulkDeleteItems.length > 0 && !isBulkDeleting ? (
              <Button
                onClick={() => retryFailedBulkDeletes()}
                type="button"
                variant="outline"
              >
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
    </form>
  );
}
