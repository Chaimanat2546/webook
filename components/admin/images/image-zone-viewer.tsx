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

function imageZoneHref(propertyId: string, zone: string): string {
  const params = new URLSearchParams({ zone });
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
    <Card className="gap-0 overflow-hidden p-0" size="sm">
      <div className="relative">
        <AspectRatio ratio={4 / 3} className="bg-muted">
          {src ? (
            <Image
              alt={image.image_name ?? "house image"}
              className="object-cover"
              fill
              priority={priority}
              sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 50vw"
              src={src}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              แสดงรูปไม่ได้
            </div>
          )}
        </AspectRatio>
        <Badge className="absolute left-2 top-2 rounded-md font-mono text-sm" variant="secondary">
          {formatImageMoveLabel(image.image_move)}
        </Badge>
        <Badge
          className="absolute right-2 top-2 max-w-[calc(100%-4.5rem)] truncate rounded-md text-xs"
          title={zone}
        >
          {zoneMeta.label}
        </Badge>
      </div>
      <CardContent className="flex flex-col gap-2 p-3">
        <p className="truncate font-mono text-xs font-medium" title={image.image_name ?? undefined}>
          {image.image_name ?? "-"}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <dt>สร้างเมื่อ</dt>
          <dd className="text-foreground">{formatThaiImageDateTime(image.created_at)}</dd>
          <dt>อัปเดตเมื่อ</dt>
          <dd className="text-foreground">{formatThaiImageDateTime(image.updated_at)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

export function ImageZoneViewer({
  groups,
  propertyId,
  selectedZone,
}: {
  groups: ImageZoneGroup[];
  propertyId: string;
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
                <a
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-36 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted lg:min-w-0",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  href={imageZoneHref(propertyId, group.zone)}
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
                </a>
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

        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
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
