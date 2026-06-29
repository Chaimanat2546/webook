"use client";

import {
  ImageIcon,
  SaveIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";

import { resizeToMax } from "../../../lib/advertisement-image-resize";
import { formatThaiImageDateTime } from "../../../server/services/images";
import { AdminImageCard } from "../image-asset-card";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { AspectRatio } from "../../ui/aspect-ratio";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Separator } from "../../ui/separator";
import { Switch } from "../../ui/switch";

const MAX_IMAGES = 2;
const RESIZED_IMAGE_TYPE = "image/webp";
const RESIZED_IMAGE_QUALITY = 0.9;

export interface AdvertisementFormImage {
  created_at?: string | null;
  id: string;
  image_name: string;
  image_order: number;
  src: string | null;
  updated_at?: string | null;
}

interface DraftPreview {
  file: File;
  src: string;
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function imageExtension(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "webp";
}

function fileNameWithExtension(name: string, extension: string): string {
  const extensionIndex = name.lastIndexOf(".");
  const basename = extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
  return `${basename}.${extension}`;
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
  const image = await loadImage(file);
  const size = resizeToMax(image.naturalWidth, image.naturalHeight);

  if (size.width === image.naturalWidth && size.height === image.naturalHeight) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot resize advertisement image");

  context.drawImage(image, 0, 0, size.width, size.height);

  const blob = await canvasToBlob(canvas);
  const type = blob.type || RESIZED_IMAGE_TYPE;
  const name = fileNameWithExtension(file.name, imageExtension(type));
  return new File([blob], name, { type, lastModified: file.lastModified });
}

function EmptySlot({ imageOrder }: { imageOrder: number }) {
  return (
    <Card className="relative w-full max-w-36 gap-0 overflow-hidden border-dashed p-0 sm:max-w-40" size="sm">
      <AspectRatio className="bg-muted/20" ratio={4 / 3}>
        <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
          <ImageIcon className="mb-2 size-6 opacity-50" />
          <span>สล๊อตที่ {imageOrder} (ว่าง)</span>
        </div>
      </AspectRatio>
      <CardContent className="min-h-16 p-2" />
    </Card>
  );
}

export function AdvertisementForm({
  action,
  defaultIsActive = true,
  defaultTitle = "",
  existingImages = [],
  mode,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultIsActive?: boolean;
  defaultTitle?: string;
  existingImages?: AdvertisementFormImage[];
  mode: "create" | "edit";
}) {
  const titleId = useId();
  const activeId = useId();
  const imagesId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<DraftPreview[]>([]);
  const resizeRunRef = useRef(0);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isResizingImages, setIsResizingImages] = useState(false);
  const [previews, setPreviews] = useState<DraftPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const visibleExistingImages = existingImages.filter((image) => !deletedImageIds.includes(image.id));
  const totalImages = visibleExistingImages.length + previews.length;
  const remainingSlots = Math.max(0, MAX_IMAGES - totalImages);
  const emptySlots = Array.from({ length: Math.max(0, remainingSlots) }, (_, index) => totalImages + index + 1);

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
    setError(null);
  }

  async function resizeSelectedFiles(selected: File[], runId: number) {
    setIsResizingImages(true);

    try {
      const resizedFiles = await Promise.all(selected.map(resizeAdvertisementImageFile));
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

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);

    markDirty();
    resizeRunRef.current += 1;
    void resizeSelectedFiles(selected, resizeRunRef.current);
  }

  function removeDraftFile(indexToRemove: number) {
    markDirty();
    replacePreviews(
      previewsRef.current.filter((_, index) => index !== indexToRemove).map((preview) => preview.file),
      true,
    );
  }

  function markImageDeleted(imageId: string) {
    markDirty();
    setDeletedImageIds((imageIds) => (imageIds.includes(imageId) ? imageIds : [...imageIds, imageId]));
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
    if (isResizingImages) {
      event.preventDefault();
      setError("กรุณารอให้ระบบปรับขนาดรูปภาพให้เสร็จก่อน");
      return;
    }

    if (totalImages < 1) {
      event.preventDefault();
      setError("โฆษณาต้องมีรูปอย่างน้อย 1 รูป");
      return;
    }

    if (totalImages > MAX_IMAGES) {
      event.preventDefault();
      setError(`โฆษณารองรับสูงสุด ${MAX_IMAGES} รูป`);
    }
  }

  return (
    <form
      action={action}
      className="grid min-w-0 gap-5 pb-20 lg:pb-0 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]"
      onChange={markDirty}
      onSubmit={onSubmit}
      ref={formRef}
    >
      {deletedImageIds.map((imageId) => (
        <input key={imageId} name="deleted_image_ids" type="hidden" value={imageId} />
      ))}
      <Card className="min-w-0 h-fit">
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
              <p className="text-sm text-muted-foreground">เปิดเพื่อให้ผู้ใช้เห็นโฆษณานี้</p>
            </div>
            <input name="is_active" type="hidden" value="false" />
            <Switch
              defaultChecked={defaultIsActive}
              id={activeId}
              name="is_active"
              value="true"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 gap-0 p-0">
        <CardHeader className="border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>รูปภาพโฆษณา</CardTitle>
              <p className="text-sm text-muted-foreground">รองรับ 4:3 สูงสุด {MAX_IMAGES} รูป</p>
            </div>
            <Badge className="rounded-full px-3" variant="secondary">
              สล๊อตว่าง: {remainingSlots}/{MAX_IMAGES}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid min-w-0 gap-4 p-4">
          <div className="rounded-lg border border-dashed bg-muted/20">
            <Label
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center"
              htmlFor={imagesId}
            >
              <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UploadCloudIcon className="size-6" />
              </span>
              <span className="font-medium">อัปโหลดรูปภาพใหม่</span>
              <span className="text-sm text-muted-foreground">
                รองรับ AVIF, GIF, JPG, PNG, WEBP ไม่เกิน 10 MB และระบบจะย่อด้านยาวไม่เกิน 1080px ก่อนบันทึก
              </span>
            </Label>
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              id={imagesId}
              multiple
              name="images"
              onChange={onFilesChange}
              ref={inputRef}
              required={mode === "create" && totalImages === 0}
              type="file"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>บันทึกไม่ได้</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-start gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
            {visibleExistingImages.map((image, index) => (
              <AdminImageCard
                action={
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
                }
                actionPlacement="top-right"
                alt={image.image_name}
                imageName={image.image_name}
                key={image.id}
                metaRows={[
                  { label: "สร้าง", value: formatThaiImageDateTime(image.created_at) },
                  { label: "อัปเดต", value: formatThaiImageDateTime(image.updated_at) },
                ]}
                orderLabel={`# ${index + 1}`}
                previewDescription="Advertisement image preview"
                previewLabel={`Open advertisement image preview: ${image.image_name}`}
                src={image.src}
              />
            ))}

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
                actionPlacement="top-right"
                alt={preview.file.name}
                imageName={preview.file.name}
                key={`${preview.file.name}-${preview.file.size}-${index}`}
                metaRows={[{ label: "ขนาด", value: formatFileSize(preview.file.size) }]}
                orderLabel={`# ${visibleExistingImages.length + index + 1}`}
                previewDescription="Advertisement image preview"
                previewLabel={`Open advertisement image preview: ${preview.file.name}`}
                src={preview.src}
              />
            ))}

            {emptySlots.map((slot) => (
              <EmptySlot imageOrder={slot} key={slot} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:col-span-2 lg:mx-0 lg:flex lg:justify-end lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <div className="flex gap-2 lg:w-auto">
          <Button
            className="flex-1 lg:flex-none"
            disabled={!isDirty}
            onClick={resetDraft}
            type="button"
            variant="outline"
          >
            <XIcon data-icon="inline-start" />
            ยกเลิก
          </Button>
          <Button className="flex-1 lg:flex-none" disabled={!isDirty || isResizingImages} type="submit">
            {mode === "create" ? <UploadIcon data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            {isResizingImages
              ? "กำลังปรับขนาดรูป..."
              : mode === "create"
                ? "สร้างโฆษณา"
                : "บันทึกการเปลี่ยนแปลง"}
          </Button>
        </div>
      </div>
    </form>
  );
}
