import Link from "next/link";
import { BedDouble, EllipsisVerticalIcon, ImageIcon, MapPinHouse, PencilLineIcon, Toilet } from "lucide-react";

import {
  formatHouseActiveStatus,
  formatHouseZone,
  type HouseListItem,
} from "../../../server/services/houses";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
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

function facilitiesHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  params.set("section", "facilities");
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

function pricesHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  params.set("section", "prices");
  return `/admin/houses/${encodeURIComponent(propertyId)}?${params}`;
}

function coverSelectHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  params.set("mode", "cover-select");
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

function HouseActionsMenu({
  canManageAccommodation,
  canViewPrices,
  propertyId,
  returnTo,
}: {
  canManageAccommodation: boolean;
  canViewPrices: boolean;
  propertyId: string;
  returnTo: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button aria-label="เปิดเมนูจัดการบ้านพัก" size="icon" type="button" variant="outline">
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          {canManageAccommodation ? (
            <>
              <DropdownMenuItem asChild>
                <Link href={houseHref(propertyId, returnTo)}>
                  <PencilLineIcon aria-hidden />
                  จัดการข้อมูล
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={facilitiesHref(propertyId, returnTo)}>จัดการสิ่งอำนวยความสะดวก</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={imageHref(propertyId, returnTo)}>
                  <ImageIcon aria-hidden />
                  จัดการรูป
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={coverSelectHref(propertyId, returnTo)}>เลือกรูปหน้าปก</Link>
              </DropdownMenuItem>
            </>
          ) : null}
          {canViewPrices ? (
            <DropdownMenuItem asChild>
              <Link href={pricesHref(propertyId, returnTo)}>จัดการราคา</Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HouseList({
  canManageAccommodation,
  canViewPrices,
  houses,
  returnTo,
}: {
  canManageAccommodation: boolean;
  canViewPrices: boolean;
  houses: HouseListItem[];
  returnTo: string;
}) {
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
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-[1fr_1fr_minmax(0,1fr)_auto] gap-2 text-xs text-muted-foreground">
                <dl className="contents">
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
                <div className="flex items-end justify-end self-end">
                  <HouseActionsMenu
                    canManageAccommodation={canManageAccommodation}
                    canViewPrices={canViewPrices}
                    propertyId={house.property_id}
                    returnTo={returnTo}
                  />
                </div>
              </div>
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
                  <HouseActionsMenu
                    canManageAccommodation={canManageAccommodation}
                    canViewPrices={canViewPrices}
                    propertyId={house.property_id}
                    returnTo={returnTo}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
