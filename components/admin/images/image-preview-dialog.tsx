"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";

export function ImagePreviewDialog({
  alt,
  imageName,
  src,
}: {
  alt: string;
  imageName: string;
  src: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          aria-label={`เปิดตัวอย่างรูปขนาดใหญ่ ${imageName}`}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          type="button"
        >
          <span className="sr-only">เปิดตัวอย่างรูปขนาดใหญ่</span>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-0.5rem)] max-w-7xl gap-3 p-3 sm:w-[calc(100vw-2rem)] sm:max-w-7xl sm:p-4">
        <DialogHeader>
          <DialogTitle className="truncate">{imageName}</DialogTitle>
          <DialogDescription>ดูตัวอย่างรูปขนาดใหญ่</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg bg-muted">
          <Image
            alt={alt}
            className="h-auto max-h-[82dvh] w-full object-contain"
            height={1200}
            sizes="(min-width: 1024px) 90vw, 96vw"
            src={src}
            width={1600}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
