import Image from "next/image";

import { buildAwsImageUrl } from "../../../lib/aws-image-url";
import type { ImageZoneGroup } from "../../../server/services/images";
import { AspectRatio } from "../../ui/aspect-ratio";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../ui/empty";
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";

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

export function ImageZoneViewer({ groups }: { groups: ImageZoneGroup[] }) {
  if (groups.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>บ้านนี้ยังไม่มีรูป</EmptyTitle>
          <EmptyDescription>MVP นี้เป็นโหมดอ่านอย่างเดียว</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">หมวดรูป</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <div className="flex gap-2 lg:flex-col">
              {groups.map((group, index) => (
                <a
                  className="block shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted lg:w-full"
                  href={`#zone-${index}`}
                  key={group.zone}
                >
                  <span className="block font-medium">{group.zone}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.images.length} รูป / #{group.minMove}-{group.maxMove}
                  </span>
                </a>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        {groups.map((group, index) => (
          <div id={`zone-${index}`} key={group.zone}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{group.zone}</h2>
              <Badge variant="secondary">{group.images.length} รูป</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.images.map((image) => {
                const src = displayUrl(image.image_name);

                return (
                  <Card key={image.id}>
                    <CardContent className="p-3">
                      <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-md bg-muted">
                        {src ? (
                          <Image
                            alt={image.image_name ?? "house image"}
                            className="object-cover"
                            fill
                            sizes="(min-width: 1280px) 280px, (min-width: 640px) 45vw, 100vw"
                            src={src}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            แสดงรูปไม่ได้
                          </div>
                        )}
                      </AspectRatio>
                      <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                        <p className="font-mono text-foreground">{image.image_name ?? "-"}</p>
                        <p>image_move: {image.image_move ?? "-"}</p>
                        <p>created_at: {image.created_at ?? "-"}</p>
                        <p>updated_at: {image.updated_at ?? "-"}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
