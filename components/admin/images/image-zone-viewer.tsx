import {
  ArmchairIcon,
  BathIcon,
  BedDoubleIcon,
  CarFrontIcon,
  CookingPotIcon,
  DoorClosedIcon,
  ImageIcon,
  MessageCircleCodeIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import { cn } from "../../../lib/utils";
import {
  formatImageMoveLabel,
  formatThaiImageDateTime,
  getImageZoneMeta,
  getSelectedImageZoneGroup,
  type HouseImageItem,
  type ImageZoneIconName,
  type ImageZoneGroup,
} from "../../../server/services/images";
import { AspectRatio } from "../../ui/aspect-ratio";
import { Badge } from "../../ui/badge";
import { Card, CardContent } from "../../ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../ui/empty";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";
import { ImagePreviewDialog } from "./image-preview-dialog";

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

function displayUrl(imageName: string | null): string | null {
  if (!imageName) {
    return null;
  }

  try {
    return buildAwsImageUrl(imageName);
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
  return `${formatImageMoveLabel(group.minMove)} - ${formatImageMoveLabel(group.maxMove)}`;
}

function ZoneIcon({ icon }: { icon: ImageZoneIconName }) {
  const Icon = zoneIconByName[icon];

  return <Icon aria-hidden />;
}

function ImageCard({
  image,
  priority = false,
  zone,
}: {
  image: HouseImageItem;
  priority?: boolean;
  zone: string;
}) {
  const src = displayUrl(image.image_name);
  const zoneMeta = getImageZoneMeta(zone);

  return (
    <Card className="relative w-full max-w-36 cursor-zoom-in gap-0 overflow-hidden p-0 sm:max-w-40" size="sm">
      <div className="relative">
        <AspectRatio ratio={4 / 3} className="bg-muted">
          {src ? (
            <Image
              alt={image.image_name ?? "house image"}
              className="object-cover"
              fill
              priority={priority}
              sizes="(min-width: 640px) 160px, 144px"
              src={src}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              แสดงรูปไม่ได้
            </div>
          )}
        </AspectRatio>
        <Badge className="absolute left-1 top-1 rounded-md px-1.5 py-0 font-mono text-[10px]" variant="secondary">
          {formatImageMoveLabel(image.image_move)}
        </Badge>
        <Badge
          className="absolute right-1 top-1 max-w-[calc(100%-3.5rem)] truncate rounded-md px-1.5 py-0 text-[10px]"
          title={zone}
        >
          {zoneMeta.label}
        </Badge>
      </div>
      <CardContent className="flex flex-col gap-1 p-2">
        <p className="truncate font-mono text-[11px] font-medium leading-tight" title={image.image_name ?? undefined}>
          {image.image_name ?? "-"}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-1 gap-y-0.5 text-[10px] leading-tight text-muted-foreground">
          <dt>สร้าง</dt>
          <dd className="truncate text-foreground">{formatThaiImageDateTime(image.created_at)}</dd>
          <dt>อัปเดต</dt>
          <dd className="truncate text-foreground">{formatThaiImageDateTime(image.updated_at)}</dd>
        </dl>
      </CardContent>
      {src ? (
        <ImagePreviewDialog
          alt={image.image_name ?? "house image"}
          imageName={image.image_name ?? "-"}
          src={src}
        />
      ) : null}
    </Card>
  );
}

export function ImageZoneViewer({
  groups,
  propertyId,
  returnTo,
  selectedZone,
}: {
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  selectedZone?: string;
}) {
  const selectedGroup = getSelectedImageZoneGroup(groups, selectedZone);

  if (!selectedGroup) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>บ้านนี้ยังไม่มีรูป</EmptyTitle>
          <EmptyDescription>MVP นี้เป็นโหมดอ่านอย่างเดียว</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const selectedMeta = getImageZoneMeta(selectedGroup.zone);

  return (
    <div className="grid min-w-0 overflow-hidden rounded-xl border bg-background lg:grid-cols-[220px_1fr]">
      <aside className="min-w-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Zones</h2>
        </div>
        <ScrollArea className="w-full min-w-0">
          <nav
            className="flex w-max min-w-full gap-2 p-3 lg:w-auto lg:min-w-0 lg:flex-col"
            aria-label="Image zones"
          >
            {groups.map((group) => {
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
                        Order {orderRangeLabel(group)}
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
        <header className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ZoneIcon icon={selectedMeta.icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold" title={selectedGroup.zone}>
                {selectedMeta.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedGroup.images.length} รูป · Global Order: {orderRangeLabel(selectedGroup)}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{selectedGroup.images.length} รูป</Badge>
        </header>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-start gap-2 p-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
          {selectedGroup.images.map((image, index) => (
            <ImageCard
              image={image}
              key={image.id}
              priority={index === 0}
              zone={selectedGroup.zone}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
