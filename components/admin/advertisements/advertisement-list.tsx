import Link from "next/link";

import type { AdvertisementRow } from "../../../server/repositories/advertisements";
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
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH");
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
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>รูปภาพ</dt>
                  <dd className="font-medium text-foreground">{advertisement.advertisement_images?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>อัปเดต</dt>
                  <dd className="font-medium text-foreground">{formatDate(advertisement.updated_at)}</dd>
                </div>
              </dl>
              <Button asChild className="w-full">
                <Link href={`/admin/advertisements/${encodeURIComponent(advertisement.id)}`}>จัดการ</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อโฆษณา</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>จำนวนรูป</TableHead>
              <TableHead>อัปเดตล่าสุด</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advertisements.map((advertisement) => (
              <TableRow className={advertisement.is_active ? "" : "opacity-70"} key={advertisement.id}>
                <TableCell className="font-medium">{advertisement.title}</TableCell>
                <TableCell className="font-mono text-xs">ADV-{advertisement.id.slice(0, 8)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {advertisement.advertisement_images?.length ?? 0}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(advertisement.updated_at)}</TableCell>
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
