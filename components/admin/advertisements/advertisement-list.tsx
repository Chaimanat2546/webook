/* eslint-disable jsx-a11y/alt-text */
import Link from "next/link";
import { CalendarDays, Image, MapPinHouse, PencilLineIcon } from "lucide-react";

import type { AdvertisementRow } from "../../../server/repositories/advertisements";
import { formatAdvertisementZone } from "../../../server/services/advertisements";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";


function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "default" : "secondary"}>{active ? "ใช้งานอยู่" : "ปิดใช้งาน"}</Badge>;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH");
}

export function AdvertisementList({
  advertisements,
}: {
  advertisements: AdvertisementRow[];
}) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {advertisements.map((advertisement) => (
          <Card className={advertisement.is_active ? "" : "opacity-70"} key={advertisement.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{advertisement.title || "-"}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">ADV-{advertisement.id.slice(0, 8)}</p>
              </div>
              <StatusBadge active={advertisement.is_active} />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>โซน</dt>
                  <dd className="font-medium text-foreground"><MapPinHouse className="inline-block h-4 w-4 mr-1"/>{formatAdvertisementZone(advertisement.zone)}</dd>
                </div>
                <div>
                  <dt>รูปภาพ</dt>
                  <dd className="font-medium text-foreground"><Image className="inline-block h-4 w-4 mr-1"/>{advertisement.advertisement_images?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>อัปเดต</dt>
                  <dd className="font-medium text-foreground"><CalendarDays className="inline-block h-4 w-4 mr-1"/>{formatDate(advertisement.updated_at)}</dd>
                </div>
              </dl>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/admin/advertisements/${encodeURIComponent(advertisement.id)}`}>
                  <PencilLineIcon aria-hidden className="size-4" />
                  จัดการ
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">ชื่อโฆษณา</TableHead>
              <TableHead className="w-[12%]">ID</TableHead>
              <TableHead className="w-[12%]">โซน</TableHead>
              <TableHead className="w-[10%]">จำนวนรูป</TableHead>
              <TableHead className="w-[14%]">อัปเดตล่าสุด</TableHead>
              <TableHead className="w-[10%]">สถานะ</TableHead>
              <TableHead className="w-[8%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advertisements.map((advertisement) => (
              <TableRow className={advertisement.is_active ? "" : "opacity-70"} key={advertisement.id}>
                <TableCell className="font-medium">
                  <span className="block truncate">{advertisement.title}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">ADV-{advertisement.id.slice(0, 8)}</TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {formatAdvertisementZone(advertisement.zone)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {advertisement.advertisement_images?.length ?? 0}
                </TableCell>
                <TableCell className="truncate text-muted-foreground">{formatDate(advertisement.updated_at)}</TableCell>
                <TableCell>
                  <StatusBadge active={advertisement.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/advertisements/${encodeURIComponent(advertisement.id)}`}>จัดการ</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
