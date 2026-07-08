import Link from "next/link";
import { BedDouble, EllipsisVerticalIcon, ImageIcon, MapPinHouse, PencilLineIcon, Toilet } from "lucide-react";

import {
  formatHouseActiveStatus,
  formatHouseZone,
  type HouseListItem,
} from "../../../server/services/houses";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

function StatusBadge({ active }: { active: boolean | null }) {
  return <Badge variant={active ? "default" : "secondary"}>{formatHouseActiveStatus(active)}</Badge>;
}

function houseHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

function imageHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function HouseActionsMenu({ propertyId, returnTo }: { propertyId: string; returnTo: string }) {
  return (
    <details className="group relative inline-block text-left">
      <summary
        aria-label="เปิดเมนูจัดการบ้านพัก"
        className="inline-flex size-8 cursor-pointer list-none items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <EllipsisVerticalIcon aria-hidden className="size-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <Link
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
          href={houseHref(propertyId, returnTo)}
        >
          <PencilLineIcon aria-hidden className="size-4" />
          จัดการข้อมูล
        </Link>
        <Link
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
          href={imageHref(propertyId, returnTo)}
        >
          <ImageIcon aria-hidden className="size-4" />
          จัดการรูป
        </Link>
      </div>
    </details>
  );
}

export function HouseList({ houses, returnTo }: { houses: HouseListItem[]; returnTo: string }) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {houses.map((house) => (
          <Card className={house.is_active ? "" : "opacity-70"} key={house.property_id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{house.title || "-"}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">DV-{house.property_id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge active={house.is_active} />
                <HouseActionsMenu propertyId={house.property_id} returnTo={returnTo} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>ห้องนอน</dt>
                  <dd className="font-medium text-foreground"><BedDouble className="inline-block h-4 w-4 mr-1" />{house.bedrooms ?? "-"}</dd>
                </div>
                <div>
                  <dt>ห้องน้ำ</dt>
                  <dd className="font-medium text-foreground"><Toilet className="inline-block h-4 w-4 mr-1" />{house.bathrooms ?? "-"}</dd>
                </div>
                <div>
                  <dt>โซน</dt>
                  <dd className="font-medium text-foreground">
                    <MapPinHouse className="inline-block h-4 w-4 mr-1" />{formatHouseZone(house.location_zone)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44%]">ชื่อบ้านพัก</TableHead>
              <TableHead className="w-[8%]">ID</TableHead>
              <TableHead className="w-[8%]">ห้องนอน</TableHead>
              <TableHead className="w-[8%]">ห้องน้ำ</TableHead>
              <TableHead className="w-[11%]">ทำเล(zone)</TableHead>
              <TableHead className="w-[10%]">สถานะ</TableHead>
              <TableHead className="w-[11%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {houses.map((house) => (
              <TableRow className={house.is_active ? "" : "opacity-70"} key={house.property_id}>
                <TableCell className="font-medium">
                  <span className="block truncate">{house.title || "-"}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">DV-{house.property_id}</TableCell>
                <TableCell className="text-muted-foreground">{house.bedrooms ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{house.bathrooms ?? "-"}</TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {formatHouseZone(house.location_zone)}
                </TableCell>
                <TableCell>
                  <StatusBadge active={house.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <HouseActionsMenu propertyId={house.property_id} returnTo={returnTo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
