"use client";

/* eslint-disable @next/next/no-img-element */

import { Fragment, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { AspectRatio } from "../ui/aspect-ratio";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export interface AdminImageCardMetaRow {
  label: string;
  value: ReactNode;
}

export function AdminImageCard({
  action,
  actionPlacement = "bottom-right",
  alt,
  imageName,
  imageUnavailableText = "Preview unavailable",
  loading = "lazy",
  metaRows = [],
  orderLabel,
  previewDescription = "Image preview",
  previewLabel,
  secondaryLabel,
  secondaryTitle,
  src,
}: {
  action?: ReactNode;
  actionPlacement?: "bottom-right" | "top-right";
  alt: string;
  imageName: string;
  imageUnavailableText?: string;
  loading?: "eager" | "lazy";
  metaRows?: AdminImageCardMetaRow[];
  orderLabel: string;
  previewDescription?: string;
  previewLabel?: string;
  secondaryLabel?: string;
  secondaryTitle?: string;
  src: string | null;
}) {
  return (
    <Card className="relative w-full max-w-36 cursor-zoom-in gap-0 overflow-hidden p-0 sm:max-w-40" size="sm">
      <div className="relative">
        <AspectRatio className="bg-muted" ratio={4 / 3}>
          {src ? (
            <img alt={alt} className="h-full w-full object-cover" loading={loading} src={src} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {imageUnavailableText}
            </div>
          )}
        </AspectRatio>
        <Badge className="absolute left-1 top-1 rounded-md px-1.5 py-0 font-mono text-[10px]" variant="secondary">
          {orderLabel}
        </Badge>
        {secondaryLabel ? (
          <Badge
            className="absolute right-1 top-1 max-w-[calc(100%-3.5rem)] truncate rounded-md px-1.5 py-0 text-[10px]"
            title={secondaryTitle ?? secondaryLabel}
          >
            {secondaryLabel}
          </Badge>
        ) : null}
        {action ? (
          <div
            className={cn(
              "absolute right-1 z-20",
              actionPlacement === "top-right" ? "top-1" : "bottom-1",
            )}
          >
            {action}
          </div>
        ) : null}
      </div>

      <CardContent className="flex min-h-16 flex-col gap-1 p-2">
        <p className="truncate font-mono text-[11px] font-medium leading-tight" title={imageName}>
          {imageName}
        </p>
        {metaRows.length > 0 ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-1 gap-y-0.5 text-[10px] leading-tight text-muted-foreground">
            {metaRows.map((row, index) => (
              <Fragment key={`${row.label}-${index}`}>
                <dt>{row.label}</dt>
                <dd className="truncate text-foreground">{row.value}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <div className="min-h-[2lh]" />
        )}
      </CardContent>

      {src ? (
        <Dialog>
          <DialogTrigger asChild>
            <button
              aria-label={previewLabel ?? `Open image preview: ${imageName}`}
              className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              type="button"
            >
              <span className="sr-only">{previewLabel ?? "Open image preview"}</span>
            </button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-0.5rem)] max-w-7xl gap-3 p-3 sm:w-[calc(100vw-2rem)] sm:max-w-7xl sm:p-4">
            <DialogHeader className="min-w-0 pr-8">
              <DialogTitle className="truncate">{imageName}</DialogTitle>
              <DialogDescription>{previewDescription}</DialogDescription>
            </DialogHeader>
            <div className="min-w-0 overflow-hidden rounded-lg bg-muted">
              <img alt={alt} className="h-auto max-h-[82dvh] w-full object-contain" src={src} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
